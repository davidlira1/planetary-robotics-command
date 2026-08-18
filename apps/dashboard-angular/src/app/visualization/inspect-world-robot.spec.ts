import { InspectionFacade } from '../features/inspection/state/inspection-facade';
import { focusSelectedRobot, inspectWorldRobot } from './inspect-world-robot';

describe('inspectWorldRobot', () => {
  it('selects, focuses the camera, and opens the inspector', () => {
    const selectRobot = jest.fn();
    const focusRobot = jest.fn();
    const openAsset = jest.fn();
    inspectWorldRobot('D-04', { selectRobot, focusRobot, openAsset });
    expect(selectRobot).toHaveBeenCalledWith('D-04');
    expect(focusRobot).toHaveBeenCalledWith('D-04');
    expect(openAsset).toHaveBeenCalledTimes(1);
    expect(selectRobot.mock.invocationCallOrder[0]).toBeLessThan(focusRobot.mock.invocationCallOrder[0]!);
    expect(focusRobot.mock.invocationCallOrder[0]).toBeLessThan(openAsset.mock.invocationCallOrder[0]!);
  });

  it('does not clear fleet selection when the inspector closes', () => {
    let selectedId: string | null = null;
    const inspection = new InspectionFacade();
    inspectWorldRobot('D-04', {
      selectRobot: (id) => {
        selectedId = id;
      },
      focusRobot: jest.fn(),
      openAsset: () => inspection.openAsset(),
    });
    expect(inspection.mode()).toBe('asset');
    inspection.close();
    expect(inspection.mode()).toBeNull();
    expect(selectedId).toBe('D-04');
  });
});

describe('focusSelectedRobot', () => {
  it('focuses a positioned selected robot without opening the inspector', () => {
    const focusRobot = jest.fn();
    const openAsset = jest.fn();
    focusSelectedRobot('W-08', true, focusRobot);
    expect(focusRobot).toHaveBeenCalledWith('W-08');
    expect(openAsset).not.toHaveBeenCalled();
  });

  it('does nothing when nothing positioned is selected', () => {
    const focusRobot = jest.fn();
    focusSelectedRobot(null, false, focusRobot);
    focusSelectedRobot('D-04', false, focusRobot);
    expect(focusRobot).not.toHaveBeenCalled();
  });
});
