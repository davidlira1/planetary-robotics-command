export function publishToOpenClients<T>(
  clients: Iterable<T>,
  isOpen: (client: T) => boolean,
  send: (client: T) => void,
  drop: (client: T, reason: string) => void,
): void {
  for (const client of [...clients]) {
    if (!isOpen(client)) {
      drop(client, 'not-open');
      continue;
    }
    try {
      send(client);
    } catch {
      drop(client, 'send-failed');
    }
  }
}
