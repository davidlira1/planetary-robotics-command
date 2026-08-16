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

  it('eases camera position while keeping the orbit target on the subject', () => {
    const camera = { position: { x: 0, y: 0, z: 0 } };
    const controls = { target: { x: 0, y: 0, z: 0 } };
    const controller = new RobotWorldCameraController();
    controller.begin({ x: 100, y: 0, z: 0 }, { x: 20, y: 0, z: 0 });
    controller.tick(1 / 60, camera, controls);
    expect(controls.target).toEqual({ x: 20, y: 0, z: 0 });
    expect(camera.position.x).toBeGreaterThan(0);
    expect(camera.position.x).toBeLessThan(100);
    expect(controller.active).toBe(true);
  });
});
