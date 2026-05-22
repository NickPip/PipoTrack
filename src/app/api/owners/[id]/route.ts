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

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/owners/[id]">) {
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

  const owner = await prisma.owner.update({ where: { id }, data: parsed.data });
  return NextResponse.json(owner);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/owners/[id]">) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "recruiting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  await prisma.owner.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
