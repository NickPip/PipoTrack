import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getBot } from "@/bot/bot";

export const runtime = "nodejs";

// GET /api/telegram/setup?url=https://your-domain.vercel.app
// Admin-only. Registers the webhook with Telegram.
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

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
export async function DELETE(_req: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const bot = getBot();
    await bot.api.deleteWebhook();
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[telegram/setup DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
