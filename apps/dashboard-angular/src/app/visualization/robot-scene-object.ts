import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  INTERPOLATION_DELAY_MS,
  INTERPOLATION_DIAGNOSTICS,
  InterpolationBuffer,
  type InterpolatedPose,
} from './interpolation-buffer';
import { createRobotVisual } from './robot-models/create-robot-visual';
import type { RobotVisual } from './robot-models/robot-visual';
import { robotWorldTheme } from './robot-world-theme';
import type { RobotWorldRobot } from './robot-world';
import { robotIdFromDataset, type LabelInteract } from './world-pointer-interaction';

const LABEL_HEIGHT = 11.5;
const LOCATOR_HEIGHT = 11;
const HOVER_AMPLITUDE = 0.35;
const HOVER_RATE = 1.6;
const DIAGNOSTIC_THROTTLE_MS = 500;
const ARRIVAL_DELTA_LIMIT = 8;

export class RobotSceneObject {
  readonly group: THREE.Group;
  readonly authoritativePosition = new THREE.Vector3();
  readonly renderedPosition = new THREE.Vector3();
  renderedHeadingDegrees = 0;
  private readonly motion = new InterpolationBuffer();

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
  private selected = false;
  private hovered = false;
  private pulseTime = 0;
  private hoverTime = 0;
  private healthStatus: RobotWorldRobot['healthStatus'] = null;
  private lastArrivalWallMs: number | null = null;
  private lastClockSkewMs: number | null = null;
  private lastDiagnosticLogMs = 0;
  private readonly arrivalDeltasMs: number[] = [];
  private labelHandler: ((event: LabelInteract) => void) | null = null;
  private readonly onLabelPointerEnter = () => {
    this.labelHandler?.({ type: 'enter', robotId: this.labelRobotId() });
  };
  private readonly onLabelPointerLeave = () => {
    this.labelHandler?.({ type: 'leave', robotId: this.labelRobotId() });
  };
  private readonly onLabelClick = (event: Event) => {
    this.labelHandler?.({
      type: 'click',
      robotId: this.labelRobotId(),
      event,
    });
  };

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
    this.labelElement.dataset['robotId'] = robot.id;
    this.labelElement.classList.add('prc-robot-label--interactive');
    this.labelElement.addEventListener('pointerenter', this.onLabelPointerEnter);
    this.labelElement.addEventListener('pointerleave', this.onLabelPointerLeave);
    this.labelElement.addEventListener('click', this.onLabelClick);
    this.label = new CSS2DObject(this.labelElement);
    this.label.userData['robotId'] = robot.id;
    this.label.position.set(0, LABEL_HEIGHT, 0);

