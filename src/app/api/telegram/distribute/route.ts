import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { distributeLoad } from "@/bot/sendLoad";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const guard = await requireRole("dispatch", "mutate");
    if (guard instanceof NextResponse) return guard;

    const { loadId } = await req.json();
    if (!loadId) return NextResponse.json({ error: "loadId required" }, { status: 400 });

    const load = await prisma.load.findUnique({ where: { id: loadId } });
    if (!load) return NextResponse.json({ error: "Load not found" }, { status: 404 });

    const sent = await distributeLoad(loadId);
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[telegram/distribute]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
