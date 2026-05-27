import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never);
(globalThis as never as { prisma: PrismaClient }).prisma = prisma;

async function main() {
  console.log("Connecting to Gmail:", process.env.GMAIL_USER);
  const { pollInbox } = await import("./src/lib/email/imap");
  await pollInbox();
  console.log("Done.");
}

main().finally(() => prisma.$disconnect());
