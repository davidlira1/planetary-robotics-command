import type { FleetAlert, FleetRobot } from '../../../core/models';
import { alertInspectionCards, assetInspectionCards, healthTone, severityTone } from './inspection-card';

describe('inspection card tones', () => {
  it('maps health and severity to semantic tones, not CSS class names', () => {
    expect(healthTone('CRITICAL')).toBe('critical');
    expect(healthTone('WARNING')).toBe('warning');
    expect(healthTone('HEALTHY')).toBe('healthy');
    expect(healthTone(null)).toBe('default');
    expect(severityTone('CRITICAL')).toBe('critical');
    expect(severityTone('WARNING')).toBe('warning');
  });

  it('builds alert cards from the alert snapshot', () => {
    const alert = {
      id: 'a1',
      robotId: 'D-04',
      type: 'LOW_BATTERY',
      severity: 'WARNING',
      status: 'OPEN',
      title: 'Low battery',
      message: 'Battery entered warning threshold.',
      sourceTelemetryId: 't1',
      sourceEventId: 'e1',
      createdAt: '2026-08-15T18:00:00.000Z',
      acknowledgedAt: null,
      acknowledgedBy: null,
    } satisfies FleetAlert;
    const cards = alertInspectionCards(alert);
    expect(cards.map((card) => card.tone)).toEqual(['warning', 'accent', 'default', 'default']);
    expect(cards[1]?.value).toBe('D-04');
  });

  it('builds asset cards from the selected robot', () => {
    const robot = {
      id: 'D-04',
      displayName: 'D-04',
      type: 'DRONE',
      model: 'AX-4',
      operationalStatus: 'ACTIVE',
      currentState: null,
      health: {
        status: 'HEALTHY',
        batteryStatus: 'NORMAL',
        temperatureStatus: 'NORMAL',
        signalStatus: 'NORMAL',
        evaluatedFromTelemetryId: 't1',
        evaluatedFromRecordedAt: '2026-08-15T00:00:00.000Z',
        updatedAt: '2026-08-15T00:00:01.000Z',
      },
    } satisfies FleetRobot;
    const cards = assetInspectionCards(robot);
    expect(cards[0]).toEqual({ label: 'HEALTH', value: 'HEALTHY', tone: 'healthy' });
  });
});
