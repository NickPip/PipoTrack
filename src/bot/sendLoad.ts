import { InlineKeyboard } from "grammy";
import { getBot } from "./bot";
import { prisma } from "@/lib/prisma";
import { doorOne } from "@/lib/doors/door-one";
import { doorTwo } from "@/lib/doors/door-two";
import { doorThree } from "@/lib/doors/door-three";
import { lookupZip } from "@/lib/zipcodes";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDistance } = require("geolib") as {
  getDistance: (
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number }
  ) => number;
};

function formatEST(date: Date): string {
  return new Date(date)
    .toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}

function milesOut(driverZip: string | null, pickupZip: string | null): number | null {
  if (!driverZip || !pickupZip) return null;
  const a = lookupZip(driverZip);
  const b = lookupZip(pickupZip);
  if (!a || !b) return null;
  const meters = getDistance(
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: b.latitude, longitude: b.longitude }
  );
  return Math.round(meters / 1609.34);
}


type LoadRecord = NonNullable<Awaited<ReturnType<typeof prisma.load.findUnique>>>;
type DriverWithUnit = Awaited<ReturnType<typeof prisma.driver.findMany>>[number] & {
  unit: { dimensions: unknown } | null;
};

// Accepts pre-fetched load + driver to avoid redundant DB queries when called in bulk
async function sendLoadToDriver(
  load: LoadRecord,
  driver: DriverWithUnit
): Promise<void> {
  if (!driver.telegramId) return;
  const bot = getBot();

  const dim = load.dimensions as {
    pieces?: number;
    L?: number;
    W?: number;
    H?: number;
  } | null;

  const out = milesOut(driver.currentZip, load.pickupZip ?? null);
  const driverLabel = driver.unit
    ? `${(driver.unit as { unitNumber?: string }).unitNumber ?? ""}|${driver.name}`
    : driver.name;
  const loadRef = load.brokerReference ?? String(load.loadNumber).padStart(4, "0");

  const lines: string[] = [
    `📦 <b>New Load Available</b>`,
    ``,
    `<b>Pick-up at:</b> ${load.pickupAddress}`,
    `<b>Pick-up date (EST):</b> ${formatEST(load.pickupDate)}`,
    ``,
    `<b>Deliver to:</b> ${load.deliveryAddress}`,
    `<b>Delivery date (EST):</b> ${formatEST(load.deliveryDate)}`,
    ``,
    `<b>Miles:</b> ${load.miles ?? "N/A"}`,
    `<b>Pieces:</b> ${dim?.pieces ?? "N/A"}`,
    `<b>Weight:</b> ${load.weight ? `${load.weight}lbs` : "N/A"}`,
    `<b>Dims:</b> ${dim?.L && dim?.W && dim?.H ? `${dim.L}x${dim.W}x${dim.H}` : "N/A"}`,
    `<b>Suggested Truck Size:</b> ${load.vehicleRequired ?? "N/A"}`,
  ];

  if (load.pickupNotes) {
    lines.push(``, `<b>Notes:</b> ${load.pickupNotes}`);
  }

  lines.push(
    ``,
    `<b>Miles Out:</b> ${out ?? "N/A"}`,
    `<b>Driver:</b> ${driverLabel}`,
    `<b>Load-N:</b> ${loadRef}`
  );

  if (load.rate) lines.push(`<b>Recommended Rate:</b> $${load.rate}`);

  const keyboard = new InlineKeyboard()
    .text("💵 BID", `bid:${load.id}`)
    .text("⏩ SKIP", `skip:${load.id}`)
    .row()
    .text("📞 Contact Dispatcher", "contact_dispatcher")
    .row()
    .text("🔴 Stop Loads", "stop_loads");

  await bot.api.sendMessage(driver.telegramId, lines.join("\n"), {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });

  await prisma.bid.upsert({
    where: { loadId_driverId: { loadId: load.id, driverId: driver.id } },
    create: { loadId: load.id, driverId: driver.id, amount: 0, status: "sent" },
    update: {},
  });
}

type CachedDrivers = Awaited<ReturnType<typeof prisma.driver.findMany<{
  where: { telegramId: { not: null }; isAvailable: true; unitId: { not: null } };
  include: { unit: { select: { dimensions: true; unitNumber: true } } };
}>>>;

let driverCache: CachedDrivers | null = null;
let driverCacheAt = 0;
const DRIVER_CACHE_TTL = 30_000; // 30 seconds — stale drivers just miss one batch

async function getAvailableDrivers(): Promise<CachedDrivers> {
  if (driverCache && Date.now() - driverCacheAt < DRIVER_CACHE_TTL) {
    return driverCache;
  }
  driverCache = await prisma.driver.findMany({
    where: { telegramId: { not: null }, isAvailable: true, unitId: { not: null } },
    include: { unit: { select: { dimensions: true, unitNumber: true } } },
  });
  driverCacheAt = Date.now();
  return driverCache;
}

// Call this when a driver's availability/zip/unit changes so the cache doesn't serve stale data
export function invalidateDriverCache() {
  driverCache = null;
}

export async function distributeLoad(loadId: string): Promise<number> {
  const load = await prisma.load.findUnique({ where: { id: loadId } });
  if (!load || !load.vehicleRequired) return 0;

  const drivers = await getAvailableDrivers();

  const loadDims = load.dimensions as { pieces?: number; L?: number; W?: number; H?: number } | null;

  const matching = drivers.filter((d) => {
    if (!doorOne(load.vehicleRequired!, d.vehicleType)) return false;
    if (!doorTwo(d.currentZip, d.searchRadius, load.pickupZip)) return false;
    const unitDims = d.unit?.dimensions as { length?: number; width?: number; height?: number } | null;
    if (!doorThree(unitDims, loadDims)) return false;
    return true;
  });

  // Send to all matching drivers in parallel — Telegram allows ~30 msg/sec globally
  const results = await Promise.allSettled(
    matching.map((driver) => sendLoadToDriver(load, driver as DriverWithUnit))
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected");
  for (const f of failed) {
    console.error("[bot] Failed to send load to driver:", (f as PromiseRejectedResult).reason);
  }

  return sent;
}

// Public helper for debug/seed scripts — fetches by ID then delegates
export async function sendLoadToDriverById(loadId: string, driverId: string): Promise<void> {
  const [load, driver] = await Promise.all([
    prisma.load.findUnique({ where: { id: loadId } }),
    prisma.driver.findUnique({
      where: { id: driverId },
      include: { unit: { select: { dimensions: true, unitNumber: true } } },
    }),
  ]);
  if (!load || !driver) return;
  await sendLoadToDriver(load, driver as DriverWithUnit);
}
