import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  ListAlertsQuerySchema,
  ListAlertsResponseSchema,
} from '../alerts';
import { ApiErrorBodySchema } from '../errors';
import { FleetSnapshotResponseSchema } from '../fleet';
import {
  ListRobotsQuerySchema,
  ListRobotsResponseSchema,
  RobotDetailSchema,
} from '../robots';
import {
  IngestTelemetryRequestSchema,
  IngestTelemetryResponseSchema,
  ListTelemetryQuerySchema,
  ListTelemetryResponseSchema,
} from '../telemetry';

extendZodWithOpenApi(z);

export function createOpenApiRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();

  registry.register('ApiError', ApiErrorBodySchema);
  registry.register('IngestTelemetryRequest', IngestTelemetryRequestSchema);
  registry.register('IngestTelemetryResponse', IngestTelemetryResponseSchema);
  registry.register('ListRobotsResponse', ListRobotsResponseSchema);
  registry.register('RobotDetail', RobotDetailSchema);
  registry.register('ListTelemetryResponse', ListTelemetryResponseSchema);
  registry.register('FleetSnapshotResponse', FleetSnapshotResponseSchema);
  registry.register('ListAlertsResponse', ListAlertsResponseSchema);

  const errorResponse = {
    description: 'Error',
    content: {
      'application/json': {
        schema: ApiErrorBodySchema,
      },
    },
  };

  registry.registerPath({
    method: 'post',
    path: '/api/v1/telemetry',
    summary: 'Ingest robot telemetry',
    description:
      'Durably accepts and persists telemetry (202). Same producer key with same content is idempotent; conflicting content returns 409 IDEMPOTENCY_CONFLICT. Persistence completes before the response; future async processing may follow.',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: IngestTelemetryRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: 'Telemetry accepted and persisted',
        content: {
          'application/json': {
            schema: IngestTelemetryResponseSchema,
          },
        },
      },
      400: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/fleet',
    summary: 'Fleet snapshot for dashboard / 3D viewport',
    description:
      'Returns all robots with current telemetry state and derived health in one response. currentState and health may be null when no data exists yet.',
    responses: {
      200: {
        description: 'Complete fleet snapshot ordered by robot id ascending',
        content: {
          'application/json': {
            schema: FleetSnapshotResponseSchema,
          },
        },
      },
      500: errorResponse,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/robots',
    summary: 'List robots (fleet overview)',
    request: {
      query: ListRobotsQuerySchema,
    },
    responses: {
      200: {
        description: 'Fleet page ordered by id ascending',
        content: {
          'application/json': {
            schema: ListRobotsResponseSchema,
          },
        },
      },
      400: errorResponse,
      500: errorResponse,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/robots/{robotId}',
    summary: 'Get robot detail',
    request: {
      params: z.object({ robotId: z.string() }),
    },
    responses: {
      200: {
        description: 'Robot detail with current state and health',
        content: {
          'application/json': {
            schema: RobotDetailSchema,
          },
        },
      },
      404: errorResponse,
      500: errorResponse,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/robots/{robotId}/telemetry',
    summary: 'List historical telemetry for a robot',
    request: {
      params: z.object({ robotId: z.string() }),
      query: ListTelemetryQuerySchema,
    },
    responses: {
      200: {
        description: 'Cursor-paginated telemetry history',
        content: {
          'application/json': {
            schema: ListTelemetryResponseSchema,
          },
        },
      },
      400: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/alerts',
    summary: 'List alerts',
    request: {
      query: ListAlertsQuerySchema,
    },
    responses: {
      200: {
        description: 'Cursor-paginated alerts newest first',
        content: {
          'application/json': {
            schema: ListAlertsResponseSchema,
          },
        },
      },
      400: errorResponse,
      500: errorResponse,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/health/live',
    summary: 'Liveness probe',
    responses: {
      200: {
        description: 'Process is running',
        content: {
          'application/json': {
            schema: z.object({ status: z.literal('ok') }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/health/ready',
    summary: 'Readiness probe',
    responses: {
      200: {
        description: 'Required infrastructure reachable',
        content: {
          'application/json': {
            schema: z.object({ status: z.literal('ok') }),
          },
        },
      },
      503: {
        description: 'Not ready',
        content: {
          'application/json': {
            schema: z.object({ status: z.literal('not_ready') }),
          },
        },
      },
    },
  });

  return registry;
}

export function generateOpenApiDocument(): Record<string, unknown> {
  const registry = createOpenApiRegistry();
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Planetary Robotics Command API',
      version: '1.0.0',
      description:
        'HTTP contract generated from @prc/contracts Zod schemas — do not hand-edit the YAML artifact.',
    },
    servers: [{ url: 'http://localhost:3000' }],
  }) as unknown as Record<string, unknown>;
}
