import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess, canMutate } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  vehicleType: z.string().nullable().optional(),
  currentZip: z.string().nullable().optional(),
  searchRadius: z.coerce.number().int().positive().nullable().optional(),
  telegramId: z.string().nullable().optional(),
  unitId: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  dlNumber: z.string().nullable().optional(),
  dlDocumentUrl: z.string().nullable().optional(),
  citizenshipType: z.string().nullable().optional(),
  cleanBackground: z.boolean().nullable().optional(),
  emergencyContact: z.string().nullable().optional(),
  drivingRecordUrl: z.string().nullable().optional(),
  twicTsaUrl: z.string().nullable().optional(),
  appUsername: z.string().nullable().optional(),
  appPassword: z.string().nullable().optional(),
  traccarDeviceId: z.string().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const drivers = await prisma.driver.findMany({
    orderBy: { name: "asc" },
    include: { unit: { select: { id: true, unitNumber: true } } },
  });

  return NextResponse.json(drivers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canMutate(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  try {
    const { unitId, ...rest } = parsed.data;
    const driver = await prisma.driver.create({
      data: { ...rest, unitId: unitId ?? null },
    });
    return NextResponse.json(driver, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    console.error("[POST /api/drivers]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
