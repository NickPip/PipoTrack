import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Admin user ─────────────────────────────────────────────────────────────
  const password = await hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@pipotrack.com" },
    update: {},
    create: {
      name: "Admin",
      surname: "User",
      email: "admin@pipotrack.com",
      password,
      idNumber: "ADMIN001",
      role: "ADMIN",
      phoneNumber: "+1000000000",
    },
  });

  // ── Owners ─────────────────────────────────────────────────────────────────
  const [owner1, owner2, owner3] = await Promise.all([
    prisma.owner.create({
      data: {
        name: "Carlos Mendez",
        company: "Mendez Logistics LLC",
        email: "carlos@mendezlogistics.com",
        phone: "+1 (305) 555-0101",
        address: "1204 SW 8th St, Miami, FL 33135",
      },
    }),
    prisma.owner.create({
      data: {
        name: "Anna Kowalski",
        company: "AK Transport Inc",
        email: "anna@aktransport.com",
        phone: "+1 (773) 555-0188",
        address: "4500 N Kedzie Ave, Chicago, IL 60625",
      },
    }),
    prisma.owner.create({
      data: {
        name: "James Okafor",
        company: "Okafor Freight Services",
        email: "james@okaforfreight.com",
        phone: "+1 (404) 555-0247",
        address: "890 Peachtree St NE, Atlanta, GA 30309",
      },
    }),
  ]);

  console.log("✓ Owners created");

  // ── Units ──────────────────────────────────────────────────────────────────
  const [unit1, unit2, unit3, unit4] = await Promise.all([
    prisma.unit.create({
      data: {
        unitNumber: "U-001",
        type: "Sprinter Van",
        make: "Mercedes-Benz",
        model: "Sprinter 2500",
        year: "2022",
        vin: "WD3PE8CD5JP123456",
        plateNumber: "FL-SV2022",
        ownerId: owner1.id,
        payload: 3500,
        equipment: ["PPE", "E-TRACK", "STRAPS"],
        dimensions: { length: 170, width: 70, height: 72 },
      },
    }),
    prisma.unit.create({
      data: {
        unitNumber: "U-002",
        type: "Cargo Van",
        make: "Ford",
        model: "Transit 250",
        year: "2021",
        vin: "1FTBR1C82MKA78901",
        plateNumber: "IL-CV2021",
        ownerId: owner2.id,
        payload: 3200,
        equipment: ["DOLLY", "BLANKETS", "STRAPS"],
        dimensions: { length: 148, width: 60, height: 65 },
      },
    }),
    prisma.unit.create({
      data: {
        unitNumber: "U-003",
        type: "Small Straight",
        make: "Isuzu",
        model: "NPR-HD",
        year: "2020",
        vin: "JALC4B16XK7234567",
        plateNumber: "GA-SS2020",
        ownerId: owner3.id,
        payload: 10000,
        equipment: ["E-TRACK", "DOLLY", "BLANKETS", "STRAPS"],
        dimensions: { length: 240, width: 96, height: 90 },
      },
    }),
    prisma.unit.create({
      data: {
        unitNumber: "U-004",
        type: "Large Straight",
        make: "Freightliner",
        model: "M2 106",
        year: "2023",
        vin: "3ALACWDT8PDGE9012",
        plateNumber: "FL-LS2023",
        ownerId: owner1.id,
        payload: 26000,
        equipment: ["PPE", "E-TRACK", "DOLLY", "BLANKETS", "STRAPS"],
        dimensions: { length: 288, width: 96, height: 96 },
      },
    }),
  ]);

  console.log("✓ Units created");

  // ── Drivers ────────────────────────────────────────────────────────────────
  const [driver1, driver2, driver3, driver4, driver5] = await Promise.all([
    prisma.driver.create({
      data: {
        name: "Marcus Williams",
        phone: "+1 (305) 555-0312",
        address: "220 NW 3rd Ave, Miami, FL 33128",
        vehicleType: "Sprinter Van",
        currentZip: "33135",
        searchRadius: 150,
        citizenshipType: "US Citizen",
        cleanBackground: true,
        unitId: unit1.id,
      },
    }),
    prisma.driver.create({
      data: {
        name: "Elena Vasquez",
        phone: "+1 (305) 555-0411",
        address: "789 Brickell Ave, Miami, FL 33131",
        vehicleType: "Sprinter Van",
        currentZip: "33101",
        searchRadius: 200,
        citizenshipType: "Green Card",
        cleanBackground: true,
        unitId: unit1.id,
      },
    }),
    prisma.driver.create({
      data: {
        name: "David Kowalczyk",
        phone: "+1 (773) 555-0519",
        address: "1100 N Lake Shore Dr, Chicago, IL 60611",
        vehicleType: "Cargo Van",
        currentZip: "60625",
        searchRadius: 100,
        citizenshipType: "US Citizen",
        cleanBackground: true,
        unitId: unit2.id,
      },
    }),
    prisma.driver.create({
      data: {
        name: "Fatima Diallo",
        phone: "+1 (404) 555-0628",
        address: "302 Auburn Ave NE, Atlanta, GA 30303",
        vehicleType: "Small Straight",
        currentZip: "30309",
        searchRadius: 250,
        citizenshipType: "US Citizen",
        cleanBackground: true,
        unitId: unit3.id,
      },
    }),
    prisma.driver.create({
      data: {
        name: "Robert Stevenson",
        phone: "+1 (305) 555-0734",
        address: "500 Biscayne Blvd, Miami, FL 33132",
        vehicleType: "Large Straight",
        currentZip: "33130",
        searchRadius: 300,
        citizenshipType: "US Citizen",
        cleanBackground: false,
        unitId: unit4.id,
      },
    }),
    prisma.driver.create({
      data: {
        name: "Priya Nair",
        phone: "+1 (312) 555-0845",
        address: "600 W Chicago Ave, Chicago, IL 60654",
        vehicleType: "Cargo Van",
        currentZip: "60601",
        searchRadius: 120,
        citizenshipType: "Green Card",
        cleanBackground: true,
      },
    }),
  ]);

  console.log("✓ Drivers created");

  // ── Loads ──────────────────────────────────────────────────────────────────
  const now = new Date();
  const d = (offsetDays: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offsetDays);
    return date;
  };

  await Promise.all([
    // Active — Pending
    prisma.load.create({
      data: {
        status: "PENDING",
        financialStatus: "UNPAID",
        broker: "Coyote Logistics",
        brokerReference: "COY-2026-0001",
        pickupAddress: "1200 Fulton Ave, Atlanta, GA 30318",
        pickupZip: "30318",
        pickupDate: d(1),
        deliveryAddress: "450 Brickell Ave, Miami, FL 33131",
        deliveryDate: d(2),
        rate: 1850,
        driverRate: 1300,
        miles: 662,
        weight: 4200,
        vehicleRequired: "Sprinter Van",
        driverId: driver1.id,
        unitId: unit1.id,
      },
    }),
    // Active — Dispatched to Pickup
    prisma.load.create({
      data: {
        status: "DISPATCHED_TO_PICKUP",
        financialStatus: "UNPAID",
        broker: "Echo Global Logistics",
        brokerReference: "ECH-2026-4412",
        pickupAddress: "2800 S Halsted St, Chicago, IL 60608",
        pickupZip: "60608",
        pickupDate: d(0),
        deliveryAddress: "3001 NW 25th St, Miami, FL 33142",
        deliveryDate: d(2),
        rate: 2400,
        driverRate: 1700,
        miles: 1378,
        weight: 2800,
        vehicleRequired: "Cargo Van",
        driverId: driver3.id,
        unitId: unit2.id,
      },
    }),
    // Active — OnSite for Pickup
    prisma.load.create({
      data: {
        status: "ONSITE_FOR_PICKUP",
        financialStatus: "UNPAID",
        broker: "XPO Logistics",
        brokerReference: "XPO-2026-8831",
        pickupAddress: "900 Circle 75 Pkwy, Atlanta, GA 30339",
        pickupZip: "30339",
        pickupDate: d(0),
        deliveryAddress: "1 Infinite Loop, Austin, TX 78701",
        deliveryDate: d(3),
        rate: 3100,
        driverRate: 2200,
        miles: 921,
        weight: 8500,
        vehicleRequired: "Small Straight",
        driverId: driver4.id,
        unitId: unit3.id,
      },
    }),
    // Active — Loaded and Delivering
    prisma.load.create({
      data: {
        status: "LOADED_AND_DELIVERING",
        financialStatus: "UNPAID",
        broker: "TQL",
        brokerReference: "TQL-2026-5519",
        pickupAddress: "500 Airport Blvd, Miami, FL 33166",
        pickupZip: "33166",
        pickupDate: d(-1),
        deliveryAddress: "1600 Amphitheatre Pkwy, Nashville, TN 37201",
        deliveryDate: d(1),
        rate: 2750,
        driverRate: 1950,
        miles: 803,
        weight: 18000,
        vehicleRequired: "Large Straight",
        driverId: driver5.id,
        unitId: unit4.id,
      },
    }),
    // Active — OnSite for Delivery
    prisma.load.create({
      data: {
        status: "ONSITE_FOR_DELIVERY",
        financialStatus: "UNPAID",
        broker: "Uber Freight",
        brokerReference: "UBR-2026-2207",
        pickupAddress: "300 S Tryon St, Charlotte, NC 28202",
        pickupZip: "28202",
        pickupDate: d(-2),
        deliveryAddress: "200 S Orange Ave, Orlando, FL 32801",
        deliveryDate: d(0),
        rate: 1600,
        driverRate: 1100,
        miles: 505,
        weight: 3100,
        vehicleRequired: "Sprinter Van",
        driverId: driver2.id,
        unitId: unit1.id,
      },
    }),
    // Delivered — Paid
    prisma.load.create({
      data: {
        status: "DELIVERED",
        financialStatus: "PAID",
        broker: "Coyote Logistics",
        brokerReference: "COY-2026-0088",
        pickupAddress: "4500 W Diversey Ave, Chicago, IL 60639",
        pickupZip: "60639",
        pickupDate: d(-5),
        deliveryAddress: "700 14th St NW, Washington, DC 20005",
        deliveryDate: d(-3),
        rate: 2100,
        driverRate: 1500,
        miles: 710,
        weight: 2600,
        vehicleRequired: "Cargo Van",
        rcUploaded: true,
      },
    }),
    // Delivered — Pending payment
    prisma.load.create({
      data: {
        status: "DELIVERED",
        financialStatus: "PENDING",
        broker: "Landstar",
        brokerReference: "LND-2026-3341",
        pickupAddress: "1000 Peachtree St NE, Atlanta, GA 30309",
        pickupZip: "30309",
        pickupDate: d(-7),
        deliveryAddress: "505 Brickell Key Dr, Miami, FL 33131",
        deliveryDate: d(-5),
        rate: 3400,
        driverRate: 2400,
        miles: 662,
        weight: 22000,
        vehicleRequired: "Large Straight",
        rcUploaded: true,
      },
    }),
    // Canceled
    prisma.load.create({
      data: {
        status: "CANCELED",
        financialStatus: "UNPAID",
        broker: "Echo Global Logistics",
        brokerReference: "ECH-2026-9901",
        pickupAddress: "2200 Mission College Blvd, Dallas, TX 75201",
        pickupZip: "75201",
        pickupDate: d(-3),
        deliveryAddress: "600 Grant St, Denver, CO 80203",
        deliveryDate: d(-1),
        rate: 2950,
        miles: 1058,
        weight: 5000,
        vehicleRequired: "Small Straight",
      },
    }),
  ]);

  console.log("✓ Loads created");
  console.log("\n✅ Seed complete");
  console.log("   Admin login: admin@pipotrack.com / admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
