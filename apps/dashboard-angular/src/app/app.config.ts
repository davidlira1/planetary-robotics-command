import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { BASE_PATH, DefaultService } from '@prc/api-client-angular';
import { ALERTS_DATA_SOURCE } from './features/alerts/data-access/alerts-data-source';
import { AlertsHttpDataSource } from './features/alerts/data-access/alerts-http-data-source';
import { FLEET_DATA_SOURCE } from './features/fleet/data-access/fleet-data-source';
import {
  defaultRealtimeWsUrl,
  defaultWebSocketFactory,
  FLEET_REALTIME_DATA_SOURCE,
  REALTIME_WS_URL,
  WEB_SOCKET_FACTORY,
} from './features/fleet/data-access/fleet-realtime-data-source';
import { FleetHttpDataSource } from './features/fleet/data-access/fleet-http-data-source';
import { WebSocketFleetRealtimeDataSource } from './features/fleet/data-access/websocket-fleet-realtime-data-source';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(),
    { provide: BASE_PATH, useValue: '' },
    DefaultService,
    FleetHttpDataSource,
    AlertsHttpDataSource,
    WebSocketFleetRealtimeDataSource,
    { provide: FLEET_DATA_SOURCE, useExisting: FleetHttpDataSource },
    { provide: ALERTS_DATA_SOURCE, useExisting: AlertsHttpDataSource },
    { provide: FLEET_REALTIME_DATA_SOURCE, useExisting: WebSocketFleetRealtimeDataSource },
    { provide: REALTIME_WS_URL, useFactory: defaultRealtimeWsUrl },
    { provide: WEB_SOCKET_FACTORY, useValue: defaultWebSocketFactory },
  ],
};
