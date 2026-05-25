import { webhookCallback } from "grammy";
import { getBot } from "@/bot/bot";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secretToken) {
    const incoming = (req.headers as Headers).get("x-telegram-bot-api-secret-token");
    if (incoming !== secretToken) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const bot = getBot();
  return webhookCallback(bot, "std/http")(req);
}
