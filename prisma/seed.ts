import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await hash("admin123", 12);

  const user = await prisma.user.upsert({
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

  console.log("Admin user created:", user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
