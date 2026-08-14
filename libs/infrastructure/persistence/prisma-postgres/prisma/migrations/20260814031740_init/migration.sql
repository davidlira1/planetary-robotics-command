-- CreateEnum
CREATE TYPE "RobotType" AS ENUM ('SCOUT', 'DRONE', 'HAULER', 'WORKER', 'MINER');

-- CreateEnum
CREATE TYPE "RobotOperationalStatus" AS ENUM ('OFFLINE', 'IDLE', 'ACTIVE', 'CHARGING', 'FAULTED');

-- CreateTable
CREATE TABLE "Robot" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" "RobotType" NOT NULL,
    "model" TEXT NOT NULL,
    "operationalStatus" "RobotOperationalStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Robot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RobotCurrentState" (
    "robotId" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "positionZ" DOUBLE PRECISION NOT NULL,
    "batteryPercent" DOUBLE PRECISION NOT NULL,
    "temperatureCelsius" DOUBLE PRECISION NOT NULL,
    "signalStrengthDbm" DOUBLE PRECISION NOT NULL,
    "velocityMetersPerSecond" DOUBLE PRECISION NOT NULL,
    "headingDegrees" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RobotCurrentState_pkey" PRIMARY KEY ("robotId")
);

-- CreateTable
CREATE TABLE "RobotTelemetry" (
    "id" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "sourceTelemetryId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "positionZ" DOUBLE PRECISION NOT NULL,
    "batteryPercent" DOUBLE PRECISION NOT NULL,
    "temperatureCelsius" DOUBLE PRECISION NOT NULL,
    "signalStrengthDbm" DOUBLE PRECISION NOT NULL,
    "velocityMetersPerSecond" DOUBLE PRECISION NOT NULL,
    "headingDegrees" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RobotTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RobotTelemetry_robotId_idx" ON "RobotTelemetry"("robotId");

-- CreateIndex
CREATE INDEX "RobotTelemetry_robotId_recordedAt_idx" ON "RobotTelemetry"("robotId", "recordedAt");

-- CreateIndex
CREATE INDEX "RobotTelemetry_recordedAt_idx" ON "RobotTelemetry"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RobotTelemetry_robotId_sourceTelemetryId_key" ON "RobotTelemetry"("robotId", "sourceTelemetryId");

-- AddForeignKey
ALTER TABLE "RobotCurrentState" ADD CONSTRAINT "RobotCurrentState_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RobotTelemetry" ADD CONSTRAINT "RobotTelemetry_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
