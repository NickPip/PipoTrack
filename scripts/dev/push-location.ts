import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config({ path: ".env.local" });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const zipcodes = require("zipcodes") as {
  lookup: (zip: string) => { latitude: number; longitude: number; city: string; state: string } | null;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const ZIP = "60515"; // Downers Grove, IL — near delivery address
  const coords = zipcodes.lookup(ZIP);
  if (!coords) { console.error("ZIP not found"); return; }

  // Slight offset so it's "near" but not exactly on the delivery pin
  const lat = coords.latitude  + 0.01;
  const lon = coords.longitude + 0.01;

  const driver = await prisma.driver.findFirst({ where: { name: { contains: "Nikoloz" } } });
  if (!driver) { console.error("Driver not found"); return; }

  await prisma.driverLocation.upsert({
    where:  { driverId: driver.id },
    update: { lat, lon, speed: 0, updatedAt: new Date() },
    create: { driverId: driver.id, lat, lon, speed: 0 },
  });

  console.log(`✓ Location set for ${driver.name}`);
  console.log(`  ZIP ${ZIP} → ${coords.city}, ${coords.state}`);
  console.log(`  lat: ${lat}, lon: ${lon}`);
  console.log(`\nRefresh Active Loads — Distance column should now show remaining miles.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
