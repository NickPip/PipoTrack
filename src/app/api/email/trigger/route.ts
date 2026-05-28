import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { pollInbox } from "@/lib/email/imap";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const guard = await requireRole("dispatch", "mutate");
  if (guard instanceof NextResponse) return guard;

  try {
    await pollInbox();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[email/trigger]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
