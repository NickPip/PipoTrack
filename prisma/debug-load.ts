import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const load = await prisma.load.findFirst({ orderBy: { loadNumber: "desc" } });
  console.log("Last load:", JSON.stringify(load, null, 2));

  const driver = await prisma.driver.findUnique({
    where: { id: "driver-nikoloz-test" },
    include: { unit: true },
  });
  console.log("\nNikoloz driver:", JSON.stringify(driver, null, 2));

  if (load && driver) {
    console.log("\n--- Door check ---");
    console.log(`Door 1: load.vehicleRequired="${load.vehicleRequired}" vs driver.vehicleType="${driver.vehicleType}"`);
    const d1 = load.vehicleRequired?.toLowerCase().trim() === driver.vehicleType?.toLowerCase().trim();
    console.log(`Door 1 result: ${d1}`);
    console.log(`Door 2: driver.isAvailable=${driver.isAvailable}, telegramId=${driver.telegramId}, unitId=${driver.unitId}`);
    console.log(`Load dims:`, load.dimensions);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
