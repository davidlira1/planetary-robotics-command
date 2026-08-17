import { isNewerRecordedAt, newerCurrentState } from './recorded-at';

describe('recordedAt chronology', () => {
  it('treats missing existing as older', () => {
    expect(isNewerRecordedAt('2026-08-13T20:00:05.000Z', undefined)).toBe(true);
  });

  it('rejects equal or older incoming timestamps', () => {
    expect(isNewerRecordedAt('2026-08-13T20:00:04.000Z', '2026-08-13T20:00:05.000Z')).toBe(false);
    expect(isNewerRecordedAt('2026-08-13T20:00:05.000Z', '2026-08-13T20:00:05.000Z')).toBe(false);
  });

  it('picks the newer of REST and stream state', () => {
    const rest = { recordedAt: '2026-08-13T20:00:04.000Z' };
    const stream = { recordedAt: '2026-08-13T20:00:05.000Z' };
    expect(newerCurrentState(rest, stream)).toBe(stream);
    expect(newerCurrentState(stream, rest)).toBe(stream);
    expect(newerCurrentState(null, stream)).toBe(stream);
    expect(newerCurrentState(rest, undefined)).toBe(rest);
  });
});
