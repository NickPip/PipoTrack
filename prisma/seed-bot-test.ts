import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find Nikoloz's driver record
  let driver = await prisma.driver.findFirst({
    where: { name: { contains: "Nikoloz" } },
    include: { unit: true },
  });

  if (!driver) {
    console.error("❌ Driver 'Nikoloz' not found.");
    return;
  }

  // Fill in vehicleType + currentZip if missing
  if (!driver.vehicleType || !driver.currentZip) {
    driver = await prisma.driver.update({
      where: { id: driver.id },
      data: {
        vehicleType: driver.vehicleType ?? "Cargo Van",
        currentZip: driver.currentZip ?? "30318",
        isAvailable: true,
      },
      include: { unit: true },
    });
    console.log(`✓ Updated driver → vehicleType: ${driver.vehicleType}, currentZip: ${driver.currentZip}`);
  }

  console.log(`✓ Driver: ${driver.name}`);
  console.log(`  vehicleType : ${driver.vehicleType}`);
  console.log(`  currentZip  : ${driver.currentZip}`);
  console.log(`  telegramId  : ${driver.telegramId}`);

  // Wipe any old test bids/loads from previous runs
  await prisma.bid.deleteMany({ where: { load: { brokerReference: "TEST-001" } } });
  await prisma.load.deleteMany({ where: { brokerReference: "TEST-001" } });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const load = await prisma.load.create({
    data: {
      status: "PENDING_DISTRIBUTION",
      broker: "Test Broker LLC",
      brokerName: "John Smith",
      brokerEmail: "john@testbroker.com",
      brokerPhone: "+1 (555) 999-0000",
      brokerReference: "TEST-001",
      pickupAddress: "123 Main St, Atlanta, GA 30318",
      pickupZip: "30318",
      pickupDate: tomorrow,
      pickupNotes: "Driver must have PPE",
      deliveryAddress: "456 Peachtree Rd, Miami, FL 33131",
      deliveryZip: "33131",
      deliveryDate: dayAfter,
      miles: 662,
      weight: 500,
      dimensions: { pieces: 2, L: 48, W: 48, H: 48 },
      vehicleRequired: driver.vehicleType!,
      rate: 400,
    },
  });

  console.log(`\n✓ Load created: #${load.loadNumber} (${load.id})`);

  console.log("📤 Sending to Telegram...");
  const { sendLoadToDriver } = await import("../src/bot/sendLoad");
  await sendLoadToDriver(load.id, driver.id);

  console.log("✅ Done — check your Telegram!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
