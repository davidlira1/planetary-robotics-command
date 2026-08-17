import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import type { RobotStateUpdatedV1 } from '@prc/contracts';
import type { RealtimeConnectionState } from '../../realtime/realtime-connection-state';
import {
  REALTIME_WS_URL,
  WEB_SOCKET_FACTORY,
  type BrowserWebSocket,
  type FleetRealtimeDataSource,
  type WebSocketFactory,
} from './fleet-realtime-data-source';
import { parseRobotStateUpdated } from './parse-robot-state-updated';
import { reconnectDelayMs } from './reconnect-delay';

@Injectable()
export class WebSocketFleetRealtimeDataSource implements FleetRealtimeDataSource {
  private readonly connectionState = new BehaviorSubject<RealtimeConnectionState>('DISCONNECTED');
  private readonly messages = new Subject<RobotStateUpdatedV1>();
  private readonly reconnected = new Subject<void>();

  readonly connectionState$: Observable<RealtimeConnectionState> = this.connectionState.asObservable();
  readonly messages$: Observable<RobotStateUpdatedV1> = this.messages.asObservable();
  readonly reconnected$: Observable<void> = this.reconnected.asObservable();

  private desiredOpen = false;
  private hadConnected = false;
  private generation = 0;
  private attempt = 0;
  private socket: BrowserWebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @Inject(REALTIME_WS_URL) private readonly url: string,
    @Inject(WEB_SOCKET_FACTORY) private readonly createSocket: WebSocketFactory,
  ) {}

  connect(): void {
    if (this.desiredOpen) {
      return;
    }
    this.desiredOpen = true;
    this.attempt = 0;
    this.openSocket();
  }

  disconnect(): void {
    this.desiredOpen = false;
    this.hadConnected = false;
    this.attempt = 0;
    this.clearTimer();
    this.generation += 1;
    this.closeSocket();
    this.connectionState.next('DISCONNECTED');
  }

  private openSocket(): void {
    this.closeSocket();
    const generation = this.generation;
    this.connectionState.next(this.hadConnected ? 'RECONNECTING' : 'CONNECTING');
    let socket: BrowserWebSocket;
    try {
      socket = this.createSocket(this.url);
    } catch {
      if (generation !== this.generation || !this.desiredOpen) {
        return;
      }
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      if (generation !== this.generation) {
        return;
      }
      const replay = this.hadConnected;
      this.hadConnected = true;
      this.attempt = 0;
      this.connectionState.next('CONNECTED');
      if (replay) {
        this.reconnected.next();
      }
    };
    socket.onmessage = (event) => {
      if (generation !== this.generation) {
        return;
      }
      const message = parseRobotStateUpdated(event.data);
      if (message) {
        this.messages.next(message);
      }
    };
    // Reconnect has one owner: onclose. Browsers typically fire error then close;
    // scheduling here would duplicate timers and sockets.
    socket.onerror = () => undefined;
    socket.onclose = () => {
      if (generation !== this.generation) {
        return;
      }
      this.socket = null;
      if (!this.desiredOpen) {
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    this.connectionState.next('RECONNECTING');
    this.clearTimer();
    const delay = reconnectDelayMs(this.attempt);
    this.attempt += 1;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.desiredOpen) {
        this.openSocket();
      }
    }, delay);
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.socket = null;
    if (!socket) {
      return;
    }
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
