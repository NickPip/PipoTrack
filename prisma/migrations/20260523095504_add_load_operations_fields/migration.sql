-- AlterTable
ALTER TABLE "Load" ADD COLUMN     "bolUrls" JSONB,
ADD COLUMN     "brokerReference" TEXT,
ADD COLUMN     "deliveryNotes" TEXT,
ADD COLUMN     "driverRate" DOUBLE PRECISION,
ADD COLUMN     "loadNumber" SERIAL NOT NULL,
ADD COLUMN     "pickupNotes" TEXT,
ADD COLUMN     "podUrl" TEXT,
ADD COLUMN     "rcUrl" TEXT,
ADD COLUMN     "trackingId" TEXT,
ALTER COLUMN "pickupZip" DROP NOT NULL,
ALTER COLUMN "vehicleRequired" DROP NOT NULL;
