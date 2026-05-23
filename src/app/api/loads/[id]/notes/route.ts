import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || (!canAccess(role, "operations") && !canAccess(role, "accounting"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const notes = await prisma.loadNote.findMany({
    where: { loadId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(notes);
}

const postSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || (!canAccess(role, "operations") && !canAccess(role, "accounting"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userName = session?.user?.name ?? "Unknown";
  const userId = (session?.user as { id?: string } | undefined)?.id ?? "";

  const note = await prisma.loadNote.create({
    data: {
      loadId: id,
      userId,
      userName,
      body: parsed.data.body,
    },
  });

  return NextResponse.json(note, { status: 201 });
}
