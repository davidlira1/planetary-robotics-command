import { z } from 'zod';

export const IntegrationEventEnvelopeV1Schema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  eventVersion: z.number().int().min(1),
  occurredAt: z.string().datetime(),
  correlationId: z.string().min(1),
  causationId: z.string().min(1),
  payload: z.record(z.unknown()),
});

export type IntegrationEventEnvelopeV1 = z.infer<
  typeof IntegrationEventEnvelopeV1Schema
>;

export const ROBOT_TELEMETRY_RECEIVED_EVENT_TYPE =
  'robot.telemetry.received' as const;

export const RobotTelemetryReceivedPayloadV1Schema = z.object({
  robotId: z.string().min(1),
  telemetryId: z.string().min(1),
  sourceTelemetryId: z.string().min(1),
  telemetrySchemaVersion: z.literal(1),
  recordedAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  position: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  }),
  batteryPercent: z.number().finite().min(0).max(100),
  temperatureCelsius: z.number().finite(),
  signalStrengthDbm: z.number().finite(),
  velocityMetersPerSecond: z.number().finite().min(0),
  headingDegrees: z.number().finite().min(0).lt(360),
});

export type RobotTelemetryReceivedPayloadV1 = z.infer<
  typeof RobotTelemetryReceivedPayloadV1Schema
>;

export const RobotTelemetryReceivedEventV1Schema =
  IntegrationEventEnvelopeV1Schema.extend({
    eventType: z.literal(ROBOT_TELEMETRY_RECEIVED_EVENT_TYPE),
    eventVersion: z.literal(1),
    payload: RobotTelemetryReceivedPayloadV1Schema,
  });

export type RobotTelemetryReceivedEventV1 = z.infer<
  typeof RobotTelemetryReceivedEventV1Schema
>;
