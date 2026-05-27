import { requireModule } from "@/lib/auth-helpers";

export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  await requireModule("accounting");
  return children;
}
