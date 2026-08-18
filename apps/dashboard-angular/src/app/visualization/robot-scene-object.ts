import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { predictedPosition } from './dead-reckoning';
import { HEADING_SMOOTHING, POSITION_SMOOTHING, exponentialSmoothingAlpha } from './exponential-smoothing';
import { lerpHeadingDegrees } from './heading';
import { createRobotVisual } from './robot-models/create-robot-visual';
import type { RobotVisual } from './robot-models/robot-visual';
import { robotWorldTheme } from './robot-world-theme';
import type { RobotWorldRobot } from './robot-world';

const LABEL_HEIGHT = 11.5;
const LOCATOR_HEIGHT = 11;
const HOVER_AMPLITUDE = 0.35;
const HOVER_RATE = 1.6;

export class RobotSceneObject {
  readonly group: THREE.Group;
  readonly authoritativePosition = new THREE.Vector3();
  readonly targetPosition = this.authoritativePosition;
  readonly predictedTargetPosition = new THREE.Vector3();
  readonly renderedPosition = new THREE.Vector3();

  private readonly visualRoot: THREE.Group;
  private readonly visual: RobotVisual;
  private readonly ring: THREE.Mesh;
  private readonly locator: THREE.Mesh;
  private readonly ringMaterial: THREE.MeshBasicMaterial;
  private readonly locatorMaterial: THREE.MeshBasicMaterial;
  private readonly label: CSS2DObject;
  private readonly labelElement: HTMLDivElement;
  private readonly type: RobotWorldRobot['type'];

  private velocityMetersPerSecond = 0;
  private headingDegrees = 0;
  private renderedHeadingDegrees = 0;
  private lastTelemetryReceivedAt = 0;
  private selected = false;
  private pulseTime = 0;
  private hoverTime = 0;
  private healthStatus: RobotWorldRobot['healthStatus'] = null;

