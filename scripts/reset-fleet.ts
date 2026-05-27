// Wipes ALL units, drivers, loads, owners, bids, notes, and driver locations.
// Keeps: User table (admin + other accounts), TelegramSession table.
// Use before running `prisma db push` to add new @unique constraints when
// existing data contains duplicates.
//
// Run with: npx tsx scripts/reset-fleet.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Show counts before deleting so the user can see what's about to go.
  const [bids, notes, loads, locs, drivers, units, owners] = await Promise.all([
    prisma.bid.count(),
    prisma.loadNote.count(),
    prisma.load.count(),
    prisma.driverLocation.count(),
    prisma.driver.count(),
    prisma.unit.count(),
    prisma.owner.count(),
  ]);

  console.log("About to delete:");
  console.log(`  ${bids} bids`);
  console.log(`  ${notes} load notes`);
  console.log(`  ${loads} loads`);
  console.log(`  ${locs} driver locations`);
  console.log(`  ${drivers} drivers`);
  console.log(`  ${units} units`);
  console.log(`  ${owners} owners`);
  console.log("Preserving: User accounts, TelegramSessions");
  console.log("");

  // Delete in FK-dependency order, all atomic.
  await prisma.$transaction([
    prisma.bid.deleteMany({}),
    prisma.loadNote.deleteMany({}),
    prisma.load.deleteMany({}),
    prisma.driverLocation.deleteMany({}),
    prisma.driver.deleteMany({}),
    prisma.unit.deleteMany({}),
    prisma.owner.deleteMany({}),
  ]);

  console.log("✓ Fleet data cleared. Next: prisma db push, then seed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
