import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { password, ...data } = parsed.data;
  const hashed = await hash(password, 12);

  const user = await prisma.user.create({
    data: { ...data, password: hashed },
    select: { id: true, name: true, surname: true, email: true, role: true },
  });

  return NextResponse.json(user, { status: 201 });
}
