import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  surname: z.string().min(1),
  email: z.email(),
  password: z.string().min(6),
  idNumber: z.string().min(1),
  role: z.enum(["ADMIN", "RECRUITING", "DISPATCHER", "OPERATIONS", "ACCOUNTING"]),
  phoneNumber: z.string().min(1),
  phone2: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
      idNumber: true,
      role: true,
      phoneNumber: true,
      phone2: true,
      address: true,
      emergencyContact: true,
      createdAt: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  }

  const { password, ...rest } = parsed.data;
  // Normalize email so storage matches the case-insensitive login lookup and
  // the unique constraint can't be sidestepped with different casing.
  const data = { ...rest, email: rest.email.toLowerCase().trim() };
  const hashed = await hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: { ...data, password: hashed },
      select: { id: true, name: true, surname: true, email: true, role: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const conflict = await prisma.user.findFirst({
        where: { OR: [{ email: data.email }, { idNumber: data.idNumber }] },
        select: { email: true, idNumber: true },
      });
      const message =
        conflict?.email === data.email
          ? `Email "${data.email}" is already in use.`
          : conflict?.idNumber === data.idNumber
            ? `ID number "${data.idNumber}" is already in use.`
            : "A user with these details already exists.";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw err;
  }
}
