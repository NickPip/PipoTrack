import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { Prisma } from "@/generated/prisma/client";
import { handlePrismaError } from "@/lib/prisma-errors";
import { z } from "zod";

const UNIT_FIELD_LABELS = {
  unitNumber: "Unit number",
  vin: "VIN",
  plateNumber: "Plate number",
};

const VEHICLE_TYPES = ["Sprinter Van", "Cargo Van", "Small Straight", "Large Straight"] as const;
const EQUIPMENT_OPTIONS = ["PPE", "E-TRACK", "DOLLY", "BLANKETS", "STRAPS"] as const;

const schema = z.object({
  unitNumber: z.string().min(1),
  type: z.enum(VEHICLE_TYPES),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.string().min(1),
  vin: z.string().min(1),
  plateNumber: z.string().min(1),
  ownerId: z.string().nullable().optional(),
  payload: z.number().positive().nullable().optional(),
  equipment: z.array(z.enum(EQUIPMENT_OPTIONS)).optional(),
  dimensions: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .nullable()
    .optional(),
  registrationUrl: z.string().nullable().optional(),
  pictureUrls: z.array(z.string()).optional(),
  driverIds: z.array(z.string()).optional(),
});

export async function GET() {
  const guard = await requireRole(["recruiting", "operations", "accounting"], "read");
  if (guard instanceof NextResponse) return guard;

  const units = await prisma.unit.findMany({
    orderBy: { unitNumber: "asc" },
    include: { drivers: { select: { id: true, name: true } } },
  });

  const ownerIds = units.map((u) => u.ownerId).filter(Boolean) as string[];
  const owners = ownerIds.length
    ? await prisma.owner.findMany({ where: { id: { in: ownerIds } } })
    : [];
  const ownerMap = Object.fromEntries(owners.map((o) => [o.id, o.name]));

  const result = units.map((u) => ({
    id: u.id,
    unitNumber: u.unitNumber,
    type: u.type,
    make: u.make,
    model: u.model,
    year: u.year,
    vin: u.vin,
    plateNumber: u.plateNumber,
    ownerId: u.ownerId,
    ownerName: u.ownerId ? (ownerMap[u.ownerId] ?? null) : null,
    payload: u.payload,
    equipment: u.equipment,
    dimensions: u.dimensions,
    registrationUrl: u.registrationUrl,
    pictureUrls: u.pictureUrls,
    drivers: u.drivers,
    driverCount: u.drivers.length,
    available: u.available,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const guard = await requireRole("recruiting", "mutate");
  if (guard instanceof NextResponse) return guard;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  }

  const { driverIds, ...data } = parsed.data;

  try {
  // Create the unit and reassign drivers atomically. Without a transaction,
  // a crash between the two writes would leave a unit with no drivers (or
  // drivers reassigned to a unit that no longer exists if the create rolled
  // back on a constraint error).
  const unit = await prisma.$transaction(async (tx) => {
    const created = await tx.unit.create({
      data: {
        unitNumber: data.unitNumber,
        type: data.type,
        make: data.make,
        model: data.model,
        year: data.year,
        vin: data.vin,
        plateNumber: data.plateNumber,
        ownerId: data.ownerId ?? null,
        payload: data.payload ?? null,
        equipment: data.equipment ?? [],
        dimensions: data.dimensions ?? Prisma.DbNull,
        registrationUrl: data.registrationUrl ?? null,
        pictureUrls: data.pictureUrls ?? [],
      },
    });

    if (driverIds?.length) {
      await tx.driver.updateMany({
        where: { id: { in: driverIds } },
        data: { unitId: created.id },
      });
    }

    return created;
  });

  return NextResponse.json(unit, { status: 201 });
  } catch (err) {
    const res = handlePrismaError(err, UNIT_FIELD_LABELS, {
      unitNumber: data.unitNumber,
      vin: data.vin,
      plateNumber: data.plateNumber,
    });
    if (res) return res;
    throw err;
  }
}
