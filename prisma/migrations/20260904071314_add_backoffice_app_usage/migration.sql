-- CreateTable
CREATE TABLE "BackOfficeAppUsageEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "sessionId" TEXT,
    "customerId" TEXT,
    "eventName" TEXT NOT NULL,
    "eventTimestamp" TIMESTAMP(3) NOT NULL,
    "operatingSystem" TEXT,
    "device" TEXT,
    "appVersion" TEXT,
    "rawData" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackOfficeAppUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackOfficeAppUsageEvent_eventTimestamp_idx" ON "BackOfficeAppUsageEvent"("eventTimestamp");

-- CreateIndex
CREATE INDEX "BackOfficeAppUsageEvent_eventName_idx" ON "BackOfficeAppUsageEvent"("eventName");

-- CreateIndex
CREATE INDEX "BackOfficeAppUsageEvent_sessionId_idx" ON "BackOfficeAppUsageEvent"("sessionId");

-- CreateIndex
CREATE INDEX "BackOfficeAppUsageEvent_customerId_idx" ON "BackOfficeAppUsageEvent"("customerId");

-- CreateIndex
CREATE INDEX "BackOfficeAppUsageEvent_operatingSystem_idx" ON "BackOfficeAppUsageEvent"("operatingSystem");

-- CreateIndex
CREATE INDEX "BackOfficeAppUsageEvent_appVersion_idx" ON "BackOfficeAppUsageEvent"("appVersion");
