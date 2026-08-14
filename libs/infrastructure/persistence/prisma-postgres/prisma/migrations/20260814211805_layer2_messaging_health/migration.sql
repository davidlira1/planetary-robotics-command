-- CreateEnum
CREATE TYPE "RobotHealthStatus" AS ENUM ('HEALTHY', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "HealthDimensionStatus" AS ENUM ('NORMAL', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LOW_BATTERY', 'HIGH_TEMPERATURE', 'SIGNAL_DEGRADED');

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "publishAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastPublishError" TEXT,
    "claimedUntil" TIMESTAMP(3),

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RobotHealthState" (
    "robotId" TEXT NOT NULL,
    "status" "RobotHealthStatus" NOT NULL,
    "batteryStatus" "HealthDimensionStatus" NOT NULL,
    "temperatureStatus" "HealthDimensionStatus" NOT NULL,
    "signalStatus" "HealthDimensionStatus" NOT NULL,
    "evaluatedFromTelemetryId" TEXT NOT NULL,
    "evaluatedFromRecordedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RobotHealthState_pkey" PRIMARY KEY ("robotId")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourceTelemetryId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedMessage" (
    "consumer" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedMessage_pkey" PRIMARY KEY ("consumer","eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboxMessage_eventId_key" ON "OutboxMessage"("eventId");

-- CreateIndex
CREATE INDEX "OutboxMessage_publishedAt_createdAt_idx" ON "OutboxMessage"("publishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxMessage_claimedUntil_idx" ON "OutboxMessage"("claimedUntil");

-- CreateIndex
CREATE INDEX "Alert_robotId_type_idx" ON "Alert"("robotId", "type");

-- CreateIndex
CREATE INDEX "Alert_sourceEventId_idx" ON "Alert"("sourceEventId");

-- CreateIndex
CREATE INDEX "ProcessedMessage_processedAt_idx" ON "ProcessedMessage"("processedAt");

-- AddForeignKey
ALTER TABLE "RobotHealthState" ADD CONSTRAINT "RobotHealthState_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
