/*
  Warnings:

  - A unique constraint covering the columns `[sourceId]` on the table `BackOfficeAppUsageEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BackOfficeAppUsageEvent" ADD COLUMN     "sourceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BackOfficeAppUsageEvent_sourceId_key" ON "BackOfficeAppUsageEvent"("sourceId");
