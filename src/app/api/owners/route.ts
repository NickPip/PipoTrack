import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  email: z.email(),
  phone: z.string().min(1),
});

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const owners = await prisma.owner.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(owners);
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

  const owner = await prisma.owner.create({ data: parsed.data });
  return NextResponse.json(owner, { status: 201 });
}
