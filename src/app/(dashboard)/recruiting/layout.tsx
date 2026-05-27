import { requireModule } from "@/lib/auth-helpers";

export default async function RecruitingLayout({ children }: { children: React.ReactNode }) {
  await requireModule("recruiting");
  return children;
}
