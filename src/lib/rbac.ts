import { Role } from "@/generated/prisma/enums";

type Module = "users" | "recruiting" | "dispatch" | "operations" | "accounting";

const ACCESS: Record<Role, Module[]> = {
  ADMIN: ["users", "recruiting", "dispatch", "operations", "accounting"],
  RECRUITING: ["recruiting"],
  DISPATCHER: ["dispatch"],
  OPERATIONS: ["operations"],
  ACCOUNTING: ["accounting", "operations"],
};

export function canAccess(role: Role, module: Module): boolean {
  return ACCESS[role]?.includes(module) ?? false;
}
