import { Logger as PortsLogger, LogFields } from '@prc/ports';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NestAppLogger implements PortsLogger {
  private readonly logger = new Logger('App');

  info(message: string, fields?: LogFields): void {
    this.logger.log({ msg: message, ...fields });
  }

  warn(message: string, fields?: LogFields): void {
    this.logger.warn({ msg: message, ...fields });
  }

  error(message: string, fields?: LogFields): void {
    this.logger.error({ msg: message, ...fields });
  }

  debug(message: string, fields?: LogFields): void {
    this.logger.debug({ msg: message, ...fields });
  }
}
