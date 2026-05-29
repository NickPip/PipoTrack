import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { parseSylectusEmail } from "./parser";
import { prisma } from "@/lib/prisma";
import { LoadStatus } from "@/generated/prisma/enums";
import { findMatchingDrivers, sendLoadToMatchedDrivers } from "@/bot/sendLoad";

const LOAD_SENDER = process.env.LOAD_EMAIL_SENDER ?? "postedloads@sylectus.com";
// Max emails processed in parallel — keeps DB + Telegram pressure manageable
const PROCESS_CONCURRENCY = 5;

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
  if (!from.toLowerCase().includes(LOAD_SENDER.toLowerCase())) return;

  const html = typeof parsed.html === "string" ? parsed.html : "";
  const text = typeof parsed.text === "string" ? parsed.text : "";
  if (!html && !text) return;

  const load = parseSylectusEmail(html, text);

  if (!load.pickupAddress || !load.deliveryAddress || !load.pickupDate || !load.deliveryDate) {
    console.warn("[email] Skipping — missing required fields:", load.brokerReference);
    return;
  }

  const hasDimensions = load.pieces || load.dimensionL;
  const loadDims = hasDimensions
    ? { pieces: load.pieces, L: load.dimensionL, W: load.dimensionW, H: load.dimensionH }
    : null;

  // Match BEFORE persisting: at this volume most emails match no available
  // driver, so we run the 3 Doors first and only keep a load that at least one
  // driver can take. Drops the rest instead of filling the table with dead rows.
  const matches = await findMatchingDrivers({
    vehicleRequired: load.vehicleRequired ?? null,
    pickupZip: load.pickupZip ?? null,
    dimensions: loadDims,
  });

  if (matches.length === 0) {
    console.log(`[email] No available driver for order #${load.brokerReference ?? "?"} — not saved`);
    return;
  }

  const saved = await prisma.load.create({
    data: {
      broker:          load.broker          ?? "Unknown",
      brokerName:      load.brokerContact   ?? null,
      brokerEmail:     load.brokerEmail     ?? null,
      brokerPhone:     load.brokerPhone     ?? null,
      brokerReference: load.brokerReference ?? null,
      pickupAddress:   load.pickupAddress,
      pickupZip:       load.pickupZip       ?? null,
      pickupDate:      load.pickupDate,
      deliveryAddress: load.deliveryAddress,
      deliveryZip:     load.deliveryZip     ?? null,
      deliveryDate:    load.deliveryDate,
      miles:           load.miles           ?? null,
      rate:            load.rate            ?? null,
      vehicleRequired: load.vehicleRequired ?? null,
      weight:          load.weight          ?? null,
      dimensions:      loadDims ?? undefined,
      status: LoadStatus.PENDING_DISTRIBUTION,
    },
  });

  console.log(`[email] Load #${saved.loadNumber} created from order #${load.brokerReference}`);

  const sent = await sendLoadToMatchedDrivers(saved, matches);
  console.log(`[email] Load #${saved.loadNumber} sent to ${sent} matched driver(s)`);

  return saved;
}

// Runs up to `limit` async tasks concurrently
async function runConcurrent<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

let polling = false;
let pollPending = false; // emails arrived while a poll was running — re-poll immediately after

export async function pollInbox() {
  if (polling) {
    pollPending = true; // don't drop these — re-poll when current finishes
    return;
  }
  polling = true;
  pollPending = false;

  const client = createClient();
  client.on("error", (err: Error) => {
    console.error("[email] IMAP poll error:", err.message);
  });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    const result = await client.search({ from: LOAD_SENDER, seen: false });
    const uids = Array.isArray(result) ? result : [];

    if (!uids.length) {
      console.log("[email] No new load emails");
      return;
    }

    console.log(`[email] Processing ${uids.length} new email(s)`);

    // Collect all message sources first, then process concurrently
    const messages: { seq: number; source: Buffer }[] = [];
    for await (const msg of client.fetch(uids, { source: true })) {
      if (msg.source) messages.push({ seq: msg.seq, source: msg.source });
    }

    await runConcurrent(messages, PROCESS_CONCURRENCY, async ({ seq, source }) => {
      try {
        await processMessage(source);
        await client.messageFlagsAdd(seq, ["\\Seen"]);
      } catch (err) {
        console.error("[email] Failed to process message:", err);
      }
    });
  } finally {
    polling = false;
    try { await client.logout(); } catch { /* ignore */ }
    // Emails arrived while we were busy — immediately pick them up
    if (pollPending) {
      pollPending = false;
      pollInbox();
    }
  }
}

// Long-running IDLE listener — LOCAL DEV / SELF-HOSTED ONLY.
//
// Vercel serverless functions are short-lived (max 300s) and don't preserve
// open sockets between invocations, so the IMAP IDLE connection here would
// die immediately in production. This export is only called from
// src/bot/dev.ts which is meant to run as a long-lived local process.
//
// Production uses cron-job.org (external) to hit GET /api/email/poll on a
// schedule; that's what actually pulls new emails in deployed environments.
export async function startIdleListener() {
  console.log("[email] Starting IDLE listener...");

  const reconnect = async () => {
    const client = createClient();
    let scheduled = false;
    const scheduleReconnect = () => {
      if (!scheduled) {
        scheduled = true;
        setTimeout(reconnect, 30_000);
      }
    };

    client.on("error", (err: Error) => {
      console.error("[email] IDLE socket error, reconnecting in 30s:", err.message);
      scheduleReconnect();
    });
    try {
      await client.connect();
      await client.mailboxOpen("INBOX");
      console.log("[email] IDLE listener connected");

      await pollInbox();

      client.on("exists", async () => {
        console.log("[email] New mail detected");
        await pollInbox();
      });

      await client.idle();
    } catch (err) {
      console.error("[email] IDLE error, reconnecting in 30s:", err);
      try { await client.logout(); } catch { /* ignore */ }
      scheduleReconnect();
    }
  };

  await reconnect();
}
