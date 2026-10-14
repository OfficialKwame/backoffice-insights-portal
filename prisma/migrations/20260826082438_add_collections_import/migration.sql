-- CreateTable
CREATE TABLE "CollectionsImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "computedSummary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionsImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionsImport_periodStart_idx" ON "CollectionsImport"("periodStart");

-- CreateIndex
CREATE INDEX "CollectionsImport_periodEnd_idx" ON "CollectionsImport"("periodEnd");
