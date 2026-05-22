import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/enums";

const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/users",
  DISPATCHER: "/dispatch/bot",
  OPERATIONS: "/operations/active",
  RECRUITING: "/recruiting/units",
  ACCOUNTING: "/accounting",
};

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  redirect(ROLE_HOME[session.user.role as Role] ?? "/login");
}
