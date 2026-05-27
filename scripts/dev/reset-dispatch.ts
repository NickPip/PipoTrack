import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Delete bids first, then dispatch loads (no cascade in DB)
  const dispatchLoads = await prisma.load.findMany({
    where: { status: { in: ["PENDING_DISTRIBUTION", "HAS_BIDS", "QUOTED", "BOOKED"] } },
    select: { id: true },
  });
  const ids = dispatchLoads.map(l => l.id);
  await prisma.bid.deleteMany({ where: { loadId: { in: ids } } });
  const deleted = await prisma.load.deleteMany({ where: { id: { in: ids } } });
  console.log(`✓ Deleted ${deleted.count} dispatch load(s)`);

  // Find Nikoloz's driver
  const driver = await prisma.driver.findFirst({
    where: { name: { contains: "Nikoloz" } },
    include: { unit: true },
  });

  if (!driver) { console.error("❌ Driver 'Nikoloz' not found"); return; }

  // Make sure driver is available
  await prisma.driver.update({ where: { id: driver.id }, data: { isAvailable: true } });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  dayAfter.setHours(10, 0, 0, 0);

  const load = await prisma.load.create({
    data: {
      status: "PENDING_DISTRIBUTION",
      broker: "Summit Logistics",
      brokerName: "Alex Rivera",
      brokerEmail: "alex@summitlogistics.com",
      brokerPhone: "+1 (312) 555-0199",
      brokerReference: "SUM-2026-001",
      pickupAddress: "1200 W 35th St, Chicago, IL 60609",
      pickupZip: "60609",
      pickupDate: tomorrow,
      pickupNotes: "Driver must have PPE. Call upon arrival.",
      deliveryAddress: "3500 Lacey Rd, Downers Grove, IL 60515",
      deliveryZip: "60515",
      deliveryDate: dayAfter,
      miles: 23,
      weight: 480,
      dimensions: { pieces: 3, L: 48, W: 40, H: 36 },
      vehicleRequired: driver.vehicleType!,
      rate: 350,
    },
  });

  console.log(`\n✓ Load #${load.loadNumber} created (${load.id})`);
  console.log(`  Broker    : ${load.broker} — ${load.brokerReference}`);
  console.log(`  Route     : ${load.pickupZip} → ${load.deliveryZip} (${load.miles} mi)`);
  console.log(`  Vehicle   : ${load.vehicleRequired}`);
  console.log(`  Rate      : $${load.rate}`);
  console.log(`\n📤 Sending to Telegram...`);

  const { sendLoadToDriverById: sendLoadToDriver } = await import("../src/bot/sendLoad");
  await sendLoadToDriver(load.id, driver.id);

  console.log(`✅ Sent to @${driver.name} — check Telegram!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
