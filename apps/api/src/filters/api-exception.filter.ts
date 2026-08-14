import {
  ApplicationError,
  IdempotencyConflictError,
  InvalidCursorError,
  InvalidTimeRangeError,
  RobotNotFoundError,
} from '@prc/application';
import { ApiErrorBody, ErrorCode } from '@prc/contracts';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? 'req_unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';

    if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = exception.issues
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
    } else if (exception instanceof RobotNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      code = 'ROBOT_NOT_FOUND';
      message = exception.message;
    } else if (exception instanceof IdempotencyConflictError) {
      status = HttpStatus.CONFLICT;
      code = 'IDEMPOTENCY_CONFLICT';
      message = exception.message;
    } else if (exception instanceof InvalidCursorError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'INVALID_CURSOR';
      message = exception.message;
    } else if (exception instanceof InvalidTimeRangeError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'INVALID_TIME_RANGE';
      message = exception.message;
    } else if (exception instanceof ApplicationError) {
      status = HttpStatus.BAD_REQUEST;
      code = (exception.code as ErrorCode) || 'VALIDATION_ERROR';
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message?.toString() ??
            exception.message);
      if (status === HttpStatus.BAD_REQUEST) code = 'VALIDATION_ERROR';
      if (status === HttpStatus.NOT_FOUND) code = 'ROBOT_NOT_FOUND';
    } else {
      this.logger.error({
        msg: 'Unhandled error',
        requestId,
        err: exception instanceof Error ? exception.message : String(exception),
      });
    }

    const payload: ApiErrorBody = {
      error: { code, message, requestId },
    };
    response.status(status).json(payload);
  }
}
