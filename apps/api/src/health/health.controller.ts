import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { DatabaseReadiness } from '@prc/ports';
import { Response } from 'express';
import { DATABASE_READINESS } from '../di/tokens';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE_READINESS)
    private readonly readiness: DatabaseReadiness,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const ready = await this.readiness.isReady();
    if (!ready) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'not_ready' };
    }
    return { status: 'ok' };
  }
}
