import type {
  ApiV1AlertsGet200ResponseItemsInner,
  ApiV1FleetGet200Response,
  ApiV1FleetGet200ResponseRobotsInner,
  ApiV1FleetGet200ResponseRobotsInnerCurrentState,
  ApiV1FleetGet200ResponseRobotsInnerHealth,
} from '@prc/api-client-angular';

export type FleetSnapshot = ApiV1FleetGet200Response;
export type FleetRobot = ApiV1FleetGet200ResponseRobotsInner;
export type FleetRobotCurrentState = ApiV1FleetGet200ResponseRobotsInnerCurrentState;
export type FleetRobotHealth = ApiV1FleetGet200ResponseRobotsInnerHealth;
export type FleetAlert = ApiV1AlertsGet200ResponseItemsInner;

export type HealthStatus = FleetRobotHealth['status'];
export type OperationalStatus = FleetRobot['operationalStatus'];
export type RobotType = FleetRobot['type'];
export type AlertSeverity = FleetAlert['severity'];

export interface AlertsResult {
  items: FleetAlert[];
}

export interface AlertsQuery {
  status: 'OPEN';
  limit: number;
}
