import { EventPublisher, IntegrationEvent } from '@prc/ports';
import { ServiceBusClient, ServiceBusSender } from '@azure/service-bus';

export interface AzureServiceBusPublisherConfig {
  connectionString: string;
  topicName: string;
}

export class AzureServiceBusEventPublisher implements EventPublisher {
  private readonly client: ServiceBusClient;
  private readonly sender: ServiceBusSender;

  constructor(config: AzureServiceBusPublisherConfig) {
    this.client = new ServiceBusClient(config.connectionString);
    this.sender = this.client.createSender(config.topicName);
  }

  async publish(event: IntegrationEvent): Promise<void> {
    const body = {
      eventId: event.eventId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      occurredAt: event.occurredAt.toISOString(),
      correlationId: event.correlationId,
      causationId: event.causationId,
      payload: event.payload,
    };

    await this.sender.sendMessages({
      body,
      contentType: 'application/json',
      messageId: event.eventId,
      correlationId: event.correlationId,
      subject: event.eventType,
      applicationProperties: {
        eventType: event.eventType,
        eventVersion: event.eventVersion,
      },
    });
  }

  async close(): Promise<void> {
    await this.sender.close();
    await this.client.close();
  }
}
