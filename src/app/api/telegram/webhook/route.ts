import { timingSafeEqual } from "node:crypto";
import { webhookCallback } from "grammy";
import { getBot } from "@/bot/bot";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(req: Request): Promise<Response> {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secretToken) {
    // No secret configured. In production this means the endpoint would accept
    // unauthenticated calls — refuse instead of failing open. Locally we allow
    // it so the bot can be exercised without provisioning the secret.
    if (process.env.NODE_ENV === "production") {
      console.error("[telegram/webhook] TELEGRAM_WEBHOOK_SECRET not set — rejecting");
      return new Response("Webhook not configured", { status: 503 });
    }
  } else {
    const incoming = req.headers.get("x-telegram-bot-api-secret-token");
    if (!incoming || !safeEqual(incoming, secretToken)) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const bot = getBot();
  return webhookCallback(bot, "std/http")(req);
}