  constructor(robot: RobotWorldRobot) {
    this.type = robot.type;
    this.group = new THREE.Group();
    this.group.name = robot.id;
    this.group.userData['robotId'] = robot.id;

    this.visualRoot = new THREE.Group();
    this.visual = createRobotVisual(robot.type);
    this.visualRoot.add(this.visual.group);

    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: robotWorldTheme.accent,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.22, 8, 40), this.ringMaterial);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.18;

    this.locatorMaterial = new THREE.MeshBasicMaterial({
      color: robotWorldTheme.accent,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.locator = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, LOCATOR_HEIGHT, 6),
      this.locatorMaterial,
    );
    this.locator.position.y = LOCATOR_HEIGHT / 2;

    this.labelElement = createLabelElement();
    this.label = new CSS2DObject(this.labelElement);
    this.label.position.set(0, LABEL_HEIGHT, 0);

    this.group.add(this.visualRoot, this.ring, this.locator, this.label);
    this.applyRobot(robot, true);
  }

  applyRobot(robot: RobotWorldRobot, snap = false): void {
    if (robot.position) {
      this.authoritativePosition.set(robot.position.x, robot.position.y, robot.position.z);
      if (snap) {
        this.predictedTargetPosition.copy(this.authoritativePosition);
        this.renderedPosition.copy(this.authoritativePosition);
        this.group.position.copy(this.renderedPosition);
        this.renderedHeadingDegrees = robot.headingDegrees;
        this.visualRoot.rotation.y = THREE.MathUtils.degToRad(this.renderedHeadingDegrees);
      }
    }
    this.velocityMetersPerSecond = robot.velocityMetersPerSecond;
    this.headingDegrees = robot.headingDegrees;
    this.healthStatus = robot.healthStatus;
    this.lastTelemetryReceivedAt = performance.now();
    this.updateLabel(robot);
    this.visual.updateVisualState({ healthStatus: robot.healthStatus, selected: this.selected });
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.labelElement.classList.toggle('prc-robot-label--selected', selected);
    if (!selected) {
      this.ringMaterial.opacity = 0;
      this.locatorMaterial.opacity = 0;
    }
    this.visual.updateVisualState({ healthStatus: this.healthStatus, selected });
  }

  tick(deltaSeconds: number): void {
    const elapsedSeconds = (performance.now() - this.lastTelemetryReceivedAt) / 1000;
    const predicted = predictedPosition(
      {
        x: this.authoritativePosition.x,
        y: this.authoritativePosition.y,
        z: this.authoritativePosition.z,
      },
      this.velocityMetersPerSecond,
      this.headingDegrees,
      elapsedSeconds,
    );
    this.predictedTargetPosition.set(predicted.x, predicted.y, predicted.z);

    const positionAlpha = exponentialSmoothingAlpha(POSITION_SMOOTHING, deltaSeconds);
    this.renderedPosition.lerp(this.predictedTargetPosition, positionAlpha);
    this.group.position.copy(this.renderedPosition);

    const headingAlpha = exponentialSmoothingAlpha(HEADING_SMOOTHING, deltaSeconds);
    this.renderedHeadingDegrees = lerpHeadingDegrees(
      this.renderedHeadingDegrees,
      this.headingDegrees,
      headingAlpha,
    );
    this.visualRoot.rotation.y = THREE.MathUtils.degToRad(this.renderedHeadingDegrees);

    this.hoverTime += deltaSeconds;
    this.visualRoot.position.y =
      this.type === 'DRONE' ? Math.sin(this.hoverTime * HOVER_RATE) * HOVER_AMPLITUDE : 0;

    this.visual.tick(deltaSeconds, { velocityMetersPerSecond: this.velocityMetersPerSecond });

    if (this.selected) {
      this.pulseTime += deltaSeconds;
      const pulse = 0.5 + 0.5 * Math.sin(this.pulseTime * 3.1);
      this.ringMaterial.opacity = 0.5 + 0.4 * pulse;
      this.locatorMaterial.opacity = 0.22 + 0.18 * pulse;
    }
  }

  dispose(): void {
    this.visual.dispose();
    this.ring.geometry.dispose();
    this.locator.geometry.dispose();
    this.ringMaterial.dispose();
    this.locatorMaterial.dispose();
    this.labelElement.remove();
  }

  private updateLabel(robot: RobotWorldRobot): void {
    const id = this.labelElement.querySelector('.prc-robot-label__id');
    const type = this.labelElement.querySelector('.prc-robot-label__type');
    const pip = this.labelElement.querySelector('.prc-robot-label__pip');
    if (id) {
      id.textContent = robot.id;
    }
    if (type) {
      type.textContent = robot.type;
    }
    if (pip) {
      pip.className = `prc-robot-label__pip prc-robot-label__pip--${healthPipClass(robot.healthStatus)}`;
    }
    this.labelElement.dataset['health'] = robot.healthStatus ?? '';
  }
}

function healthPipClass(status: RobotWorldRobot['healthStatus']): string {
  if (status === 'WARNING') {
    return 'warning';
  }
  if (status === 'CRITICAL') {
    return 'critical';
  }
  if (status === 'HEALTHY') {
    return 'healthy';
  }
  return 'unknown';
}

function createLabelElement(): HTMLDivElement {
  if (typeof document !== 'undefined') {
    const element = document.createElement('div');
    element.className = 'prc-robot-label';
    element.innerHTML =
      '<span class="prc-robot-label__id"></span>' +
      '<span class="prc-robot-label__type"></span>' +
      '<span class="prc-robot-label__pip"></span>';
    return element;
  }
  const parts: Record<string, { textContent: string; className: string }> = {
    '.prc-robot-label__id': { textContent: '', className: '' },
    '.prc-robot-label__type': { textContent: '', className: '' },
    '.prc-robot-label__pip': { textContent: '', className: '' },
  };
  return {
    className: 'prc-robot-label',
    classList: { toggle: () => undefined },
    innerHTML: '',
    dataset: {},
    querySelector(selector: string) {
      return parts[selector] ?? null;
    },
    remove() {
      /* no-op */
    },
  } as unknown as HTMLDivElement;
}
