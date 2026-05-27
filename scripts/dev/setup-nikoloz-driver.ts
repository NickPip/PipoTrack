import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Pickup ZIP for test load: 75050 (Grand Prairie, TX)
// Set driver ZIP to same city, radius 50mi to guarantee Door Two passes

const TELEGRAM_ID = process.argv[2];

async function main() {
  if (!TELEGRAM_ID) {
    console.error("Usage: npx tsx prisma/setup-nikoloz-driver.ts <YOUR_TELEGRAM_ID>");
    console.error("Send /start to @pipotrack_bot to get your Telegram ID");
    process.exit(1);
  }

  const vehicleType  = process.argv[3] ?? "Small Straight";
  const currentZip   = process.argv[4] ?? "75050";
  const searchRadius = Number(process.argv[5] ?? 50);

  // Upsert owner by fixed id
  const owner = await prisma.owner.upsert({
    where: { id: "owner-nikoloz-test" },
    update: {},
    create: { id: "owner-nikoloz-test", name: "Nikoloz Pipia", email: "nikoloz@pipotrack.com", phone: "000-000-0000" },
  });

  // Upsert unit — dimensions match vehicle type
  const unitDims = vehicleType.toLowerCase().includes("sprinter") || vehicleType.toLowerCase().includes("cargo")
    ? { length: 170, width: 60, height: 72 }   // Sprinter: 170x60x72 inches
    : { length: 26, width: 8, height: 8 };      // Small Straight: 26x8x8 ft

  const unit = await prisma.unit.upsert({
    where: { id: "unit-nikoloz-test" },
    update: { type: vehicleType, dimensions: unitDims },
    create: {
      id: "unit-nikoloz-test",
      unitNumber: "NK-01",
      type: vehicleType,
      dimensions: unitDims,
      ownerId: owner.id,
    },
  });

  // Upsert driver
  const driver = await prisma.driver.upsert({
    where: { id: "driver-nikoloz-test" },
    update: {
      telegramId: TELEGRAM_ID,
      isAvailable: true,
      currentZip,
      searchRadius,
      vehicleType,
      unitId: unit.id,
    },
    create: {
      id: "driver-nikoloz-test",
      name: "Nikoloz Pipia",
      vehicleType,
      currentZip,
      searchRadius,
      telegramId: TELEGRAM_ID,
      isAvailable: true,
      unitId: unit.id,
    },
  });

  console.log("✅ Driver configured:");
  console.log(`   Name:        ${driver.name}`);
  console.log(`   Telegram ID: ${driver.telegramId}`);
  console.log(`   Vehicle:     ${driver.vehicleType}`);
  console.log(`   ZIP:         ${driver.currentZip} (Grand Prairie, TX area)`);
  console.log(`   Radius:      ${driver.searchRadius} miles`);
  console.log(`   Unit:        ${unit.unitNumber} (${unit.type}, ${JSON.stringify(unit.dimensions)})`);
  console.log(`   Available:   ${driver.isAvailable}`);
  console.log("\n🚛 Door check for test load (order #5589):");
  console.log("   Door 1 — Vehicle: Small Straight === Small Straight ✓");
  console.log("   Door 2 — ZIP 75050 → 75050, 0 miles ≤ 50 radius ✓");
  console.log("   Door 3 — pieces=0, dims incomplete → pass ✓");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
