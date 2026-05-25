import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { Role, LoadStatus } from "@/generated/prisma/enums";
import { z } from "zod";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const zipcodes = require("zipcodes") as {
  lookup: (zip: string) => { latitude: number; longitude: number } | null;
};

function extractZip(address: string): string | null {
  const m = address.match(/\b(\d{5})(-\d{4})?\b/);
  return m ? m[1] : null;
}

function zipToCoords(zip: string): { latitude: number; longitude: number } | null {
  return zipcodes.lookup(zip);
}

function metersToMiles(m: number) {
  return Math.round(m / 1609.34);
}

async function drivingMiles(
  from: { latitude: number; longitude: number },
  to:   { latitude: number; longitude: number }
): Promise<number | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { routes?: { distance: number }[] };
    const meters = data.routes?.[0]?.distance;
    return meters != null ? metersToMiles(meters) : null;
  } catch {
    return null;
  }
}

function parseDateTime(value: string): Date {
  // Accept ISO string or "MM/DD HH:mm"
  if (value.includes("T") || value.includes("-")) return new Date(value);
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (match) {
    const [, month, day, hour, minute] = match;
    const year = new Date().getFullYear();
    return new Date(year, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
  }
  return new Date(value);
}

const schema = z.object({
  broker: z.string().min(1, "Required"),
  brokerReference: z.string().optional(),
  dispatcherId: z.string().min(1, "Required"),
  trackingId: z.string().min(1, "Required"),
  status: z.nativeEnum(LoadStatus).optional(),
  driverRate: z.number().default(0),
  rate: z.number().default(0),
  pickupAddress: z.string().min(1, "Required"),
  pickupDate: z.string().min(1, "Required"),
  pickupNotes: z.string().optional(),
  deliveryAddress: z.string().min(1, "Required"),
  deliveryDate: z.string().min(1, "Required"),
  deliveryNotes: z.string().optional(),
  unitId: z.string().nullable().optional(),
  driverId: z.string().nullable().optional(),
  rcUrl: z.string().nullable().optional(),
  bolUrls: z.array(z.string()).optional(),
  podUrl: z.string().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "operations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const loads = await prisma.load.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      loadNumber: true,
      status: true,
      financialStatus: true,
      broker: true,
      brokerReference: true,
      pickupAddress: true,
      pickupDate: true,
      pickupNotes: true,
      deliveryAddress: true,
      deliveryDate: true,
      deliveryNotes: true,
      rate: true,
      driverRate: true,
      dispatcherId: true,
      trackingId: true,
      miles: true,
      vehicleRequired: true,
      driverId: true,
      unitId: true,
      factoringStatus: true,
      rcUrl: true,
      bolUrls: true,
      podUrl: true,
      createdAt: true,
      _count: { select: { notes: true } },
    },
  });

  // Collect all user IDs to resolve names
  const userIds = [
    ...new Set([
      ...loads.map((l) => l.dispatcherId).filter(Boolean),
      ...loads.map((l) => l.trackingId).filter(Boolean),
    ] as string[]),
  ];
  const unitIds   = loads.map((l) => l.unitId).filter(Boolean) as string[];
  const driverIds = loads.map((l) => l.driverId).filter(Boolean) as string[];

  const [users, unitRows, driverRows] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, surname: true } })
      : Promise.resolve([]),
    unitIds.length
      ? prisma.unit.findMany({ where: { id: { in: unitIds } }, select: { id: true, unitNumber: true } })
      : Promise.resolve([]),
    driverIds.length
      ? prisma.driver.findMany({
          where: { id: { in: driverIds } },
          select: { id: true, name: true, location: { select: { lat: true, lon: true, speed: true, updatedAt: true } } },
        })
      : Promise.resolve([]),
  ]);

  const userMap   = Object.fromEntries(users.map((u) => [u.id, `${u.name} ${u.surname}`]));
  const unitMap   = Object.fromEntries(unitRows.map((u) => [u.id, u.unitNumber]));
  const driverMap = Object.fromEntries(driverRows.map((d) => [d.id, d.name]));
  const locationMap = Object.fromEntries(
    driverRows.map((d) => [d.id, d.location ?? null])
  );

  const ONLINE_MS = 30 * 60 * 1000;

  // Build all Mapbox distance queries in parallel
  type DistResult = { coveredMiles: number | null; remainingMiles: number | null; isMoving: boolean | null };
  const distanceJobs = loads.map(async (l): Promise<DistResult> => {
    const loc = l.driverId ? locationMap[l.driverId] : null;
    if (!loc || Date.now() - new Date(loc.updatedAt).getTime() >= ONLINE_MS) {
      return { coveredMiles: null, remainingMiles: null, isMoving: null };
    }

    const driverPos  = { latitude: loc.lat, longitude: loc.lon };
    const toDelivery = l.status === "LOADED_AND_DELIVERING" || l.status === "ONSITE_FOR_DELIVERY";

    const pickupZip      = extractZip(l.pickupAddress);
    const deliveryZip    = extractZip(l.deliveryAddress);
    const pickupCoords   = pickupZip   ? zipToCoords(pickupZip)   : null;
    const deliveryCoords = deliveryZip ? zipToCoords(deliveryZip) : null;

    let coveredMiles: number | null = null;
    let remainingMiles: number | null = null;

    if (toDelivery) {
      [coveredMiles, remainingMiles] = await Promise.all([
        pickupCoords   ? drivingMiles(pickupCoords, driverPos)   : Promise.resolve(null),
        deliveryCoords ? drivingMiles(driverPos, deliveryCoords) : Promise.resolve(null),
      ]);
    } else {
      if (pickupCoords) remainingMiles = await drivingMiles(driverPos, pickupCoords);
    }

    return { coveredMiles, remainingMiles, isMoving: (loc.speed ?? 0) > 0 };
  });

  const distances = await Promise.all(distanceJobs);

  const result = loads.map((l, i) => ({
    ...l,
    dispatcherName: l.dispatcherId ? (userMap[l.dispatcherId] ?? null) : null,
    trackingName:   l.trackingId   ? (userMap[l.trackingId]   ?? null) : null,
    unitNumber:     l.unitId       ? (unitMap[l.unitId]        ?? null) : null,
    driverName:     l.driverId     ? (driverMap[l.driverId]    ?? null) : null,
    notesCount: l._count.notes,
    ...distances[i],
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "operations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const load = await prisma.load.create({
    data: {
      broker: d.broker,
      brokerReference: d.brokerReference ?? null,
      dispatcherId: d.dispatcherId,
      trackingId: d.trackingId,
      status: d.status ?? LoadStatus.PENDING,
      rate: d.rate,
      driverRate: d.driverRate,
      pickupAddress: d.pickupAddress,
      pickupDate: parseDateTime(d.pickupDate),
      pickupNotes: d.pickupNotes ?? null,
      deliveryAddress: d.deliveryAddress,
      deliveryDate: parseDateTime(d.deliveryDate),
      deliveryNotes: d.deliveryNotes ?? null,
      unitId: d.unitId ?? null,
      driverId: d.driverId ?? null,
      rcUrl: d.rcUrl ?? null,
      bolUrls: d.bolUrls ?? [],
      podUrl: d.podUrl ?? null,
      pickupZip: null,
      vehicleRequired: null,
    },
  });

  return NextResponse.json(load, { status: 201 });
}
