import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local before anything else
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Dynamic import after env is loaded
async function main() {
  const { getBot } = await import("./bot");
  const { startIdleListener } = await import("../lib/email/imap");

  const bot = getBot();

  await bot.api.deleteWebhook({ drop_pending_updates: false });
  console.log("⚠️  Webhook deleted — re-register it on Vercel after stopping local dev");

  startIdleListener().catch((err) => console.error("[email] Fatal:", err));

  await bot.start({
    onStart: (info) => {
      console.log(`\n✅ Bot @${info.username} is running (long polling)`);
      console.log(`Open Telegram and send /start to your bot\n`);
    },
  });

  process.once("SIGINT", () => bot.stop());
  process.once("SIGTERM", () => bot.stop());
}

main().catch(console.error);
