import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const zipcodes = require("zipcodes") as {
  lookup: (zip: string) => { latitude: number; longitude: number; city: string; state: string } | null;
  lookupByCoords: (lat: number, lon: number) => { zip: string; city: string; state: string } | null;
};

// ── Nominatim reverse-geocode cache (5-minute TTL) ────────────────────────────
const nominatimCache = new Map<string, { address: string; expiresAt: number }>();

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = nominatimCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.address;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "PipoTrack/1.0 (logistics-platform)" }, signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      address?: {
        house_number?: string; road?: string; city?: string; town?: string;
        village?: string; suburb?: string; state?: string; postcode?: string;
      };
    };
    const a = data.address;
    if (!a) return null;

    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    const locality = a.city ?? a.town ?? a.village ?? a.suburb ?? "";
    const parts = [street, locality, a.state].filter(Boolean);
    const address = parts.join(", ") + (a.postcode ? ` ${a.postcode}` : "");

    nominatimCache.set(key, { address, expiresAt: Date.now() + 5 * 60 * 1000 });
    return address || null;
  } catch {
    return null;
  }
}

const patchSchema = z.object({
  id: z.string(),
  outMiles: z.coerce.number().int().nonnegative().optional(),
  minMiles: z.coerce.number().int().nonnegative().optional(),
  maxMiles: z.coerce.number().int().nonnegative().optional(),
  wayDirection: z.string().optional(),
  isAvailable: z.boolean().optional(),
  availableAt: z.string().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const drivers = await prisma.driver.findMany({
    orderBy: { name: "asc" },
    include: {
      unit: { select: { unitNumber: true, dimensions: true, type: true } },
      location: { select: { lat: true, lon: true, updatedAt: true } },
    },
  });

  const ONLINE_THRESHOLD_MS = 30 * 60 * 1000;
  const now = Date.now();

  // APO/FPO codes and territories have coordinates in the DB that can
  // win the nearest-neighbor search for real US locations — skip them.
  const US_STATES = new Set([
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
    "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
    "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
    "TX","UT","VT","VA","WA","WV","WI","WY","DC",
  ]);

  const result = await Promise.all(drivers.map(async (d) => {
    const isRecent = d.location
      ? now - d.location.updatedAt.getTime() < ONLINE_THRESHOLD_MS
      : false;

    let city: string | null = null;
    let state: string | null = null;
    let displayZip: string | null = d.currentZip ?? null;
    let streetAddress: string | null = null;

    if (d.location && isRecent) {
      const geoByCoords = zipcodes.lookupByCoords(d.location.lat, d.location.lon);
      if (geoByCoords && US_STATES.has(geoByCoords.state)) {
        city = geoByCoords.city;
        state = geoByCoords.state;
        displayZip = geoByCoords.zip;
      }
      streetAddress = await reverseGeocode(d.location.lat, d.location.lon);
    } else if (d.currentZip) {
      const geo = zipcodes.lookup(d.currentZip);
      if (geo) { city = geo.city; state = geo.state; }
    }

    return {
      id: d.id,
      name: d.name,
      vehicleType: d.vehicleType,
      currentZip: displayZip,
      city,
      state,
      streetAddress,
      unitNumber: d.unit?.unitNumber ?? null,
      unitDimensions: d.unit?.dimensions ?? null,
      locationUpdatedAt: d.location?.updatedAt ?? null,
      isOnline: isRecent,
      dlNumber: d.dlNumber,
      outMiles: d.outMiles ?? 75,
      minMiles: d.minMiles ?? 0,
      maxMiles: d.maxMiles ?? 5000,
      wayDirection: d.wayDirection ?? "ANY",
      isAvailable: d.isAvailable,
      availableAt: d.availableAt ?? null,
    };
  }));

  return NextResponse.json({ drivers: result });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { id, availableAt, ...fields } = parsed.data;

  // Only include fields that were actually sent (strip undefined)
  const data: Record<string, unknown> = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  );
  if (availableAt !== undefined) {
    data.availableAt = availableAt === null ? null : new Date(availableAt);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const driver = await prisma.driver.update({
      where: { id },
      data,
    });
    return NextResponse.json(driver);
  } catch (err) {
    console.error("[PATCH /api/drivers/availabilities]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
