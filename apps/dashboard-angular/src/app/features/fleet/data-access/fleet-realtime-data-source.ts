import { InjectionToken } from '@angular/core';
import type { RobotStateUpdatedV1 } from '@prc/contracts';
import { Observable } from 'rxjs';
import type { RealtimeConnectionState } from '../../realtime/realtime-connection-state';

export interface FleetRealtimeDataSource {
  readonly connectionState$: Observable<RealtimeConnectionState>;
  readonly messages$: Observable<RobotStateUpdatedV1>;
  readonly reconnected$: Observable<void>;
  connect(): void;
  disconnect(): void;
}

export const FLEET_REALTIME_DATA_SOURCE = new InjectionToken<FleetRealtimeDataSource>(
  'FLEET_REALTIME_DATA_SOURCE',
);

export const REALTIME_WS_URL = new InjectionToken<string>('REALTIME_WS_URL');

export interface BrowserWebSocket {
  readyState: number;
  close(): void;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export type WebSocketFactory = (url: string) => BrowserWebSocket;

export const WEB_SOCKET_FACTORY = new InjectionToken<WebSocketFactory>('WEB_SOCKET_FACTORY');

export function defaultRealtimeWsUrl(): string {
  if (typeof location === 'undefined') {
    return 'ws://localhost:4200/realtime';
  }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/realtime`;
}

export function defaultWebSocketFactory(url: string): BrowserWebSocket {
  return new WebSocket(url) as unknown as BrowserWebSocket;
}
