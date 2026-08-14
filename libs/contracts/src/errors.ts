import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'ROBOT_NOT_FOUND',
  'IDEMPOTENCY_CONFLICT',
  'INVALID_CURSOR',
  'INVALID_TIME_RANGE',
  'INTERNAL_ERROR',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
  }),
});

export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
