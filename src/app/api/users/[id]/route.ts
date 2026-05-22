import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  surname: z.string().min(1).optional(),
  email: z.email().optional(),
  password: z.string().min(6).optional(),
  idNumber: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "RECRUITING", "DISPATCHER", "OPERATIONS", "ACCOUNTING"]).optional(),
  phoneNumber: z.string().min(1).optional(),
  phone2: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { password, ...data } = parsed.data;
  const updateData: Record<string, unknown> = { ...data };
  if (password) updateData.password = await hash(password, 12);

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, surname: true, email: true, role: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
