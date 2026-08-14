ALTER TABLE "RobotCurrentState"
  ADD CONSTRAINT "current_state_battery_range" CHECK ("batteryPercent" >= 0 AND "batteryPercent" <= 100),
  ADD CONSTRAINT "current_state_velocity_nonneg" CHECK ("velocityMetersPerSecond" >= 0),
  ADD CONSTRAINT "current_state_heading_range" CHECK ("headingDegrees" >= 0 AND "headingDegrees" < 360);

ALTER TABLE "RobotTelemetry"
  ADD CONSTRAINT "telemetry_battery_range" CHECK ("batteryPercent" >= 0 AND "batteryPercent" <= 100),
  ADD CONSTRAINT "telemetry_velocity_nonneg" CHECK ("velocityMetersPerSecond" >= 0),
  ADD CONSTRAINT "telemetry_heading_range" CHECK ("headingDegrees" >= 0 AND "headingDegrees" < 360);
