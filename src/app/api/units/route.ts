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

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || (!canAccess(role, "recruiting") && !canAccess(role, "operations") && !canAccess(role, "accounting"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { driverIds, ...data } = parsed.data;

  const unit = await prisma.unit.create({
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
    await prisma.driver.updateMany({
      where: { id: { in: driverIds } },
      data: { unitId: unit.id },
    });
  }

  return NextResponse.json(unit, { status: 201 });
}
