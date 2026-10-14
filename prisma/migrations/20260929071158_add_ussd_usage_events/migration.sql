-- CreateTable
CREATE TABLE "UssdUsageEvent" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "flow" TEXT,
    "eventTimestamp" TIMESTAMP(3) NOT NULL,
    "customerHash" TEXT,
    "businessId" TEXT,
    "businessName" TEXT,
    "sector" TEXT,
    "channel" TEXT,
    "network" TEXT,
    "amount" DECIMAL(18,2),
    "amountWithoutCharges" DECIMAL(18,2),
    "charges" DECIMAL(18,2),
    "paymentCategory" TEXT,
    "providerDescription" TEXT,
    "sessionStatus" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UssdUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UssdUsageEvent_sourceId_key" ON "UssdUsageEvent"("sourceId");

-- CreateIndex
CREATE INDEX "UssdUsageEvent_eventTimestamp_idx" ON "UssdUsageEvent"("eventTimestamp");

-- CreateIndex
CREATE INDEX "UssdUsageEvent_traceId_idx" ON "UssdUsageEvent"("traceId");

-- CreateIndex
CREATE INDEX "UssdUsageEvent_eventName_idx" ON "UssdUsageEvent"("eventName");

-- CreateIndex
CREATE INDEX "UssdUsageEvent_businessId_idx" ON "UssdUsageEvent"("businessId");

-- CreateIndex
CREATE INDEX "UssdUsageEvent_customerHash_idx" ON "UssdUsageEvent"("customerHash");
