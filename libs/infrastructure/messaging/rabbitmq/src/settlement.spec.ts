import type { ConsumeMessage } from 'amqplib';
import { assertTelemetryTopology } from './assert-topology';
import { applySettlement, planSettlement, readDeliveryCount } from './settlement';
import {
  DEAD_LETTER_EXCHANGE,
  DELIVERY_COUNT_HEADER,
  RETRY_RETURN_EXCHANGE,
  TELEMETRY_EXCHANGE,
  deadLetterQueueName,
  retryQueueName,
  workQueueName,
} from './topology';

function fakeMessage(headers?: Record<string, unknown>): ConsumeMessage {
  return {
    content: Buffer.from('{"eventId":"evt_1"}'),
    properties: {
      headers,
      contentType: 'application/json',
      messageId: 'evt_1',
      correlationId: 'corr_1',
    },
  } as ConsumeMessage;
}

function fakeChannel() {
  return {
    ack: jest.fn(),
    nack: jest.fn(),
    sendToQueue: jest.fn().mockReturnValue(true),
  };
}

describe('readDeliveryCount', () => {
  it('defaults missing headers to 1', () => {
    expect(readDeliveryCount(undefined)).toBe(1);
    expect(readDeliveryCount({})).toBe(1);
  });

  it('reads the x-prc-delivery-count header', () => {
    expect(readDeliveryCount({ [DELIVERY_COUNT_HEADER]: 4 })).toBe(4);
  });
});

describe('planSettlement', () => {
  it('acks complete', () => {
    expect(planSettlement('complete', 1, 10)).toEqual({ kind: 'ack' });
  });

  it('dead-letters immediately on permanent failure', () => {
    expect(planSettlement('deadLetter', 1, 10)).toEqual({ kind: 'deadLetter' });
  });

  it('retries abandon below max without unlimited requeue', () => {
    expect(planSettlement('abandon', 3, 10)).toEqual({
      kind: 'retry',
      nextDeliveryCount: 4,
    });
  });

  it('dead-letters abandon at max delivery count', () => {
    expect(planSettlement('abandon', 10, 10)).toEqual({ kind: 'deadLetter' });
  });
});

describe('applySettlement', () => {
  const retryQueue = retryQueueName('health');

  it('acks complete', () => {
    const channel = fakeChannel();
    const message = fakeMessage();
    applySettlement(channel, message, { kind: 'ack' }, retryQueue);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('nacks without requeue on deadLetter', () => {
    const channel = fakeChannel();
    const message = fakeMessage();
    applySettlement(channel, message, { kind: 'deadLetter' }, retryQueue);
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('abandons below max by publishing to the consumer retry queue then acking', () => {
    const channel = fakeChannel();
    const message = fakeMessage({ [DELIVERY_COUNT_HEADER]: 3 });
    applySettlement(
      channel,
      message,
      { kind: 'retry', nextDeliveryCount: 4 },
      retryQueue,
    );
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      retryQueue,
      message.content,
      expect.objectContaining({
        persistent: true,
        headers: expect.objectContaining({ [DELIVERY_COUNT_HEADER]: 4 }),
      }),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('nacks without requeue when abandon is at max', () => {
    const channel = fakeChannel();
    const message = fakeMessage({ [DELIVERY_COUNT_HEADER]: 10 });
    applySettlement(
      channel,
      message,
      planSettlement('abandon', 10, 10),
      retryQueue,
    );
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });
});

describe('assertTelemetryTopology', () => {
  it('declares fanout work queues with explicit DLX routing keys and retry queues', async () => {
    const exchanges: Array<[string, string, { durable?: boolean } | undefined]> = [];
    const queues: Array<{ name: string; args: Record<string, unknown> | undefined }> = [];
    const bindings: Array<[string, string, string]> = [];
    const channel = {
      async assertExchange(
        name: string,
        type: string,
        options?: { durable?: boolean },
      ) {
        exchanges.push([name, type, options]);
        return {} as never;
      },
      async assertQueue(name: string, options?: { arguments?: Record<string, unknown> }) {
        queues.push({ name, args: options?.arguments });
        return { queue: name, messageCount: 0, consumerCount: 0 };
      },
      async bindQueue(queue: string, exchange: string, routingKey: string) {
        bindings.push([queue, exchange, routingKey]);
        return {} as never;
      },
    };

    await assertTelemetryTopology(channel, 2000);

    expect(exchanges).toEqual([
      [TELEMETRY_EXCHANGE, 'fanout', { durable: true }],
      [DEAD_LETTER_EXCHANGE, 'direct', { durable: true }],
      [RETRY_RETURN_EXCHANGE, 'direct', { durable: true }],
    ]);
    expect(queues).toContainEqual({
      name: workQueueName('health'),
      args: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-dead-letter-routing-key': 'health',
      },
    });
    expect(queues).toContainEqual({
      name: workQueueName('realtime'),
      args: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-dead-letter-routing-key': 'realtime',
      },
    });
    expect(queues).toContainEqual({
      name: retryQueueName('health'),
      args: {
        'x-message-ttl': 2000,
        'x-dead-letter-exchange': RETRY_RETURN_EXCHANGE,
        'x-dead-letter-routing-key': 'health',
      },
    });
    expect(bindings).toContainEqual([workQueueName('health'), TELEMETRY_EXCHANGE, '']);
    expect(bindings).toContainEqual([workQueueName('health'), RETRY_RETURN_EXCHANGE, 'health']);
    expect(bindings).toContainEqual([
      deadLetterQueueName('health'),
      DEAD_LETTER_EXCHANGE,
      'health',
    ]);
    expect(bindings).toContainEqual([
      deadLetterQueueName('realtime'),
      DEAD_LETTER_EXCHANGE,
      'realtime',
    ]);
  });
});