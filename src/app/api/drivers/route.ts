import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { handlePrismaError } from "@/lib/prisma-errors";
import { z } from "zod";

// Never serialize driver secrets back to the client.
const DRIVER_SECRETS = { appPassword: true, appToken: true } as const;

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
  traccarDeviceId: z.string().nullable().optional(),
});

export async function GET() {
  const guard = await requireRole("recruiting", "read");
  if (guard instanceof NextResponse) return guard;

  const drivers = await prisma.driver.findMany({
    orderBy: { name: "asc" },
    include: { unit: { select: { id: true, unitNumber: true } } },
    omit: DRIVER_SECRETS,
  });

  return NextResponse.json(drivers);
}

export async function POST(req: NextRequest) {
  const guard = await requireRole("recruiting", "mutate");
  if (guard instanceof NextResponse) return guard;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  try {
    const { unitId, appPassword, ...rest } = parsed.data;
    const driver = await prisma.driver.create({
      data: {
        ...rest,
        unitId: unitId ?? null,
        appPassword: appPassword ? await hash(appPassword, 12) : null,
      },
      omit: DRIVER_SECRETS,
    });
    return NextResponse.json(driver, { status: 201 });
  } catch (err) {
    const res = handlePrismaError(err, DRIVER_FIELD_LABELS, {
      dlNumber: parsed.data.dlNumber,
      telegramId: parsed.data.telegramId,
      traccarDeviceId: parsed.data.traccarDeviceId,
    });
    if (res) return res;
    console.error("[POST /api/drivers]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
