import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  }

  const { password, ...data } = parsed.data;
  const updateData: Record<string, unknown> = { ...data };
  if (password) updateData.password = await hash(password, 12);

  try {
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, surname: true, email: true, role: true },
    });
    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const orFilters: Prisma.UserWhereInput[] = [];
      if (data.email)    orFilters.push({ email: data.email });
      if (data.idNumber) orFilters.push({ idNumber: data.idNumber });

      const conflict = orFilters.length
        ? await prisma.user.findFirst({
            where: { AND: [{ id: { not: id } }, { OR: orFilters }] },
            select: { email: true, idNumber: true },
          })
        : null;

      const message =
        data.email && conflict?.email === data.email
          ? `Email "${data.email}" is already in use.`
          : data.idNumber && conflict?.idNumber === data.idNumber
            ? `ID number "${data.idNumber}" is already in use.`
            : "Another user with these details already exists.";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
