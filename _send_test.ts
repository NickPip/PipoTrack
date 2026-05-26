import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never);

async function main() {
  const driver = await prisma.driver.findFirst({
    where: { name: { contains: "Nikoloz", mode: "insensitive" } },
    select: { id: true, name: true, telegramId: true },
  });

  if (!driver) { console.log("No driver found"); return; }

  // Create a temporary test load
  const load = await prisma.load.create({
    data: {
      status: "PENDING_DISTRIBUTION",
      broker: "TEST Broker",
      brokerEmail: "test@broker.com",
      brokerReference: "TEST-001",
      pickupAddress: "123 Test St, Atlanta, GA",
      pickupZip: "30301",
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      deliveryAddress: "456 Delivery Ave, Miami, FL",
      deliveryZip: "33101",
      deliveryDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
      vehicleRequired: "Cargo Van",
      miles: 662,
      weight: 800,
      dimensions: { pieces: 4, L: 48, W: 40, H: 36 },
    },
  });

  console.log(`Created test load #${load.loadNumber} (${load.id})`);

  const { sendLoadToDriver } = await import("./src/bot/sendLoad");
  await sendLoadToDriver(load.id, driver.id);
  console.log(`Sent to ${driver.name} (TG: ${driver.telegramId})`);
  console.log(`\nTo delete the test load run:\nnpx tsx -e "import {PrismaClient} from './src/generated/prisma/client';import {PrismaPg} from '@prisma/adapter-pg';import 'dotenv/config';const p=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})} as never);p.load.delete({where:{id:'${load.id}'}}).then(()=>{console.log('deleted');p.\$disconnect();});"`);
}

main().finally(() => prisma.$disconnect());
