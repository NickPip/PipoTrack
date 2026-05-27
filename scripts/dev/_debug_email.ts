import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { parseSylectusEmail } from "./src/lib/email/parser";
import { config } from "dotenv";
config({ path: ".env.local" });

const SENDER = process.env.LOAD_EMAIL_SENDER!;

async function main() {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
    logger: false,
  });

  await client.connect();
  await client.mailboxOpen("INBOX");

  // Fetch the latest email from sender (seen or unseen)
  const uids = await client.search({ from: SENDER });
  if (!uids.length) { console.log("No emails found from", SENDER); return; }

  const latest = [uids[uids.length - 1]];

  for await (const msg of client.fetch(latest, { source: true })) {
    const parsed = await simpleParser(msg.source!);
    const html = typeof parsed.html === "string" ? parsed.html : "";

    console.log("=== RAW TEXT (first 3000 chars) ===");
    console.log(parsed.text?.slice(0, 3000));

    console.log("\n=== PARSED RESULT ===");
    const result = parseSylectusEmail(html, parsed.text ?? "");
    console.log(JSON.stringify(result, null, 2));
  }

  await client.logout();
}

main().catch(console.error);
