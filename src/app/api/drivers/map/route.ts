import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

const ACTIVE_STATUSES = [
  "PENDING",
  "DISPATCHED_TO_PICKUP",
  "ONSITE_FOR_PICKUP",
  "LOADED_AND_DELIVERING",
  "ONSITE_FOR_DELIVERY",
];

const ONLINE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const [drivers, activeLoads] = await Promise.all([
    prisma.driver.findMany({
      include: {
        unit: { select: { unitNumber: true } },
        location: true,
      },
    }),
    prisma.load.findMany({
      where: { driverId: { not: null }, status: { in: ACTIVE_STATUSES as never[] } },
      select: { driverId: true },
    }),
  ]);

  const activeDriverIds = new Set(activeLoads.map((l) => l.driverId));
  const now = Date.now();

  const mapped = drivers.map((d) => {
    const hasLocation = d.location !== null;
    const isRecent = hasLocation && now - d.location!.updatedAt.getTime() < ONLINE_THRESHOLD_MS;
    const isDispatched = activeDriverIds.has(d.id);

    let status: "available" | "dispatched" | "off";
    if (isDispatched) {
      status = "dispatched";
    } else if (isRecent) {
      status = "available";
    } else {
      status = "off";
    }

    return {
      id: d.id,
      name: d.name,
      vehicleType: d.vehicleType,
      currentZip: d.currentZip,
      unitNumber: d.unit?.unitNumber ?? null,
      lat: d.location?.lat ?? null,
      lon: d.location?.lon ?? null,
      locationUpdatedAt: d.location?.updatedAt ?? null,
      status,
    };
  });

  return NextResponse.json({ drivers: mapped });
}
