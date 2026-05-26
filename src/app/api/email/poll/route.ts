import { NextRequest, NextResponse } from "next/server";
import { pollInbox } from "@/lib/email/imap";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Protect against public access — Vercel cron sends this header
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await pollInbox();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[email/poll]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
