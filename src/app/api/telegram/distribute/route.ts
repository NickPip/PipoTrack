import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canMutate } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { distributeLoad } from "@/bot/sendLoad";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role as Role | undefined;
    if (!role || !canMutate(role, "dispatch")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
