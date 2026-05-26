import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { pollInbox } from "@/lib/email/imap";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role || !canAccess(role, "dispatch")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await pollInbox();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[email/trigger]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
