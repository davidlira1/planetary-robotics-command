import { InspectionFacade } from '../features/inspection/state/inspection-facade';
import { focusSelectedRobot, handleWorldRobotClick } from './inspect-world-robot';

function clickWorld(
  robotId: string,
  selectedRobotId: string | null,
  inspection: InspectionFacade,
  focusRobot = jest.fn(),
) {
  let selectedId = selectedRobotId;
  handleWorldRobotClick(robotId, {
    selectedRobotId,
    selectRobot: (id) => {
      selectedId = id;
    },
    focusRobot,
    closeInspection: () => inspection.close(),
    toggleAsset: () => inspection.toggleAsset(),
  });
  return { selectedId, focusRobot };
}

describe('handleWorldRobotClick', () => {
  it('selects and focuses an unselected robot without opening the drawer', () => {
    const inspection = new InspectionFacade();
    const { selectedId, focusRobot } = clickWorld('D-04', null, inspection);
    expect(selectedId).toBe('D-04');
    expect(focusRobot).toHaveBeenCalledWith('D-04');
    expect(inspection.mode()).toBeNull();
  });

  it('opens the drawer on a second click of the same robot without refocusing', () => {
    const inspection = new InspectionFacade();
    const focusRobot = jest.fn();
    clickWorld('D-04', 'D-04', inspection, focusRobot);
    expect(inspection.mode()).toBe('asset');
    expect(focusRobot).not.toHaveBeenCalled();
  });

  it('closes the drawer on a third click of the same robot and keeps selection', () => {
    const inspection = new InspectionFacade();
    inspection.openAsset();
    const { selectedId, focusRobot } = clickWorld('D-04', 'D-04', inspection);
    expect(inspection.mode()).toBeNull();
    expect(selectedId).toBe('D-04');
    expect(focusRobot).not.toHaveBeenCalled();
  });

  it('switches robots, closes the drawer, and does not open the new drawer', () => {
    const inspection = new InspectionFacade();
    inspection.openAsset();
    const { selectedId, focusRobot } = clickWorld('H-17', 'D-04', inspection);
    expect(selectedId).toBe('H-17');
    expect(focusRobot).toHaveBeenCalledWith('H-17');
    expect(inspection.mode()).toBeNull();
  });

  it('does not clear fleet selection when the inspector closes', () => {
    const inspection = new InspectionFacade();
    const { selectedId } = clickWorld('D-04', 'D-04', inspection);
    expect(inspection.mode()).toBe('asset');
    inspection.close();
    expect(inspection.mode()).toBeNull();
    expect(selectedId).toBe('D-04');
  });

  it('uses the same state machine for model and label clicks', () => {
    const inspection = new InspectionFacade();
    const focusRobot = jest.fn();
    const model = clickWorld('D-04', null, inspection, focusRobot);
    const label = clickWorld('D-04', null, inspection, focusRobot);
    expect(model.selectedId).toBe(label.selectedId);
    expect(focusRobot).toHaveBeenCalledTimes(2);
    expect(focusRobot.mock.calls).toEqual([['D-04'], ['D-04']]);
    expect(inspection.mode()).toBeNull();
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
