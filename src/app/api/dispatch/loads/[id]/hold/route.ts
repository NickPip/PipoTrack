import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { getBot } from "@/bot/bot";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const role = session?.user?.role as Role | undefined;
    if (!role || !canAccess(role, "dispatch")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: loadId } = await params;

    const load = await prisma.load.findUnique({
      where: { id: loadId },
      include: {
        bids: {
          where: { status: "accepted" },
          include: { driver: { select: { id: true, name: true, telegramId: true } } },
          take: 1,
        },
      },
    });

    if (!load) return NextResponse.json({ error: "Load not found" }, { status: 404 });
    if (load.status !== "QUOTED") {
      return NextResponse.json({ error: "Load must be QUOTED to send a hold" }, { status: 400 });
    }

    const driver = load.bids[0]?.driver;
    if (!driver?.telegramId) {
      return NextResponse.json({ error: "Driver has no Telegram ID" }, { status: 400 });
    }

    const loadRef = load.brokerReference ?? String(load.loadNumber).padStart(4, "0");

    const bot = getBot();
    await bot.api.sendMessage(
      driver.telegramId,
      `⏸ <b>Please Hold — Load #${loadRef}</b>\n\n` +
        `We are confirming your booking. Please <b>hold for 15 minutes</b> and do not bid on other loads.\n\n` +
        `We will contact you shortly.`,
      { parse_mode: "HTML" }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[dispatch/loads/hold]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
