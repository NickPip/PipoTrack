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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("recruiting", "mutate");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  }

  const { driverIds, ...data } = parsed.data;

  try {
  // Unit update + driver reassignment as one transaction. Previously a crash
  // between the clear step and the reassign step would leave all drivers
  // unassigned from this unit with no recovery path.
  const unit = await prisma.$transaction(async (tx) => {
    const updated = await tx.unit.update({
      where: { id },
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

    if (driverIds !== undefined) {
      await tx.driver.updateMany({ where: { unitId: id }, data: { unitId: null } });
      if (driverIds.length) {
        await tx.driver.updateMany({
          where: { id: { in: driverIds } },
          data: { unitId: id },
        });
      }
    }

    return updated;
  });

  return NextResponse.json(unit);
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("recruiting", "mutate");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await req.json();
  const parsed = z.object({ available: z.boolean() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  }

  const unit = await prisma.unit.update({
    where: { id },
    data: { available: parsed.data.available },
  });
  return NextResponse.json(unit);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("recruiting", "mutate");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  // Unassign drivers + delete unit atomically so a crash mid-delete doesn't
  // leave drivers pointing at a unit id that no longer exists.
  await prisma.$transaction([
    prisma.driver.updateMany({ where: { unitId: id }, data: { unitId: null } }),
    prisma.unit.delete({ where: { id } }),
  ]);
  return new NextResponse(null, { status: 204 });
}
