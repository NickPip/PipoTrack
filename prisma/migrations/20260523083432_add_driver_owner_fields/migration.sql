-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "address" TEXT,
ADD COLUMN     "appPassword" TEXT,
ADD COLUMN     "appUsername" TEXT,
ADD COLUMN     "citizenshipType" TEXT,
ADD COLUMN     "cleanBackground" BOOLEAN,
ADD COLUMN     "dlDocumentUrl" TEXT,
ADD COLUMN     "dlNumber" TEXT,
ADD COLUMN     "drivingRecordUrl" TEXT,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "twicTsaUrl" TEXT;

-- AlterTable
ALTER TABLE "Owner" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bankInfoUrl" TEXT,
ADD COLUMN     "company" TEXT,
ADD COLUMN     "insuranceUrl" TEXT,
ADD COLUMN     "ownerDocUrl" TEXT,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "ssnFein" TEXT,
ADD COLUMN     "ssnFeinDocUrl" TEXT,
ADD COLUMN     "w9Url" TEXT;
