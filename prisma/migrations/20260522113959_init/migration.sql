-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RECRUITING', 'DISPATCHER', 'OPERATIONS', 'ACCOUNTING');

-- CreateEnum
CREATE TYPE "LoadStatus" AS ENUM ('PENDING', 'DISPATCHED_TO_PICKUP', 'ONSITE_FOR_PICKUP', 'LOADED_AND_DELIVERING', 'ONSITE_FOR_DELIVERY', 'DELIVERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "FinStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phone2" TEXT,
    "address" TEXT,
    "emergencyContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "ownerId" TEXT,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "currentZip" TEXT NOT NULL,
    "searchRadius" INTEGER NOT NULL,
    "telegramId" TEXT,
    "unitId" TEXT,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Load" (
    "id" TEXT NOT NULL,
    "status" "LoadStatus" NOT NULL DEFAULT 'PENDING',
    "financialStatus" "FinStatus" NOT NULL DEFAULT 'UNPAID',
    "broker" TEXT NOT NULL,
    "pickupZip" TEXT NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "pickupDate" TIMESTAMP(3) NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "rate" DOUBLE PRECISION,
    "miles" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "dimensions" JSONB,
    "vehicleRequired" TEXT NOT NULL,
    "rcUploaded" BOOLEAN NOT NULL DEFAULT false,
    "dispatcherId" TEXT,
    "driverId" TEXT,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Load_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_idNumber_key" ON "User"("idNumber");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
