import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  vehicleType: z.enum(["Sprinter", "Cargo Van", "Small Straight", "Large Straight"]),
  currentZip: z.string().min(1),
  searchRadius: z.coerce.number().int().positive(),
  telegramId: z.string().nullable().optional(),
  unitId: z.string().nullable().optional(),
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
  if (!role || !canAccess(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { telegramId, unitId, ...data } = parsed.data;
  const driver = await prisma.driver.create({
    data: { ...data, telegramId: telegramId ?? null, unitId: unitId ?? null },
  });

  return NextResponse.json(driver, { status: 201 });
}
