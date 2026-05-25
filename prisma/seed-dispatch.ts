import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const drivers = await prisma.driver.findMany({ include: { unit: true } });
  if (drivers.length === 0) {
    console.error("No drivers found. Run the main seed first: npx tsx prisma/seed.ts");
    process.exit(1);
  }

  const now = new Date();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000);

  // ── Helper: pick N random drivers ───────────────────────────────────────────
  const pick = (n: number) => [...drivers].sort(() => Math.random() - 0.5).slice(0, n);

  // ── PENDING_DISTRIBUTION loads (All tab — sent to drivers, no bids yet) ─────
  const pendingLoads = await Promise.all([
    prisma.load.create({
      data: {
        status: "PENDING_DISTRIBUTION",
        broker: "Nolan Transportation Group, Inc",
        brokerName: "Mukesh Kumar",
        brokerEmail: "Mukesh.Kumar@ntgfreight.com",
        brokerPhone: "404.777.3216",
        brokerReference: "1173107",
        pickupAddress: "DFW, TX",
        pickupZip: "75261",
        pickupDate: hoursFromNow(2),
        deliveryAddress: "Almont, MI",
        deliveryZip: "48003",
        deliveryDate: hoursFromNow(28),
        miles: 1218,
        weight: 2880,
        vehicleRequired: "Small Straight",
        dimensions: { pieces: 18, L: 50, W: 20, H: 20 },
        stackable: false,
        createdAt: minsAgo(8),
      },
    }),
    prisma.load.create({
      data: {
        status: "PENDING_DISTRIBUTION",
        broker: "HGHHWR & SCHWARTZ",
        brokerName: "Daniel Schwartz",
        brokerEmail: "hghhwr&schwartz@areawidelogistics.com",
        brokerPhone: "312.555.0192",
        brokerReference: "60007529",
        pickupAddress: "Chicago, IL",
        pickupZip: "60601",
        pickupDate: hoursFromNow(4),
        deliveryAddress: "Memphis, TN",
        deliveryZip: "38106",
        deliveryDate: hoursFromNow(18),
        miles: 530,
        weight: 1200,
        vehicleRequired: "Cargo Van",
        dimensions: { pieces: 6, L: 48, W: 40, H: 36 },
        stackable: true,
        createdAt: minsAgo(12),
      },
    }),
    prisma.load.create({
      data: {
        status: "PENDING_DISTRIBUTION",
        broker: "Echo Global Logistics",
        brokerName: "Sara Mitchell",
        brokerEmail: "sara.mitchell@echo.com",
        brokerPhone: "800.354.7993",
        brokerReference: "ECH-887421",
        pickupAddress: "Atlanta, GA",
        pickupZip: "30318",
        pickupDate: hoursFromNow(6),
        deliveryAddress: "Charlotte, NC",
        deliveryZip: "28202",
        deliveryDate: hoursFromNow(20),
        miles: 245,
        weight: 3400,
        vehicleRequired: "Sprinter Van",
        dimensions: { pieces: 12, L: 36, W: 24, H: 30 },
        stackable: true,
        createdAt: minsAgo(20),
      },
    }),
  ]);

  // Create N/A bids (sent but no response) for pending loads
  for (const load of pendingLoads) {
    const sent = pick(Math.floor(Math.random() * 3) + 3);
    await Promise.all(
      sent.map((d) =>
        prisma.bid.create({
          data: { loadId: load.id, driverId: d.id, amount: 0, status: "pending" },
        })
      )
    );
  }

  console.log("✓ PENDING_DISTRIBUTION loads + pending bids created");

  // ── HAS_BIDS loads (New tab — at least one driver placed a bid) ─────────────
  const bidLoads = await Promise.all([
    prisma.load.create({
      data: {
        status: "HAS_BIDS",
        broker: "Coyote Logistics",
        brokerName: "James Holloway",
        brokerEmail: "james.holloway@coyote.com",
        brokerPhone: "877.266.9835",
        brokerReference: "COY-558831",
        pickupAddress: "Dallas, TX",
        pickupZip: "75201",
        pickupDate: hoursFromNow(3),
        deliveryAddress: "Nashville, TN",
        deliveryZip: "37201",
        deliveryDate: hoursFromNow(14),
        miles: 663,
        weight: 5600,
        vehicleRequired: "Small Straight",
        dimensions: { pieces: 22, L: 48, W: 36, H: 48 },
        stackable: false,
        createdAt: minsAgo(45),
      },
    }),
    prisma.load.create({
      data: {
        status: "HAS_BIDS",
        broker: "TQL",
        brokerName: "Rachel Greene",
        brokerEmail: "rgreene@tql.com",
        brokerPhone: "800.580.3101",
        brokerReference: "TQL-994402",
        pickupAddress: "Miami, FL",
        pickupZip: "33101",
        pickupDate: hoursFromNow(5),
        deliveryAddress: "Jacksonville, FL",
        deliveryZip: "32099",
        deliveryDate: hoursFromNow(12),
        miles: 340,
        weight: 2100,
        vehicleRequired: "Sprinter Van",
        dimensions: { pieces: 9, L: 40, W: 28, H: 32 },
        stackable: true,
        createdAt: minsAgo(60),
      },
    }),
    prisma.load.create({
      data: {
        status: "HAS_BIDS",
        broker: "Landstar System",
        brokerName: "Kevin Torres",
        brokerEmail: "kevin.torres@landstar.com",
        brokerPhone: "800.872.9400",
        brokerReference: "LND-774190",
        pickupAddress: "Houston, TX",
        pickupZip: "77001",
        pickupDate: hoursFromNow(8),
        deliveryAddress: "San Antonio, TX",
        deliveryZip: "78201",
        deliveryDate: hoursFromNow(16),
        miles: 198,
        weight: 4800,
        vehicleRequired: "Cargo Van",
        dimensions: { pieces: 14, L: 44, W: 30, H: 28 },
        stackable: false,
        createdAt: minsAgo(90),
      },
    }),
  ]);

  // Create mixed bids (pending = bid placed, skipped, pending = no response)
  for (const load of bidLoads) {
    const allDrivers = pick(drivers.length);
    await Promise.all(
      allDrivers.map((d, i) => {
        const isBidder = i < 2;
        const isSkipped = i === 2;
        return prisma.bid.create({
          data: {
            loadId: load.id,
            driverId: d.id,
            amount: isBidder ? Math.floor(Math.random() * 200 + 250) : 0,
            status: isBidder ? "accepted" : isSkipped ? "skipped" : "pending",
          },
        });
      })
    );
  }

  console.log("✓ HAS_BIDS loads + mixed bids created");

  // ── QUOTED loads (Quoted tab — dispatcher set their price) ──────────────────
  const quotedLoads = await Promise.all([
    prisma.load.create({
      data: {
        status: "QUOTED",
        broker: "XPO Logistics",
        brokerName: "Andrea Collins",
        brokerEmail: "andrea.collins@xpo.com",
        brokerPhone: "855.976.6888",
        brokerReference: "XPO-331882",
        pickupAddress: "Detroit, MI",
        pickupZip: "48201",
        pickupDate: hoursFromNow(10),
        deliveryAddress: "Columbus, OH",
        deliveryZip: "43215",
        deliveryDate: hoursFromNow(18),
        miles: 165,
        weight: 3200,
        vehicleRequired: "Cargo Van",
        rate: 820,
        driverRate: 580,
        dimensions: { pieces: 8, L: 36, W: 30, H: 30 },
        stackable: true,
        createdAt: minsAgo(120),
      },
    }),
    prisma.load.create({
      data: {
        status: "QUOTED",
        broker: "Uber Freight",
        brokerName: "Marcus Reid",
        brokerEmail: "marcus.reid@uberfreight.com",
        brokerPhone: "833.822.3237",
        brokerReference: "UBR-665509",
        pickupAddress: "Phoenix, AZ",
        pickupZip: "85001",
        pickupDate: hoursFromNow(12),
        deliveryAddress: "Las Vegas, NV",
        deliveryZip: "89101",
        deliveryDate: hoursFromNow(20),
        miles: 297,
        weight: 1800,
        vehicleRequired: "Sprinter Van",
        rate: 1150,
        driverRate: 790,
        dimensions: { pieces: 5, L: 60, W: 24, H: 24 },
        stackable: false,
        createdAt: minsAgo(150),
      },
    }),
  ]);

  for (const load of quotedLoads) {
    const sent = pick(4);
    await Promise.all(
      sent.map((d, i) =>
        prisma.bid.create({
          data: {
            loadId: load.id,
            driverId: d.id,
            amount: i === 0 ? Math.floor(Math.random() * 150 + 200) : 0,
            status: i === 0 ? "accepted" : i < 3 ? "skipped" : "pending",
          },
        })
      )
    );
  }

  console.log("✓ QUOTED loads + bids created");
  console.log("\n✅ Dispatch seed complete");
  console.log(`   ${pendingLoads.length} PENDING_DISTRIBUTION (All tab)`);
  console.log(`   ${bidLoads.length} HAS_BIDS (New tab)`);
  console.log(`   ${quotedLoads.length} QUOTED (Quoted tab)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
