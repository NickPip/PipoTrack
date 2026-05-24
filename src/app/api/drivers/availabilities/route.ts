import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const zipcodes = require("zipcodes") as {
  lookup: (zip: string) => { latitude: number; longitude: number; city: string; state: string } | null;
};

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
      location: { select: { updatedAt: true } },
    },
  });

  const ONLINE_THRESHOLD_MS = 30 * 60 * 1000;
  const now = Date.now();

  const result = drivers.map((d) => {
    const geo = d.currentZip ? zipcodes.lookup(d.currentZip) : null;
    const isRecent = d.location
      ? now - d.location.updatedAt.getTime() < ONLINE_THRESHOLD_MS
      : false;

    return {
      id: d.id,
      name: d.name,
      vehicleType: d.vehicleType,
      currentZip: d.currentZip,
      city: geo ? geo.city : null,
      state: geo ? geo.state : null,
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
  });

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
