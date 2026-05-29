import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateAppToken } from "@/lib/driver-auth";
import { getLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Fixed dummy hash so a wrong username takes ~the same time as a wrong
// password — don't leak which usernames exist via timing.
const DUMMY_HASH_PROMISE = hash("driver-dummy-password-unused", 12);

// 10 attempts/min per username; a throttled response is indistinguishable
// from a bad credential (both return the same 401).
const loginLimiter = getLimiter("driver-login", 10, "1 m");

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const username = parsed.data.username.toLowerCase().trim();
  const { success } = await loginLimiter.limit(username);
  if (!success) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  // Case-insensitive lookup; always run compare against a real-or-dummy hash.
  const driver = await prisma.driver.findFirst({
    where: { appUsername: { equals: username, mode: "insensitive" } },
  });
  const passwordHash = driver?.appPassword ?? (await DUMMY_HASH_PROMISE);
  const valid = await compare(parsed.data.password, passwordHash);

  if (!driver || !driver.appPassword || !valid) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  // Rotate the token on every login so an old device session is invalidated.
  const token = generateAppToken();
  await prisma.driver.update({ where: { id: driver.id }, data: { appToken: token } });

  return NextResponse.json({
    token,
    driver: { id: driver.id, name: driver.name },
  });
}
