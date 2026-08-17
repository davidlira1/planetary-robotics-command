import { publishToOpenClients } from './publish-to-open-clients';

describe('publishToOpenClients', () => {
  it('prunes a failed client and still sends to remaining open clients', () => {
    const sent: string[] = [];
    const dropped: string[] = [];
    const clients = [
      { id: 'dead', open: true, fail: true },
      { id: 'ok', open: true, fail: false },
      { id: 'closed', open: false, fail: false },
    ];
    publishToOpenClients(
      clients,
      (client) => client.open,
      (client) => {
        if (client.fail) {
          throw new Error('broken pipe');
        }
        sent.push(client.id);
      },
      (client, reason) => {
        dropped.push(`${client.id}:${reason}`);
      },
    );
    expect(sent).toEqual(['ok']);
    expect(dropped).toEqual(['dead:send-failed', 'closed:not-open']);
  });
});
