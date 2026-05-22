-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "equipment" JSONB,
ADD COLUMN     "make" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "payload" DOUBLE PRECISION,
ADD COLUMN     "pictureUrls" JSONB,
ADD COLUMN     "plateNumber" TEXT,
ADD COLUMN     "registrationUrl" TEXT,
ADD COLUMN     "vin" TEXT,
ADD COLUMN     "year" TEXT,
ALTER COLUMN "dimensions" DROP NOT NULL;
