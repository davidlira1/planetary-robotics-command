import type { FleetAlert, FleetRobot } from '../../../core/models';
import { formatIsoTime, formatNumber, formatPosition } from '../../../shared/format';

export type InspectionTone = 'default' | 'accent' | 'healthy' | 'warning' | 'critical';

export interface InspectionCard {
  label: string;
  value: string;
  tone: InspectionTone;
}

export function healthTone(status: string | null | undefined): InspectionTone {
  if (status === 'CRITICAL') {
    return 'critical';
  }
  if (status === 'WARNING') {
    return 'warning';
  }
  if (status === 'HEALTHY') {
    return 'healthy';
  }
  return 'default';
}

export function severityTone(severity: string | null | undefined): InspectionTone {
  return severity === 'CRITICAL' ? 'critical' : 'warning';
}

export function alertInspectionCards(alert: FleetAlert | null): InspectionCard[] {
  return [
    { label: 'SEVERITY', value: alert?.severity ?? '—', tone: severityTone(alert?.severity) },
    { label: 'ROBOT', value: alert?.robotId ?? '—', tone: 'accent' },
    { label: 'STATUS', value: alert?.status ?? '—', tone: 'default' },
    { label: 'CREATED', value: formatIsoTime(alert?.createdAt), tone: 'default' },
  ];
}

export function assetInspectionCards(robot: FleetRobot | null): InspectionCard[] {
  const health = robot?.health?.status ?? '—';
  const position = robot?.currentState
    ? formatPosition(
        robot.currentState.position.x,
        robot.currentState.position.y,
        robot.currentState.position.z,
      )
    : '—';
  const heading = robot?.currentState ? `${formatNumber(robot.currentState.headingDegrees, 0)}°` : '—';
  const recorded = robot?.currentState ? formatIsoTime(robot.currentState.recordedAt) : '—';
  return [
    { label: 'HEALTH', value: health, tone: healthTone(robot?.health?.status) },
    { label: 'RECORDED AT', value: recorded, tone: 'default' },
    { label: 'POSITION', value: position, tone: 'default' },
    { label: 'HEADING', value: heading, tone: 'default' },
  ];
}
