import * as THREE from 'three';
import { exponentialSmoothingAlpha, POSITION_SMOOTHING } from './exponential-smoothing';
import { robotWorldTheme } from './robot-world-theme';
import type { RobotWorldRobot, RobotWorldType } from './robot-world';

function healthColor(status: RobotWorldRobot['healthStatus']): number {
  if (status === 'WARNING') {
    return robotWorldTheme.warning;
  }
  if (status === 'CRITICAL') {
    return robotWorldTheme.critical;
  }
  if (status === 'HEALTHY') {
    return robotWorldTheme.normal;
  }
  return robotWorldTheme.muted;
}

function typeGeometry(type: RobotWorldType): THREE.BufferGeometry {
  switch (type) {
    case 'DRONE':
      return new THREE.OctahedronGeometry(4.2, 0);
    case 'HAULER':
      return new THREE.BoxGeometry(7.2, 3.4, 5.4);
    case 'MINER':
      return new THREE.DodecahedronGeometry(4.4, 0);
    case 'WORKER':
      return new THREE.CylinderGeometry(2.6, 3.2, 5.2, 6);
    case 'SCOUT':
      return new THREE.ConeGeometry(3.2, 6.4, 5);
    case 'UNKNOWN':
      return new THREE.SphereGeometry(3.4, 12, 10);
  }
}

export class RobotSceneObject {
  readonly group: THREE.Group;
  readonly targetPosition = new THREE.Vector3();
  readonly renderedPosition = new THREE.Vector3();

  private readonly body: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly ringMaterial: THREE.MeshBasicMaterial;

  constructor(robot: RobotWorldRobot) {
    this.group = new THREE.Group();
    this.group.name = robot.id;
    this.group.userData['robotId'] = robot.id;

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: healthColor(robot.healthStatus),
      metalness: 0.15,
      roughness: 0.55,
    });
    this.body = new THREE.Mesh(typeGeometry(robot.type), this.bodyMaterial);
    this.body.castShadow = false;

    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: robotWorldTheme.accent,
      transparent: true,
      opacity: 0,
    });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.28, 8, 32), this.ringMaterial);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.2;

    this.group.add(this.body, this.ring);
    this.applyRobot(robot, true);
  }

  applyRobot(robot: RobotWorldRobot, snap = false): void {
    if (robot.position) {
      this.targetPosition.set(robot.position.x, robot.position.y, robot.position.z);
      if (snap) {
        this.renderedPosition.copy(this.targetPosition);
        this.group.position.copy(this.renderedPosition);
      }
    }
    this.group.rotation.y = THREE.MathUtils.degToRad(robot.headingDegrees);
    this.bodyMaterial.color.setHex(healthColor(robot.healthStatus));
  }

  setSelected(selected: boolean): void {
    this.ringMaterial.opacity = selected ? 0.95 : 0;
  }

  tick(deltaSeconds: number): void {
    const alpha = exponentialSmoothingAlpha(POSITION_SMOOTHING, deltaSeconds);
    this.renderedPosition.lerp(this.targetPosition, alpha);
    this.group.position.copy(this.renderedPosition);
  }

  dispose(): void {
    this.body.geometry.dispose();
    this.ring.geometry.dispose();
    this.bodyMaterial.dispose();
    this.ringMaterial.dispose();
  }
}
