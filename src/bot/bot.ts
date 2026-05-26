import { Bot, Context, InlineKeyboard, session, SessionFlavor } from "grammy";
import { prisma } from "@/lib/prisma";
import { invalidateDriverCache } from "./sendLoad";

interface SessionData {
  action: "awaiting_bid" | null;
  loadId: string | null;
}

type BotContext = Context & SessionFlavor<SessionData>;

const storage = {
  async read(key: string): Promise<SessionData | undefined> {
    const row = await prisma.telegramSession.findUnique({ where: { key } });
    return row ? (JSON.parse(row.data) as SessionData) : undefined;
  },
  async write(key: string, value: SessionData): Promise<void> {
    await prisma.telegramSession.upsert({
      where: { key },
      update: { data: JSON.stringify(value) },
      create: { key, data: JSON.stringify(value) },
    });
  },
  async delete(key: string): Promise<void> {
    await prisma.telegramSession.deleteMany({ where: { key } });
  },
};

let botInstance: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (botInstance) return botInstance;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const bot = new Bot<BotContext>(token);

  bot.use(
    session<SessionData, BotContext>({
      initial: (): SessionData => ({ action: null, loadId: null }),
      storage,
    })
  );

  // /start — register and show Telegram ID
  bot.command("start", async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const driver = await prisma.driver.findFirst({ where: { telegramId } });

    if (!driver) {
      await ctx.reply(
        `👋 Welcome!\n\nYour account is not linked yet.\n\n` +
          `Share this ID with your dispatcher:\n\n<code>${telegramId}</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    await ctx.reply(
      `✅ Hi <b>${driver.name}</b>!\n\n` +
        `You are registered and will receive load offers here.\n` +
        `Tap <b>BID</b> to submit a price or <b>SKIP</b> to pass.`,
      { parse_mode: "HTML" }
    );
  });

  // /myid — convenience: show Telegram user ID
  bot.command("myid", async (ctx) => {
    await ctx.reply(
      `Your Telegram ID: <code>${ctx.from?.id}</code>`,
      { parse_mode: "HTML" }
    );
  });

  // BID button
  bot.callbackQuery(/^bid:(.+)$/, async (ctx) => {
    const loadId = ctx.match![1];
    const telegramId = String(ctx.from?.id);

    const driver = await prisma.driver.findFirst({ where: { telegramId } });
    if (!driver) {
      await ctx.answerCallbackQuery({ text: "Not registered. Contact your dispatcher." });
      return;
    }

    const existing = await prisma.bid.findFirst({ where: { loadId, driverId: driver.id } });
    if (existing && existing.status !== "sent") {
      await ctx.answerCallbackQuery({ text: "You already responded to this load." });
      return;
    }

    const load = await prisma.load.findUnique({ where: { id: loadId } });
    if (!load || !["PENDING_DISTRIBUTION", "HAS_BIDS"].includes(load.status)) {
      await ctx.answerCallbackQuery({ text: "This load is no longer accepting bids." });
      return;
    }

    ctx.session.action = "awaiting_bid";
    ctx.session.loadId = loadId;

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `💰 Enter your bid amount in dollars (numbers only, e.g. <b>400</b>):`,
      { parse_mode: "HTML" }
    );
  });

  // SKIP button
  bot.callbackQuery(/^skip:(.+)$/, async (ctx) => {
    const loadId = ctx.match![1];
    const telegramId = String(ctx.from?.id);

    const driver = await prisma.driver.findFirst({ where: { telegramId } });
    if (!driver) {
      await ctx.answerCallbackQuery({ text: "Not registered." });
      return;
    }

    const existing = await prisma.bid.findFirst({ where: { loadId, driverId: driver.id } });
    if (existing && existing.status !== "sent") {
      await ctx.answerCallbackQuery({ text: "Already responded." });
      return;
    }

    await prisma.bid.upsert({
      where: { loadId_driverId: { loadId, driverId: driver.id } },
      create: { loadId, driverId: driver.id, amount: 0, status: "skipped" },
      update: { status: "skipped" },
    });

    await ctx.answerCallbackQuery({ text: "Load skipped ✓" });
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
    } catch {
      // Message may be too old to edit — ignore
    }
    await ctx.reply("⏩ Load skipped. You'll receive the next one shortly.");
  });

  // Contact Dispatcher button
  bot.callbackQuery("contact_dispatcher", async (ctx) => {
    const phone = process.env.DISPATCHER_PHONE ?? "N/A";
    await ctx.answerCallbackQuery();
    await ctx.reply(`📞 <b>Dispatcher:</b> ${phone}`, { parse_mode: "HTML" });
  });

  // Stop Loads button
  bot.callbackQuery("stop_loads", async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const driver = await prisma.driver.findFirst({ where: { telegramId } });
    if (!driver) {
      await ctx.answerCallbackQuery({ text: "Not registered." });
      return;
    }

    await prisma.driver.update({
      where: { id: driver.id },
      data: { isAvailable: false },
    });
    invalidateDriverCache();

    await ctx.answerCallbackQuery({ text: "✓ Stopped" });
    await ctx.reply(
      "🔴 You have stopped receiving loads. Contact your dispatcher to resume."
    );
  });

  // Incoming text — handle bid amount entry
  bot.on("message:text", async (ctx) => {
    if (ctx.session.action !== "awaiting_bid" || !ctx.session.loadId) return;

    const amountStr = ctx.message.text.trim().replace(/[^0-9.]/g, "");
    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(
        `❌ Invalid amount. Please enter a number (e.g. <b>400</b>):`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const loadId = ctx.session.loadId;
    const telegramId = String(ctx.from?.id);

    const driver = await prisma.driver.findFirst({ where: { telegramId } });
    if (!driver) return;

    const load = await prisma.load.findUnique({ where: { id: loadId } });
    if (!load || !["PENDING_DISTRIBUTION", "HAS_BIDS"].includes(load.status)) {
      ctx.session.action = null;
      ctx.session.loadId = null;
      await ctx.reply("⚠️ This load is no longer accepting bids.");
      return;
    }

    const existing = await prisma.bid.findFirst({ where: { loadId, driverId: driver.id } });
    if (existing && existing.status !== "sent") {
      ctx.session.action = null;
      ctx.session.loadId = null;
      await ctx.reply("⚠️ You already submitted a bid for this load.");
      return;
    }

    await prisma.bid.upsert({
      where: { loadId_driverId: { loadId, driverId: driver.id } },
      create: { loadId, driverId: driver.id, amount, status: "pending" },
      update: { amount, status: "pending" },
    });

    if (load.status === "PENDING_DISTRIBUTION") {
      await prisma.load.update({
        where: { id: loadId },
        data: { status: "HAS_BIDS" },
      });
    }

    ctx.session.action = null;
    ctx.session.loadId = null;

    await ctx.reply(
      `✅ Bid of <b>$${amount}</b> submitted!\n\nThe dispatcher will review and contact you.`,
      { parse_mode: "HTML" }
    );
  });

  botInstance = bot;
  return bot;
}
