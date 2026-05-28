import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["operations", "accounting"], "read");
  if (guard instanceof NextResponse) return guard;

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
  // Notes write — allow both Operations and Accounting to leave a note.
  const guard = await requireRole(["operations", "accounting"], "mutate");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  }

  const userName = guard.name || "Unknown";
  const userId = guard.userId;

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
