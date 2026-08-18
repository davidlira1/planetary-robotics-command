import { IntegrationEvent } from './messaging-types';

export interface EventPublisher {
  publish(event: IntegrationEvent): Promise<void>;
  close(): Promise<void>;
}
