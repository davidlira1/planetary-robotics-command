-- CreateIndex
CREATE INDEX "Alert_createdAt_id_idx" ON "Alert"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Alert_robotId_createdAt_idx" ON "Alert"("robotId", "createdAt");
