import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canMutate } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { handlePrismaError } from "@/lib/prisma-errors";
import { z } from "zod";

const OWNER_FIELD_LABELS = {
  email: "Email",
  ssnFein: "SSN/FEIN",
};

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

  try {
    const owner = await prisma.owner.update({ where: { id }, data: parsed.data });
    return NextResponse.json(owner);
  } catch (err) {
    const res = handlePrismaError(err, OWNER_FIELD_LABELS, {
      email: parsed.data.email,
      ssnFein: parsed.data.ssnFein,
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
  await prisma.owner.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
