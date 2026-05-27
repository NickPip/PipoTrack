import { requireModule } from "@/lib/auth-helpers";

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  await requireModule("users");
  return children;
}
