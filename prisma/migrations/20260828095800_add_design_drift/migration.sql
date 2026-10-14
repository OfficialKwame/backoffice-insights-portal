-- CreateEnum
CREATE TYPE "DesignDriftSurface" AS ENUM ('LITE', 'APP');

-- CreateEnum
CREATE TYPE "DesignDriftSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DesignDriftStatus" AS ENUM ('NEW', 'RAISED', 'IN_PROGRESS', 'FIXED', 'ACCEPTED');

-- CreateTable
CREATE TABLE "DesignDriftReview" (
    "id" TEXT NOT NULL,
    "surface" "DesignDriftSurface" NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "areasReviewed" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignDriftReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignDriftItem" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "approvedReference" TEXT,
    "liveObservation" TEXT NOT NULL,
    "approvedScreenshot" TEXT,
    "liveScreenshot" TEXT,
    "severity" "DesignDriftSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "DesignDriftStatus" NOT NULL DEFAULT 'NEW',
    "designReference" TEXT,
    "raisedTo" TEXT,
    "dateRaised" TIMESTAMP(3),
    "fixNotes" TEXT,
    "dateFixed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignDriftItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignDriftReview_reviewDate_idx" ON "DesignDriftReview"("reviewDate");

-- CreateIndex
CREATE INDEX "DesignDriftReview_surface_idx" ON "DesignDriftReview"("surface");

-- CreateIndex
CREATE INDEX "DesignDriftItem_reviewId_idx" ON "DesignDriftItem"("reviewId");

-- CreateIndex
CREATE INDEX "DesignDriftItem_status_idx" ON "DesignDriftItem"("status");

-- CreateIndex
CREATE INDEX "DesignDriftItem_severity_idx" ON "DesignDriftItem"("severity");

-- AddForeignKey
ALTER TABLE "DesignDriftItem" ADD CONSTRAINT "DesignDriftItem_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "DesignDriftReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
