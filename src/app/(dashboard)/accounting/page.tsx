import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canAccess } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import AccountingTable from "@/components/accounting/AccountingTable";

export default async function AccountingPage() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;

  if (!role || !canAccess(role, "accounting")) redirect("/");

  const canEdit = role === "ACCOUNTING" || role === "ADMIN";

  return <AccountingTable canEdit={canEdit} />;
}
