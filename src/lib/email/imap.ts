import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { parseSylectusEmail } from "./parser";
import { prisma } from "@/lib/prisma";
import { LoadStatus } from "@/generated/prisma/enums";

const SYLECTUS_SENDER = "postedloads@sylectus.com";

function createClient() {
  return new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    logger: false,
  });
}

async function processMessage(source: Buffer) {
  const parsed = await simpleParser(source);

  const from = parsed.from?.value?.[0]?.address ?? "";
  if (!from.toLowerCase().includes(SYLECTUS_SENDER)) return;

  const html = typeof parsed.html === "string" ? parsed.html : "";
  if (!html) return;

  const load = parseSylectusEmail(html);

  if (!load.pickupAddress || !load.deliveryAddress || !load.pickupDate || !load.deliveryDate) {
    console.warn("[email] Skipping — missing required fields:", load.brokerReference);
    return;
  }

  // Skip duplicates by broker reference
  if (load.brokerReference) {
    const existing = await prisma.load.findFirst({
      where: { brokerReference: load.brokerReference },
      select: { id: true },
    });
    if (existing) {
      console.log(`[email] Duplicate order #${load.brokerReference}, skipping`);
      return;
    }
  }

  const hasDimensions = load.pieces || load.dimensionL;

  const saved = await prisma.load.create({
    data: {
      broker:          load.broker          ?? "Unknown",
      brokerReference: load.brokerReference ?? null,
      pickupAddress:   load.pickupAddress,
      pickupZip:       load.pickupZip       ?? null,
      pickupDate:      load.pickupDate,
      deliveryAddress: load.deliveryAddress,
      deliveryDate:    load.deliveryDate,
      miles:           load.miles           ?? null,
      rate:            load.rate            ?? null,
      vehicleRequired: load.vehicleRequired ?? null,
      weight:          load.weight          ?? null,
      dimensions:      hasDimensions
        ? { pieces: load.pieces, L: load.dimensionL, W: load.dimensionW, H: load.dimensionH }
        : undefined,
      status: LoadStatus.PENDING,
    },
  });

  console.log(`[email] Load #${saved.loadNumber} created from order #${load.brokerReference}`);
  return saved;
}

export async function pollInbox() {
  const client = createClient();
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    const result = await client.search({ from: SYLECTUS_SENDER, seen: false });
    const uids = Array.isArray(result) ? result : [];

    if (!uids.length) {
      console.log("[email] No new Sylectus emails");
      return;
    }

    console.log(`[email] Processing ${uids.length} new email(s)`);

    for await (const msg of client.fetch(uids, { source: true })) {
      if (!msg.source) continue;
      try {
        await processMessage(msg.source);
        await client.messageFlagsAdd(msg.seq, ["\\Seen"]);
      } catch (err) {
        console.error("[email] Failed to process message:", err);
      }
    }
  } finally {
    await client.logout();
  }
}

// Long-running IDLE listener — use this in the bot process
export async function startIdleListener() {
  console.log("[email] Starting IDLE listener...");

  const reconnect = async () => {
    const client = createClient();
    try {
      await client.connect();
      await client.mailboxOpen("INBOX");
      console.log("[email] IDLE listener connected");

      // Catch up on any emails that arrived while offline
      await pollInbox();

      client.on("exists", async () => {
        console.log("[email] New mail detected");
        await pollInbox();
      });

      await client.idle();
    } catch (err) {
      console.error("[email] IDLE error, reconnecting in 30s:", err);
      setTimeout(reconnect, 30_000);
    }
  };

  await reconnect();
}
