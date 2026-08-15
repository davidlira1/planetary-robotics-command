import {
  IngestTelemetryRequest,
  IngestTelemetryResponseSchema,
  SUPPORTED_TELEMETRY_SCHEMA_VERSION,
} from '@prc/contracts';
import {
  Logger,
  TelemetryProducer,
  TelemetrySample,
  TelemetrySendResult,
} from '@prc/ports';

export interface HttpTelemetryProducerConfig {
  baseUrl: string;
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  /** Inject for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Inject for tests; defaults to setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
  /** Optional abort for graceful shutdown. */
  getSignal?: () => AbortSignal | undefined;
}

function mapSampleToRequest(sample: TelemetrySample): IngestTelemetryRequest {
  return {
    sourceTelemetryId: sample.sourceTelemetryId,
    robotId: sample.robotId,
    schemaVersion: SUPPORTED_TELEMETRY_SCHEMA_VERSION,
    recordedAt: sample.recordedAt.toISOString(),
    position: {
      x: sample.position.x,
      y: sample.position.y,
      z: sample.position.z,
    },
    batteryPercent: sample.batteryPercent,
    temperatureCelsius: sample.temperatureCelsius,
    signalStrengthDbm: sample.signalStrengthDbm,
    velocityMetersPerSecond: sample.velocityMetersPerSecond,
    headingDegrees: sample.headingDegrees,
  };
}

function permanentKind(
  status: number,
): 'validation' | 'not_found' | 'idempotency_conflict' | 'other' {
  if (status === 400) return 'validation';
  if (status === 404) return 'not_found';
  if (status === 409) return 'idempotency_conflict';
  return 'other';
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  jitter: number,
): number {
  const exp = Math.min(maxDelayMs, initialDelayMs * 2 ** (attempt - 1));
  const jitterAmount = exp * 0.2 * jitter;
  return Math.min(maxDelayMs, Math.max(0, exp - jitterAmount));
}

export class HttpTelemetryProducer implements TelemetryProducer {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxAttempts: number;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly endpoint: string;

  constructor(
    private readonly config: HttpTelemetryProducerConfig,
    private readonly logger: Logger,
  ) {
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.sleep = config.sleep ?? defaultSleep;
    this.maxAttempts = config.maxAttempts ?? 5;
    this.initialDelayMs = config.initialDelayMs ?? 500;
    this.maxDelayMs = config.maxDelayMs ?? 8000;
    this.endpoint = `${config.baseUrl.replace(/\/$/, '')}/api/v1/telemetry`;
  }

  async send(sample: TelemetrySample): Promise<TelemetrySendResult> {
    // Capture once — retries must reuse this exact snapshot mapping.
    const body = mapSampleToRequest(sample);
    const bodyJson = JSON.stringify(body);
    let lastError = 'unknown';

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const started = Date.now();
      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: bodyJson,
          signal: this.config.getSignal?.(),
        });

        const durationMs = Date.now() - started;

        if (response.status === 202) {
          let telemetryId: string | undefined;
          try {
            const json = await response.json();
            const parsed = IngestTelemetryResponseSchema.safeParse(json);
            if (parsed.success) telemetryId = parsed.data.telemetryId;
          } catch {
            // body optional
          }
          this.logger.info('Telemetry accepted', {
            operation: 'HttpTelemetryProducer',
            robotId: sample.robotId,
            sourceTelemetryId: sample.sourceTelemetryId,
            sendAttempt: attempt,
            sendResult: 'accepted',
            durationMs,
          });
          return { status: 'accepted', telemetryId };
        }

        if (response.status === 400 || response.status === 404 || response.status === 409) {
          const message = await safeErrorMessage(response);
          this.logger.warn('Telemetry permanent client error', {
            operation: 'HttpTelemetryProducer',
            robotId: sample.robotId,
            sourceTelemetryId: sample.sourceTelemetryId,
            sendAttempt: attempt,
            sendResult: 'permanent_error',
            statusCode: response.status,
            durationMs,
          });
          return {
            status: 'permanent_error',
            kind: permanentKind(response.status),
            statusCode: response.status,
            message,
          };
        }

        if (!isRetryableStatus(response.status)) {
          const message = await safeErrorMessage(response);
          return {
            status: 'permanent_error',
            kind: 'other',
            statusCode: response.status,
            message,
          };
        }

        lastError = `HTTP ${response.status}`;
        this.logger.warn('Telemetry transient HTTP failure', {
          operation: 'HttpTelemetryProducer',
          robotId: sample.robotId,
          sourceTelemetryId: sample.sourceTelemetryId,
          sendAttempt: attempt,
          sendResult: 'retry',
          statusCode: response.status,
          durationMs,
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return { status: 'exhausted', lastError: 'aborted' };
        }
        lastError = err instanceof Error ? err.message : String(err);
        this.logger.warn('Telemetry network failure', {
          operation: 'HttpTelemetryProducer',
          robotId: sample.robotId,
          sourceTelemetryId: sample.sourceTelemetryId,
          sendAttempt: attempt,
          sendResult: 'retry',
          error: lastError,
        });
      }

      if (attempt < this.maxAttempts) {
        const jitter = Math.random();
        const delay = backoffDelay(
          attempt,
          this.initialDelayMs,
          this.maxDelayMs,
          jitter,
        );
        await this.sleep(delay);
      }
    }

    this.logger.error('Telemetry retries exhausted', {
      operation: 'HttpTelemetryProducer',
      robotId: sample.robotId,
      sourceTelemetryId: sample.sourceTelemetryId,
      sendAttempt: this.maxAttempts,
      sendResult: 'exhausted',
    });
    return { status: 'exhausted', lastError };
  }
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 500) || response.statusText;
  } catch {
    return response.statusText;
  }
}

export { mapSampleToRequest };
