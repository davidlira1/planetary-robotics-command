import { RobotWorldCameraController } from './robot-world-camera-controller';

describe('RobotWorldCameraController', () => {
  it('snaps camera position and orbit target immediately', () => {
    const camera = { position: { x: 0, y: 0, z: 0 } };
    const controls = { target: { x: 0, y: 0, z: 0 } };
    const controller = new RobotWorldCameraController();
    controller.snap(camera, controls, { x: 10, y: 4, z: 2 }, { x: 1, y: 0, z: 0 });
    expect(camera.position).toEqual({ x: 10, y: 4, z: 2 });
    expect(controls.target).toEqual({ x: 1, y: 0, z: 0 });
    expect(controller.active).toBe(false);
  });

  it('does not write camera.position or controls.target in begin()', () => {
    const camera = { position: { x: 320, y: 180, z: 440 } };
    const controls = { target: { x: 40, y: 30, z: -35 } };
    const controller = new RobotWorldCameraController();
    controller.begin({ x: 155, y: 40, z: 110 }, { x: 140, y: 12, z: 72 });
    expect(camera.position).toEqual({ x: 320, y: 180, z: 440 });
    expect(controls.target).toEqual({ x: 40, y: 30, z: -35 });
    expect(controller.active).toBe(true);
  });

  it('eases camera position and orbit target toward the desired pose', () => {
    const camera = { position: { x: 0, y: 0, z: 0 } };
    const controls = { target: { x: 0, y: 0, z: 0 } };
    const controller = new RobotWorldCameraController();
    controller.begin({ x: 100, y: 0, z: 0 }, { x: 20, y: 0, z: 0 });
    controller.tick(1 / 60, camera, controls);
    expect(controls.target.x).toBeGreaterThan(0);
    expect(controls.target.x).toBeLessThan(20);
    expect(camera.position.x).toBeGreaterThan(0);
    expect(camera.position.x).toBeLessThan(100);
    expect(controller.active).toBe(true);
  });

  it('interpolates the orbit target toward the robot instead of snapping', () => {
    const camera = { position: { x: 0, y: 0, z: 80 } };
    const controls = { target: { x: 0, y: 0, z: 0 } };
    const robot = { x: 40, y: 10, z: 20 };
    const controller = new RobotWorldCameraController();
    controller.begin({ x: 40, y: 10, z: 52 }, robot);
    let previous = Math.hypot(robot.x - controls.target.x, robot.y - controls.target.y, robot.z - controls.target.z);
    for (let i = 0; i < 8; i += 1) {
      controller.tick(1 / 60, camera, controls);
      const remaining = Math.hypot(
        robot.x - controls.target.x,
        robot.y - controls.target.y,
        robot.z - controls.target.z,
      );
      expect(remaining).toBeLessThan(previous);
      expect(remaining).toBeGreaterThan(0.08);
      previous = remaining;
    }
  });
});
