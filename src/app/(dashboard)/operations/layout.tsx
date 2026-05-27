import { requireModule } from "@/lib/auth-helpers";

export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  await requireModule("operations");
  return children;
}
