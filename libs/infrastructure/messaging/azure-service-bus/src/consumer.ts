import {
  ProcessErrorArgs,
  ServiceBusClient,
  ServiceBusReceivedMessage,
  ServiceBusReceiver,
} from '@azure/service-bus';
import type {
  SettlementAction,
  TelemetryConsumer,
  TelemetryMessageHandler,
} from '@prc/ports';

export type { SettlementAction };

export interface AzureServiceBusConsumerConfig {
  connectionString: string;
  topicName: string;
  subscriptionName: string;
}

export class AzureServiceBusTelemetryConsumer implements TelemetryConsumer {
  private readonly client: ServiceBusClient;
  private readonly receiver: ServiceBusReceiver;
  private running = false;

  constructor(private readonly config: AzureServiceBusConsumerConfig) {
    this.client = new ServiceBusClient(config.connectionString);
    this.receiver = this.client.createReceiver(
      config.topicName,
      config.subscriptionName,
      { receiveMode: 'peekLock' },
    );
  }

  async start(handler: TelemetryMessageHandler): Promise<void> {
    this.running = true;
    this.receiver.subscribe({
      processMessage: async (message: ServiceBusReceivedMessage) => {
        if (!this.running) {
          await this.receiver.abandonMessage(message);
          return;
        }
        try {
          const action: SettlementAction = await handler(message.body, {
            messageId: String(message.messageId ?? ''),
            correlationId:
              message.correlationId != null ? String(message.correlationId) : undefined,
            deliveryCount: message.deliveryCount ?? 1,
          });
          if (action === 'complete') {
            await this.receiver.completeMessage(message);
          } else if (action === 'abandon') {
            await this.receiver.abandonMessage(message);
          } else {
            await this.receiver.deadLetterMessage(message, {
              deadLetterReason: 'PermanentValidationFailure',
              deadLetterErrorDescription: 'Malformed or unsupported event',
            });
          }
        } catch {
          await this.receiver.abandonMessage(message);
        }
      },
      processError: async (_args: ProcessErrorArgs) => {
        // Host logs via outer logger; keep subscription alive.
      },
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.receiver.close();
    await this.client.close();
  }
}
