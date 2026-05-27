import { Role } from "@/generated/prisma/enums";

export type Module = "users" | "recruiting" | "dispatch" | "operations" | "accounting";

// Read access — drives navbar visibility and GET endpoints.
const ACCESS: Record<Role, Module[]> = {
  ADMIN: ["users", "recruiting", "dispatch", "operations", "accounting"],
  RECRUITING: ["recruiting"],
  DISPATCHER: ["dispatch"],
  OPERATIONS: ["operations"],
  ACCOUNTING: ["accounting", "operations"],
};

// Write access — tighter than read. ACCOUNTING can READ operations (to see loads
// for billing) but must NOT mutate logistics status. Only OPERATIONS+ADMIN do
// that per CLAUDE.md spec. Likewise only ACCOUNTING+ADMIN may mutate financials.
const MUTATE: Record<Role, Module[]> = {
  ADMIN: ["users", "recruiting", "dispatch", "operations", "accounting"],
  RECRUITING: ["recruiting"],
  DISPATCHER: ["dispatch"],
  OPERATIONS: ["operations"],
  ACCOUNTING: ["accounting"],
};

export function canAccess(role: Role, module: Module): boolean {
  return ACCESS[role]?.includes(module) ?? false;
}

export function canMutate(role: Role, module: Module): boolean {
  return MUTATE[role]?.includes(module) ?? false;
}
