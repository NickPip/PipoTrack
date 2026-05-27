import { requireModule } from "@/lib/auth-helpers";

export default async function DispatchLayout({ children }: { children: React.ReactNode }) {
  await requireModule("dispatch");
  return children;
}
