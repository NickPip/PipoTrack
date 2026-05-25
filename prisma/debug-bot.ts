import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const driver = await prisma.driver.findFirst({
    where: { name: { contains: "Nikoloz" } },
  });
  console.log("Driver:", JSON.stringify(driver, null, 2));

  const load = await prisma.load.findFirst({
    where: { status: "PENDING_DISTRIBUTION" },
    orderBy: { createdAt: "desc" },
  });
  console.log("\nLoad:", load?.id, load?.vehicleRequired, load?.status);

  // Send a direct test message via Telegram HTTP API
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = driver?.telegramId;
  if (!token || !chatId) { console.error("Missing token or telegramId"); return; }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: "🔧 Bot diagnostic test — if you see this, the bot is working." }),
  });
  const json = await res.json();
  console.log("\nTelegram API response:", JSON.stringify(json, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
