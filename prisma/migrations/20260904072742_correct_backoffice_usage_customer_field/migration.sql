/*
  Warnings:

  - You are about to drop the column `customerId` on the `BackOfficeAppUsageEvent` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "BackOfficeAppUsageEvent_customerId_idx";

-- AlterTable
ALTER TABLE "BackOfficeAppUsageEvent" DROP COLUMN "customerId",
ADD COLUMN     "customerPhoneNumber" TEXT;

-- CreateIndex
CREATE INDEX "BackOfficeAppUsageEvent_customerPhoneNumber_idx" ON "BackOfficeAppUsageEvent"("customerPhoneNumber");
