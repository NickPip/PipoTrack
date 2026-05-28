import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { canAccess, canMutate, type Module } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

// Server-side page guard. Use in a layout.tsx to block a whole module subtree
// for users whose role lacks access. Without this, only the navbar hides the
// link — a user pasting the URL would still render the page shell.
export async function requireModule(module: Module): Promise<{ role: Role; userId: string; name: string }> {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role) redirect("/login");
  if (!canAccess(role, module)) redirect("/");
  return {
    role,
    userId: (session!.user as { id?: string }).id ?? "",
    name: session!.user?.name ?? "",
  };
}

// What a successful API guard hands back. Carrying userId/name means handlers
// that write audit notes don't have to re-derive them from the session.
export type AuthContext = {
  session: Session;
  role: Role;
  userId: string;
  name: string;
};

function context(session: Session): AuthContext {
  return {
    session,
    role: session.user.role,
    userId: session.user.id,
    name: session.user.name,
  };
}

// API route guard. Returns an AuthContext on success, or a NextResponse the
// caller must return directly:
//
//   const guard = await requireRole("dispatch", "mutate");
//   if (guard instanceof NextResponse) return guard;
//   // guard.role / guard.userId / guard.session available here
//
// Pass an array of modules for OR semantics (e.g. notes readable by operations
// OR accounting). A missing-or-insufficient role yields 403 — same status the
// inlined checks returned, so existing clients see no change.
export async function requireRole(
  module: Module | Module[],
  action: "read" | "mutate",
): Promise<AuthContext | NextResponse> {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const modules = Array.isArray(module) ? module : [module];
  const check = action === "read" ? canAccess : canMutate;
  if (!modules.some((m) => check(role, m))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return context(session!);
}

// Admin-only endpoints (Users management, Telegram webhook setup).
export async function requireAdmin(): Promise<AuthContext | NextResponse> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return context(session);
}

// Endpoints any signed-in user may hit regardless of module (e.g. the driver
// map). Returns 401 to match the existing behavior of those handlers.
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const session = await auth();
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return context(session);
}
