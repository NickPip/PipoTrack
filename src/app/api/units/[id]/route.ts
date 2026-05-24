import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

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

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/units/[id]">) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { driverIds, ...data } = parsed.data;

  const unit = await prisma.unit.update({
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
    // Clear all current assignments for this unit, then set new ones
    await prisma.driver.updateMany({ where: { unitId: id }, data: { unitId: null } });
    if (driverIds.length) {
      await prisma.driver.updateMany({
        where: { id: { in: driverIds } },
        data: { unitId: id },
      });
    }
  }

  return NextResponse.json(unit);
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/units/[id]">) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = z.object({ available: z.boolean() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const unit = await prisma.unit.update({
    where: { id },
    data: { available: parsed.data.available },
  });
  return NextResponse.json(unit);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/units/[id]">) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  // Unassign drivers before deleting
  await prisma.driver.updateMany({ where: { unitId: id }, data: { unitId: null } });
  await prisma.unit.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
