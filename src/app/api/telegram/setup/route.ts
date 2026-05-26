import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";
import { getBot } from "@/bot/bot";

export const runtime = "nodejs";

// GET /api/telegram/setup?url=https://your-domain.vercel.app
// Admin-only. Registers the webhook with Telegram.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role as Role | undefined;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const reqUrl = new URL(req.url);
    const customUrl = reqUrl.searchParams.get("url");
    const origin = customUrl ?? reqUrl.origin;
    const webhookUrl = `${origin}/api/telegram/webhook`;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

    const bot = getBot();
    await bot.api.setWebhook(webhookUrl, {
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
    });

    const info = await bot.api.getWebhookInfo();
    return NextResponse.json({ webhookUrl, info });
  } catch (err) {
    console.error("[telegram/setup]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/telegram/setup — remove webhook (for switching to long polling locally)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role as Role | undefined;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const bot = getBot();
    await bot.api.deleteWebhook();
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[telegram/setup DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
