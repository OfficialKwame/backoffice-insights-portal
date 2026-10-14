/*
  Warnings:

  - You are about to drop the column `computedSummary` on the `CollectionsImport` table. All the data in the column will be lost.
  - You are about to drop the column `periodEnd` on the `CollectionsImport` table. All the data in the column will be lost.
  - You are about to drop the column `periodStart` on the `CollectionsImport` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `CollectionsImport` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "CollectionsImport_periodEnd_idx";

-- DropIndex
DROP INDEX "CollectionsImport_periodStart_idx";

-- AlterTable
ALTER TABLE "CollectionsImport" DROP COLUMN "computedSummary",
DROP COLUMN "periodEnd",
DROP COLUMN "periodStart",
DROP COLUMN "updatedAt",
ADD COLUMN     "importedMaxDate" TIMESTAMP(3),
ADD COLUMN     "importedMinDate" TIMESTAMP(3),
ADD COLUMN     "periodId" TEXT;

-- CreateTable
CREATE TABLE "CollectionsPeriod" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "daysCovered" INTEGER NOT NULL DEFAULT 0,
    "expectedDays" INTEGER NOT NULL DEFAULT 7,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "computedSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionsPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionsTransaction" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "rawData" JSONB NOT NULL,
    "periodId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionsPeriod_periodStart_idx" ON "CollectionsPeriod"("periodStart");

-- CreateIndex
CREATE INDEX "CollectionsPeriod_periodEnd_idx" ON "CollectionsPeriod"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionsPeriod_periodStart_periodEnd_key" ON "CollectionsPeriod"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionsTransaction_transactionId_key" ON "CollectionsTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "CollectionsTransaction_periodId_idx" ON "CollectionsTransaction"("periodId");

-- CreateIndex
CREATE INDEX "CollectionsTransaction_paymentDate_idx" ON "CollectionsTransaction"("paymentDate");

-- CreateIndex
CREATE INDEX "CollectionsImport_periodId_idx" ON "CollectionsImport"("periodId");

-- CreateIndex
CREATE INDEX "CollectionsImport_createdAt_idx" ON "CollectionsImport"("createdAt");

-- AddForeignKey
ALTER TABLE "CollectionsTransaction" ADD CONSTRAINT "CollectionsTransaction_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "CollectionsPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionsImport" ADD CONSTRAINT "CollectionsImport_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "CollectionsPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
