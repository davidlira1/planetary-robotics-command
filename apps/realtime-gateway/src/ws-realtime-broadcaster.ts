import { createServer, type Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import type { Logger } from '@prc/ports';
import { publishToOpenClients } from './publish-to-open-clients';
import type { RealtimeBroadcaster } from './realtime-broadcaster';

const READY = JSON.stringify({ type: 'realtime.ready', version: 1 });

export class WsRealtimeBroadcaster implements RealtimeBroadcaster {
  private readonly httpServer: HttpServer;
  private readonly wss: WebSocketServer;
  private readonly clients = new Set<WebSocket>();

  constructor(
    private readonly logger: Logger,
    port: number,
    path: string,
  ) {
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer, path });
    this.wss.on('connection', (socket) => {
      this.clients.add(socket);
      this.logger.info('Realtime client connected', {
        operation: 'realtime-gateway',
        clientCount: this.clients.size,
      });
      try {
        socket.send(READY);
      } catch {
        this.drop(socket, 'ready-send-failed');
        return;
      }
      socket.on('close', () => this.drop(socket, 'closed'));
      socket.on('error', () => this.drop(socket, 'error'));
    });
    this.httpServer.listen(port);
  }

  async publish(payload: string): Promise<void> {
    publishToOpenClients(
      this.clients,
      (socket) => socket.readyState === WebSocket.OPEN,
      (socket) => {
        socket.send(payload);
      },
      (socket, reason) => {
        if (reason === 'send-failed') {
          this.logger.warn('Realtime client send failed', {
            operation: 'realtime-gateway',
            errorCode: 'CLIENT_SEND',
            clientCount: this.clients.size,
          });
        }
        this.drop(socket, reason);
      },
    );
  }

  clientCount(): number {
    return this.clients.size;
  }

  async close(): Promise<void> {
    for (const socket of [...this.clients]) {
      this.drop(socket, 'shutdown');
    }
    await new Promise<void>((resolve, reject) => {
      this.wss.close((err) => (err ? reject(err) : resolve()));
    });
    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  }

  private drop(socket: WebSocket, reason: string): void {
    if (!this.clients.delete(socket)) {
      return;
    }
    try {
      socket.close();
    } catch {
      /* already closed */
    }
    this.logger.info('Realtime client disconnected', {
      operation: 'realtime-gateway',
      reason,
      clientCount: this.clients.size,
    });
  }
}
