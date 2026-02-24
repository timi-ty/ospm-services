-- CreateTable
CREATE TABLE "HealthLog" (
    "id" TEXT NOT NULL,
    "tickCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthLog_createdAt_idx" ON "HealthLog"("createdAt");
