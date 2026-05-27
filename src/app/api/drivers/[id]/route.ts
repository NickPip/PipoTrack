import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canMutate } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { handlePrismaError } from "@/lib/prisma-errors";
import { z } from "zod";

const DRIVER_FIELD_LABELS = {
  dlNumber: "Driver license number",
  telegramId: "Telegram ID",
  traccarDeviceId: "Traccar device ID",
};

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
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canMutate(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  }

  const { unitId, ...rest } = parsed.data;

  try {
    const driver = await prisma.driver.update({
      where: { id },
      data: { ...rest, unitId: unitId ?? null },
    });
    return NextResponse.json(driver);
  } catch (err) {
    const res = handlePrismaError(err, DRIVER_FIELD_LABELS, {
      dlNumber: parsed.data.dlNumber,
      telegramId: parsed.data.telegramId,
    });
    if (res) return res;
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canMutate(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.driver.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
