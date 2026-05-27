import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess, canMutate } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  ownerName: z.string().nullable().optional(),
  email: z.email(),
  phone: z.string().min(1),
  address: z.string().nullable().optional(),
  ssnFein: z.string().nullable().optional(),
  ssnFeinDocUrl: z.string().nullable().optional(),
  ownerDocUrl: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  bankInfoUrl: z.string().nullable().optional(),
  w9Url: z.string().nullable().optional(),
  insuranceUrl: z.string().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const owners = await prisma.owner.findMany({ orderBy: { name: "asc" } });
  const ownerIds = owners.map((o) => o.id);
  const units = ownerIds.length
    ? await prisma.unit.findMany({ where: { ownerId: { in: ownerIds } }, select: { ownerId: true } })
    : [];
  const countMap: Record<string, number> = {};
  units.forEach((u) => { if (u.ownerId) countMap[u.ownerId] = (countMap[u.ownerId] ?? 0) + 1; });

  return NextResponse.json(owners.map((o) => ({ ...o, unitCount: countMap[o.id] ?? 0 })));
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
    return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  }

  const owner = await prisma.owner.create({ data: parsed.data });
  return NextResponse.json(owner, { status: 201 });
}
