/**
 * Transport-neutral telemetry sample for device/simulator producers.
 * Adapters (HTTP, MQTT, IoT Hub, …) map this into their wire format.
 */
export interface TelemetrySample {
  readonly sourceTelemetryId: string;
  readonly robotId: string;
  readonly schemaVersion: number;
  readonly recordedAt: Date;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly batteryPercent: number;
  readonly temperatureCelsius: number;
  readonly signalStrengthDbm: number;
  readonly velocityMetersPerSecond: number;
  readonly headingDegrees: number;
}

export type TelemetrySendResult =
  | { status: 'accepted'; telemetryId?: string }
  | {
      status: 'permanent_error';
      kind: 'validation' | 'not_found' | 'idempotency_conflict' | 'other';
      statusCode?: number;
      message: string;
    }
  | { status: 'exhausted'; lastError: string };

export interface TelemetryProducer {
  send(sample: TelemetrySample): Promise<TelemetrySendResult>;
}
