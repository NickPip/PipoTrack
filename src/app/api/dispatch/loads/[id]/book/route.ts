import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canMutate } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { getBot } from "@/bot/bot";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const role = session?.user?.role as Role | undefined;
    if (!role || !canMutate(role, "dispatch")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: loadId } = await params;

    const load = await prisma.load.findUnique({
      where: { id: loadId },
      include: {
        bids: {
          where: { status: "accepted" },
          include: {
            driver: { select: { id: true, unitId: true, telegramId: true } },
          },
          take: 1,
        },
      },
    });

    if (!load)
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    if (load.status !== "QUOTED") {
      return NextResponse.json(
        { error: "Load must be in QUOTED status to book" },
        { status: 400 },
      );
    }

    const acceptedBid = load.bids[0];
    const unitId = acceptedBid?.driver?.unitId ?? load.unitId;
    const driverId = acceptedBid?.driver?.id ?? load.driverId;
    const dispatcherId = session?.user?.id ?? null;

    const updated = await prisma.load.update({
      where: { id: loadId },
      data: {
        status: "PENDING",
        dispatcherId,
        unitId: unitId ?? undefined,
        driverId: driverId ?? undefined,
      },
    });

    const telegramId = acceptedBid?.driver?.telegramId;
    if (telegramId) {
      const loadRef =
        load.brokerReference ?? String(load.loadNumber).padStart(4, "0");
      try {
        const bot = getBot();
        await bot.api.sendMessage(
          telegramId,
          `✅ <b>Load #${loadRef} is Booked!</b>\n\n` +
            `Your load has been confirmed. Please proceed to pick up.\n\n` +
            `<b>Pick-up:</b> ${load.pickupAddress}\n` +
            `<b>Deliver to:</b> ${load.deliveryAddress}\n\n` +
            `Operations department will contact for further details`,
          { parse_mode: "HTML" },
        );
      } catch (tgErr) {
        console.error("[dispatch/loads/book] Telegram notify failed:", tgErr);
      }
    }

    return NextResponse.json({ load: updated });
  } catch (err) {
    console.error("[dispatch/loads/book]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
