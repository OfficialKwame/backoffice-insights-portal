-- CreateTable
CREATE TABLE "CollectionsInvoice" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "businessId" TEXT,
    "businessName" TEXT,
    "source" TEXT,
    "invoiceCreatedAt" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "collectedAmount" DECIMAL(18,2) NOT NULL,
    "outstandingAmount" DECIMAL(18,2) NOT NULL,
    "status" TEXT,
    "lastPaymentDate" TIMESTAMP(3),
    "rawData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionsInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollectionsInvoice_invoiceId_key" ON "CollectionsInvoice"("invoiceId");

-- CreateIndex
CREATE INDEX "CollectionsInvoice_invoiceCreatedAt_idx" ON "CollectionsInvoice"("invoiceCreatedAt");

-- CreateIndex
CREATE INDEX "CollectionsInvoice_businessId_idx" ON "CollectionsInvoice"("businessId");

-- CreateIndex
CREATE INDEX "CollectionsInvoice_source_idx" ON "CollectionsInvoice"("source");

-- CreateIndex
CREATE INDEX "CollectionsInvoice_status_idx" ON "CollectionsInvoice"("status");
