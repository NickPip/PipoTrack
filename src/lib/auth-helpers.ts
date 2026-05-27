import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess, type Module } from "@/lib/rbac";
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
