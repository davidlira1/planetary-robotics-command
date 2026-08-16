import type { FleetRobot, HealthStatus, OperationalStatus } from '../core/models';

export function typeBadge(robot: FleetRobot): string {
  const letters = robot.id.replace(/[^A-Za-z]/g, '');
  const digits = robot.id.replace(/\D/g, '');
  const letter = letters.slice(0, 1) || robot.type.slice(0, 1);
  const digit = digits.slice(-1) || '';
  return `${letter}${digit}`.toUpperCase() || robot.type.slice(0, 2);
}

export function typeLabel(robot: FleetRobot): string {
  return `${robot.model} ${robot.type.replaceAll('_', ' ')}`;
}

export function padCount(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatClock(date: Date | null): string {
  if (!date) {
    return '—';
  }
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatIsoTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatClock(date);
}

export function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits);
}

export function formatPosition(x: number, y: number, z: number): string {
  return `${Math.round(x)}, ${Math.round(y)}, ${Math.round(z)}`;
}

export function healthStatusLabel(status: HealthStatus | null | undefined): string | null {
  if (status === 'WARNING') {
    return 'warning';
  }
  if (status === 'CRITICAL') {
    return 'critical';
  }
  if (status === 'HEALTHY') {
    return 'healthy';
  }
  return null;
}

export function robotAccessibleName(robot: FleetRobot): string {
  const health = healthStatusLabel(robot.health?.status);
  if (!health) {
    return `${robot.id}, ${typeLabel(robot)}`;
  }
  return `${robot.id}, ${typeLabel(robot)}, health ${health}`;
}

export function operationalLabel(status: OperationalStatus): string {
  return status;
}

export function alertTypeLabel(type: string): string {
  return type.replaceAll('_', ' ');
}