    this.group.add(this.visualRoot, this.ring, this.locator, this.label);
    this.applyRobot(robot, true);
  }

  applyRobot(robot: RobotWorldRobot, snap = false): void {
    if (robot.position) {
      this.authoritativePosition.set(robot.position.x, robot.position.y, robot.position.z);
      const recordedAtMs = Date.parse(robot.recordedAt);
      if (Number.isFinite(recordedAtMs)) {
        const firstSample = this.motion.size === 0;
        const accepted = this.motion.push({
          recordedAtMs,
          position: robot.position,
          headingDegrees: robot.headingDegrees,
          velocityMetersPerSecond: robot.velocityMetersPerSecond,
        });
        if (accepted) {
          this.recordArrival(recordedAtMs);
        }
        if (snap || firstSample) {
          this.applyRenderedPose({
            position: robot.position,
            headingDegrees: robot.headingDegrees,
            velocityMetersPerSecond: robot.velocityMetersPerSecond,
          });
        }
      }
    }
    this.healthStatus = robot.healthStatus;
    this.updateLabel(robot);
    this.syncVisualState();
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.labelElement.classList.toggle('prc-robot-label--selected', selected);
    this.syncAccent();
    this.syncVisualState();
  }

  tick(deltaSeconds: number): void {
    const previous = this.renderedPosition.clone();
    const pose = this.motion.poseAt(Date.now() - INTERPOLATION_DELAY_MS);
    if (pose) {
      this.applyRenderedPose(pose);
    }
    const travelDistanceMeters = this.renderedPosition.distanceTo(previous);

    this.hoverTime += deltaSeconds;
    this.visualRoot.position.y =
      this.type === 'DRONE' ? Math.sin(this.hoverTime * HOVER_RATE) * HOVER_AMPLITUDE : 0;

    this.visual.tick(deltaSeconds, {
      velocityMetersPerSecond: this.velocityMetersPerSecond,
      travelDistanceMeters,
    });

    if (this.selected) {
      this.pulseTime += deltaSeconds;
    }
    this.syncAccent();
  }

  logInterpolationDiagnostics(nowMs = Date.now()): void {
    if (!INTERPOLATION_DIAGNOSTICS || nowMs - this.lastDiagnosticLogMs < DIAGNOSTIC_THROTTLE_MS) {
      return;
    }
    this.lastDiagnosticLogMs = nowMs;
    const renderTimeMs = nowMs - INTERPOLATION_DELAY_MS;
    const inspect = this.motion.inspectPoseAt(renderTimeMs);
    if (!inspect) {
      return;
    }
    console.debug('[prc-interp]', {
      robotId: this.group.name,
      newestRecordedAtMs: inspect.newestRecordedAtMs,
      previousRecordedAtMs: inspect.previousRecordedAtMs,
      oldestRecordedAtMs: inspect.oldestRecordedAtMs,
      nowMs,
      renderTimeMs,
      mode: inspect.mode,
      t: inspect.t,
      arrivalDeltasMs: [...this.arrivalDeltasMs],
      clockSkewMs: this.lastClockSkewMs,
      sampleCount: inspect.sampleCount,
    });
  }

  dispose(): void {
    this.labelHandler = null;
    this.labelElement.removeEventListener('pointerenter', this.onLabelPointerEnter);
    this.labelElement.removeEventListener('pointerleave', this.onLabelPointerLeave);
    this.labelElement.removeEventListener('click', this.onLabelClick);
    this.visual.dispose();
    this.ring.geometry.dispose();
    this.locator.geometry.dispose();
    this.ringMaterial.dispose();
    this.locatorMaterial.dispose();
    this.labelElement.remove();
  }

  private recordArrival(recordedAtMs: number): void {
    const nowMs = Date.now();
    this.lastClockSkewMs = nowMs - recordedAtMs;
    if (this.lastArrivalWallMs != null) {
      this.arrivalDeltasMs.push(nowMs - this.lastArrivalWallMs);
      if (this.arrivalDeltasMs.length > ARRIVAL_DELTA_LIMIT) {
        this.arrivalDeltasMs.shift();
      }
    }
    this.lastArrivalWallMs = nowMs;
  }

  private labelRobotId(): string {
    return robotIdFromDataset(this.labelElement) ?? this.group.name;
  }

  private applyRenderedPose(pose: InterpolatedPose): void {
    this.renderedPosition.set(pose.position.x, pose.position.y, pose.position.z);
    this.group.position.copy(this.renderedPosition);
    this.renderedHeadingDegrees = pose.headingDegrees;
    this.visualRoot.rotation.y = THREE.MathUtils.degToRad(this.renderedHeadingDegrees);
    this.velocityMetersPerSecond = pose.velocityMetersPerSecond;
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
    this.labelElement.dataset['robotId'] = robot.id;
  }

  setLabelHandler(handler: ((event: LabelInteract) => void) | null): void {
    this.labelHandler = handler;
  }

  setHovered(hovered: boolean): void {
    this.hovered = hovered;
    this.labelElement.classList.toggle('prc-robot-label--hovered', hovered);
    this.syncAccent();
    this.syncVisualState();
  }

  private syncVisualState(): void {
    this.visual.updateVisualState({
      healthStatus: this.healthStatus,
      selected: this.selected,
      hovered: this.hovered,
    });
  }

  private syncAccent(): void {
    if (this.selected) {
      const pulse = 0.5 + 0.5 * Math.sin(this.pulseTime * 3.1);
      this.ringMaterial.opacity = 0.5 + 0.4 * pulse;
      this.locatorMaterial.opacity = 0.22 + 0.18 * pulse;
      return;
    }
    if (this.hovered) {
      this.ringMaterial.opacity = 0.28;
      this.locatorMaterial.opacity = 0.14;
      return;
    }
    this.ringMaterial.opacity = 0;
    this.locatorMaterial.opacity = 0;
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
    classList: { add: () => undefined, toggle: () => undefined },
    innerHTML: '',
    dataset: {},
    addEventListener() {
      /* no-op */
    },
    removeEventListener() {
      /* no-op */
    },
    querySelector(selector: string) {
      return parts[selector] ?? null;
    },
    remove() {
      /* no-op */
    },
  } as unknown as HTMLDivElement;
}
