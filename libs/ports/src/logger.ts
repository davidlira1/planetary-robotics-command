export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogFields {
  requestId?: string;
  robotId?: string;
  operation?: string;
  route?: string;
  durationMs?: number;
  errorCode?: string;
  [key: string]: unknown;
}

export interface Logger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
}
