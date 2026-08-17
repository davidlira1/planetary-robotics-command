export interface RealtimeBroadcaster {
  publish(payload: string): Promise<void>;
  clientCount(): number;
  close(): Promise<void>;
}
