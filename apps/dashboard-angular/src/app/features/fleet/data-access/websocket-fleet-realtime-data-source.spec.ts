import type { BrowserWebSocket } from './fleet-realtime-data-source';
import { WebSocketFleetRealtimeDataSource } from './websocket-fleet-realtime-data-source';

class FakeSocket implements BrowserWebSocket {
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  readonly close = jest.fn(() => {
    this.readyState = 3;
    this.onclose?.({});
  });

  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  push(data: unknown): void {
    this.onmessage?.({ data });
  }
}

function validMessage() {
  return JSON.stringify({
    type: 'robot.state.updated',
    version: 1,
    eventId: 'evt_1',
    occurredAt: '2026-08-13T20:00:03.100Z',
    robot: {
      id: 'D-04',
      currentState: {
        position: { x: 1, y: 2, z: 3 },
        batteryPercent: 80,
        temperatureCelsius: 40,
        signalStrengthDbm: -70,
        velocityMetersPerSecond: 1,
        headingDegrees: 10,
        recordedAt: '2026-08-13T20:00:03.000Z',
        receivedAt: '2026-08-13T20:00:03.100Z',
      },
    },
  });
}

describe('WebSocketFleetRealtimeDataSource', () => {
  let sockets: FakeSocket[];
  let source: WebSocketFleetRealtimeDataSource;

  beforeEach(() => {
    sockets = [];
    source = new WebSocketFleetRealtimeDataSource('ws://test/realtime', () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    });
  });

  afterEach(() => {
    source.disconnect();
  });

  it('connects once and emits CONNECTED', async () => {
    const states: string[] = [];
    source.connectionState$.subscribe((state) => states.push(state));
    source.connect();
    source.connect();
    expect(sockets).toHaveLength(1);
    sockets[0]!.open();
    expect(states).toEqual(['DISCONNECTED', 'CONNECTING', 'CONNECTED']);
  });

  it('forwards valid messages and drops malformed payloads', async () => {
    const received: string[] = [];
    source.messages$.subscribe((message) => received.push(message.robot.id));
    source.connect();
    sockets[0]!.open();
    sockets[0]!.push('{');
    sockets[0]!.push(validMessage());
    expect(received).toEqual(['D-04']);
  });

  it('does not emit reconnected on the first open', async () => {
    let reconnects = 0;
    source.reconnected$.subscribe(() => {
      reconnects += 1;
    });
    source.connect();
    sockets[0]!.open();
    expect(reconnects).toBe(0);
  });

  it('reconnects with a single timer and does not stack sockets', () => {
    jest.useFakeTimers();
    source.connect();
    sockets[0]!.open();
    sockets[0]!.close();
    expect(sockets).toHaveLength(1);
    jest.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    jest.useRealTimers();
  });

  it('disconnect cancels reconnect and closes the socket', () => {
    jest.useFakeTimers();
    source.connect();
    sockets[0]!.open();
    sockets[0]!.close();
    source.disconnect();
    jest.advanceTimersByTime(20_000);
    expect(sockets).toHaveLength(1);
    jest.useRealTimers();
  });

  it('uses the existing reconnect backoff when createSocket throws', () => {
    jest.useFakeTimers();
    let calls = 0;
    source.disconnect();
    source = new WebSocketFleetRealtimeDataSource('ws://test/realtime', () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('constructor failed');
      }
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    });
    const states: string[] = [];
    source.connectionState$.subscribe((state) => states.push(state));
    source.connect();
    expect(sockets).toHaveLength(0);
    expect(states).toEqual(['DISCONNECTED', 'CONNECTING', 'RECONNECTING']);
    jest.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(1);
    jest.useRealTimers();
  });
});
