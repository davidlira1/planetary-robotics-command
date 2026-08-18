import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CameraFollowSession, chasePose } from './camera-follow';
import {
  cameraPositionFromTarget,
  calculateTightFleetCameraDistance,
  DEFAULT_VIEW_OFFSET,
  MARKER_RADIUS,
  MIN_FLEET_OVERVIEW_DISTANCE,
  normalizeDirection,
} from './camera-fit';
import { findAncestorRobotId } from './find-ancestor-robot-id';
import {
  dispatchLabelSelection,
  hoverIdChanged,
  isPointerDrag,
  type LabelInteract,
} from './world-pointer-interaction';
import { boundingSphereRadius, calculateFleetBounds, calculatePositionBounds, type FleetBounds, type Vec3 } from './fleet-bounds';
import { InitialFitGate } from './initial-fit-gate';
import { applyRendererSize } from './renderer-size';
import { RobotSceneObject } from './robot-scene-object';
import { syncRegistry } from './robot-registry';
import { RobotWorldCameraController } from './robot-world-camera-controller';
import { robotWorldTheme } from './robot-world-theme';
import type { RobotWorld, RobotWorldRobot } from './robot-world';
import { createWorldDecorations } from './world-decorations';

const MIN_DISTANCE = 20;
const MIN_TERRAIN_SIZE = 240;
const TERRAIN_PADDING = 2.4;
const DEFAULT_MAX_DISTANCE = 320;
const HEMI_INTENSITY = 0.55;
const KEY_INTENSITY = 1.15;
const RIM_INTENSITY = 0.38;

export class ThreeRobotWorld implements RobotWorld {
  private renderer: THREE.WebGLRenderer | null = null;
  private labelRenderer: CSS2DRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private raycaster: THREE.Raycaster | null = null;
  private clock: THREE.Clock | null = null;
  private ground: THREE.Mesh | null = null;
  private decorations: { group: THREE.Group; dispose: () => void } | null = null;
  private readonly pointer = new THREE.Vector2();
  private readonly pickList: THREE.Object3D[] = [];
  private readonly robots = new Map<string, RobotSceneObject>();
  private hoveredRobotId: string | null = null;
  private pointerDown: { x: number; y: number } | null = null;
  private readonly fitGate = new InitialFitGate();
  private readonly cameraController = new RobotWorldCameraController();
  private readonly follow = new CameraFollowSession();
  private selectedId: string | null = null;
  private pendingRobots: readonly RobotWorldRobot[] | null = null;
  private lastPositionedRobots: readonly RobotWorldRobot[] = [];
  private lastFitPositions: Vec3[] = [];
  private lastFitTarget: Vec3 | null = null;
  private lastFitMinDistance = MIN_FLEET_OVERVIEW_DISTANCE;
  private lastFitMarkerRadius = MARKER_RADIUS;
  private needsAspectRefit = false;
  private frame = 0;
  private onRobotSelected: ((id: string) => void) | null = null;
  private readonly onClick = (event: MouseEvent) => this.handleClick(event);
  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly onPointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };
  private readonly onPointerLeave = () => this.setHoveredRobotId(null);
  private readonly onControlsStart = (): void => {
    this.cameraController.active = false;
    this.follow.cancel();
  };

  initialize(host: HTMLElement, hooks: { onRobotSelected(id: string): void }): void {
    const pending = this.pendingRobots;
    this.destroy();
    this.pendingRobots = pending;
    this.onRobotSelected = hooks.onRobotSelected;
    this.clock = new THREE.Clock();

    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(robotWorldTheme.background);
    // Diagnostic: isolate whether FOCUS SELECTED "haze" is fog, not camera motion.
    scene.fog = null;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2000);
    camera.position.set(DEFAULT_VIEW_OFFSET.x, DEFAULT_VIEW_OFFSET.y, DEFAULT_VIEW_OFFSET.z);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    applyRendererSize(renderer, width, height, window.devicePixelRatio);
    host.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.inset = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    labelRenderer.domElement.style.zIndex = '1';
    host.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = DEFAULT_MAX_DISTANCE;
    controls.target.set(0, 0, 0);
    controls.addEventListener('start', this.onControlsStart);

    const hemi = new THREE.HemisphereLight(robotWorldTheme.lightAmbient, robotWorldTheme.graphiteDark, HEMI_INTENSITY);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(robotWorldTheme.lightKey, KEY_INTENSITY);
    key.position.set(40, 80, 20);
    scene.add(key);
    const rim = new THREE.DirectionalLight(robotWorldTheme.accent, RIM_INTENSITY);
    rim.position.set(-50, 30, -40);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({
        color: robotWorldTheme.surface,
        roughness: 0.95,
        metalness: 0.05,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    ground.scale.set(MIN_TERRAIN_SIZE, MIN_TERRAIN_SIZE, 1);
    scene.add(ground);

    const decorations = createWorldDecorations();
    scene.add(decorations.group);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.labelRenderer = labelRenderer;
    this.controls = controls;
    this.ground = ground;
    this.decorations = decorations;
    this.raycaster = new THREE.Raycaster();
    renderer.domElement.addEventListener('click', this.onClick);
    renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    renderer.domElement.addEventListener('pointerleave', this.onPointerLeave);
    if (this.pendingRobots) {
      this.syncFleet(this.pendingRobots);
    }
    this.loop();
  }

  syncFleet(robots: readonly RobotWorldRobot[]): void {
    if (!this.scene) {
      this.pendingRobots = robots;
      return;
    }
    this.pendingRobots = null;
    this.lastPositionedRobots = robots.filter((robot) => robot.position !== null);
    const byId = new Map(robots.map((robot) => [robot.id, robot]));
    syncRegistry(
      robots.map((robot) => robot.id),
      this.robots,
      (id) => {
        const object = new RobotSceneObject(byId.get(id)!);
        object.setSelected(id === this.selectedId);
        object.setHovered(id === this.hoveredRobotId);
        object.setLabelHandler((event) => this.handleLabelInteract(event));
        this.scene!.add(object.group);
        return object;
      },
      (id, object) => {
        object.applyRobot(byId.get(id)!);
        object.setSelected(id === this.selectedId);
      },
      (_id, object) => {
        this.scene!.remove(object.group);
        object.dispose();
      },
    );
    this.rebuildPickList();
    if (this.hoveredRobotId && !this.robots.has(this.hoveredRobotId)) {
      this.setHoveredRobotId(null);
    }
    const bounds = calculateFleetBounds(this.lastPositionedRobots);
    this.syncTerrain(bounds);
    if (bounds && this.fitGate.shouldFit(true)) {
      this.applyFraming(this.positionedCoords(), bounds.center, false, MIN_FLEET_OVERVIEW_DISTANCE);
      this.fitGate.markFitted();
    }
  }

  setSelectedRobot(robotId: string | null): void {
    this.selectedId = robotId;
    for (const [id, object] of this.robots) {
      object.setSelected(id === robotId);
    }
  }

  fitFleet(): void {
    const positions = this.positionedCoords();
    const bounds = calculatePositionBounds(positions);
    if (!bounds) {
      return;
    }
    this.applyFraming(positions, bounds.center, true, MIN_FLEET_OVERVIEW_DISTANCE);
  }

  focusRobot(robotId: string): void {
    if (!this.camera || !this.controls) {
      return;
    }
    const subject = this.renderedSubject(robotId);
    if (!subject) {
      return;
    }

    const pose = chasePose(subject.position, subject.headingDegrees);
    const chaseSpan = Math.hypot(
      pose.position.x - pose.target.x,
      pose.position.y - pose.target.y,
      pose.position.z - pose.target.z,
    );
    const startToTarget = this.camera.position.distanceTo(this.controls.target);
    this.controls.maxDistance = Math.max(this.controls.maxDistance, startToTarget, chaseSpan);
    this.cameraController.active = false;
    this.follow.beginFocus(robotId, subject);
  }

  resize(width: number, height: number): void {
    if (!this.camera || !this.renderer) {
      return;
    }
    const usable = width >= 8 && height >= 8;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    applyRendererSize(this.renderer, width, height, window.devicePixelRatio);
    this.labelRenderer?.setSize(width, height);
    if (usable && this.needsAspectRefit && this.lastFitPositions.length && this.lastFitTarget) {
      this.needsAspectRefit = false;
      this.applyFraming(
        this.lastFitPositions,
        this.lastFitTarget,
        false,
        this.lastFitMinDistance,
        this.lastFitMarkerRadius,
      );
    }
  }

  destroy(): void {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    this.renderer?.domElement.removeEventListener('click', this.onClick);
    this.renderer?.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer?.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer?.domElement.removeEventListener('pointerleave', this.onPointerLeave);
    if (this.renderer) {
      this.renderer.domElement.style.cursor = '';
    }
    this.setHoveredRobotId(null);
    this.pointerDown = null;
    this.pickList.length = 0;
    for (const object of this.robots.values()) {
      this.scene?.remove(object.group);
      object.dispose();
    }
    this.robots.clear();
    if (this.ground) {
      this.ground.geometry.dispose();
      if (this.ground.material instanceof THREE.Material) {
        this.ground.material.dispose();
      }
      this.scene?.remove(this.ground);
    }
    if (this.decorations) {
      this.scene?.remove(this.decorations.group);
      this.decorations.dispose();
    }
    this.controls?.removeEventListener('start', this.onControlsStart);
    this.follow.cancel();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.labelRenderer?.domElement.remove();
    this.renderer = null;
    this.labelRenderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.raycaster = null;
    this.clock = null;
    this.ground = null;
    this.decorations = null;
    this.onRobotSelected = null;
    this.pendingRobots = null;
    this.lastPositionedRobots = [];
    this.lastFitPositions = [];
    this.lastFitTarget = null;
    this.needsAspectRefit = false;
    this.fitGate.reset();
    this.cameraController.active = false;
  }

  private positionedCoords(): Vec3[] {
    return this.lastPositionedRobots.flatMap((robot) => (robot.position ? [robot.position] : []));
  }

  private renderedVec(robotId: string): Vec3 | null {
    const object = this.robots.get(robotId);
    if (!object) {
      return null;
    }
    return {
      x: object.renderedPosition.x,
      y: object.renderedPosition.y,
      z: object.renderedPosition.z,
    };
  }

  private renderedSubject(robotId: string) {
    const object = this.robots.get(robotId);
    if (!object) {
      return null;
    }
    const position = this.renderedVec(robotId);
    if (!position) {
      return null;
    }
    return { position, headingDegrees: object.renderedHeadingDegrees };
  }

  private viewDirection(): Vec3 {
    if (!this.camera || !this.controls) {
      return DEFAULT_VIEW_OFFSET;
    }
    return normalizeDirection({
      x: this.camera.position.x - this.controls.target.x,
      y: this.camera.position.y - this.controls.target.y,
      z: this.camera.position.z - this.controls.target.z,
    });
  }

  private applyViewLimits(distance: number, radius: number): void {
    if (!this.camera || !this.controls || !this.scene) {
      return;
    }
    const maxDistance = Math.max(DEFAULT_MAX_DISTANCE, distance * 2.5);
    this.controls.maxDistance = maxDistance;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = distance + radius;
      this.scene.fog.far = distance + radius * 3;
    }
    this.camera.far = Math.max(2000, (this.scene.fog instanceof THREE.Fog ? this.scene.fog.far : distance + radius * 3) * 1.25);
    this.camera.updateProjectionMatrix();
  }

  private applyFraming(
    positions: readonly Vec3[],
    target: Vec3,
    animate: boolean,
    minDistance: number,
    markerRadius = MARKER_RADIUS,
  ): void {
    if (!this.camera || !this.controls) {
      return;
    }
    this.follow.cancel();
    const bounds = calculatePositionBounds(positions);
    if (!bounds) {
      return;
    }
    this.lastFitPositions = [...positions];
    this.lastFitTarget = target;
    this.lastFitMinDistance = minDistance;
    this.lastFitMarkerRadius = markerRadius;
    if (this.camera.aspect < 0.05 || this.camera.aspect > 40) {
      this.needsAspectRefit = true;
    }
    const radius = Math.max(boundingSphereRadius(bounds), markerRadius);
    const required = calculateTightFleetCameraDistance(
      positions,
      this.viewDirection(),
      THREE.MathUtils.degToRad(this.camera.fov),
      this.camera.aspect,
      { minDistance, markerRadius },
    );
    this.applyViewLimits(required, radius);
    const distance = Math.min(
      this.controls.maxDistance,
      Math.max(this.controls.minDistance, required),
    );
    const position = cameraPositionFromTarget(target, this.viewDirection(), distance);
    if (animate) {
      this.cameraController.begin(position, target);
    } else {
      this.cameraController.snap(this.camera, this.controls, position, target);
    }
    this.controls.update();
  }

  private syncTerrain(bounds: FleetBounds | null): void {
    if (!this.ground) {
      return;
    }
    const size = bounds
      ? Math.max(bounds.horizontalSpan * TERRAIN_PADDING, MIN_TERRAIN_SIZE)
      : MIN_TERRAIN_SIZE;
    this.ground.scale.set(size, size, 1);
    if (bounds) {
      this.ground.position.set(bounds.center.x, -0.4, bounds.center.z);
    }
  }

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    const deltaSeconds = this.clock?.getDelta() ?? 0;
    for (const object of this.robots.values()) {
      object.tick(deltaSeconds);
    }
    const diagnosticTarget =
      (this.selectedId ? this.robots.get(this.selectedId) : null) ?? this.robots.values().next().value;
    diagnosticTarget?.logInterpolationDiagnostics();
    if (this.camera && this.controls) {
      if (this.follow.followedRobotId) {
        this.follow.tick(
          deltaSeconds,
          this.camera,
          this.controls.target,
          this.renderedSubject(this.follow.followedRobotId),
        );
      } else {
        this.cameraController.tick(deltaSeconds, this.camera, this.controls);
      }
      this.controls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer?.render(this.scene, this.camera);
    }
  };

  private handleClick(event: MouseEvent): void {
    if (this.pointerDown && isPointerDrag(this.pointerDown, { x: event.clientX, y: event.clientY })) {
      return;
    }
    const robotId = this.pickRobotId(event);
    if (robotId) {
      this.onRobotSelected?.(robotId);
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    this.setHoveredRobotId(this.pickRobotId(event));
  }

  private handleLabelInteract(event: LabelInteract): void {
    if (event.type === 'enter') {
      this.setHoveredRobotId(event.robotId);
      return;
    }
    if (event.type === 'leave') {
      if (this.hoveredRobotId === event.robotId) {
        this.setHoveredRobotId(null);
      }
      return;
    }
    if (event.type === 'click') {
      dispatchLabelSelection(event.event, event.robotId, (id) => this.onRobotSelected?.(id));
    }
  }

  private setHoveredRobotId(robotId: string | null): void {
    if (!hoverIdChanged(this.hoveredRobotId, robotId)) {
      return;
    }
    if (this.hoveredRobotId) {
      this.robots.get(this.hoveredRobotId)?.setHovered(false);
    }
    this.hoveredRobotId = robotId;
    if (robotId) {
      this.robots.get(robotId)?.setHovered(true);
    }
    if (this.renderer) {
      this.renderer.domElement.style.cursor = robotId ? 'pointer' : '';
    }
  }

  private pickRobotId(event: { clientX: number; clientY: number }): string | null {
    if (!this.renderer || !this.camera || !this.raycaster) {
      return null;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickList, true);
    return findAncestorRobotId(hits[0]?.object);
  }

  private rebuildPickList(): void {
    this.pickList.length = 0;
    for (const object of this.robots.values()) {
      this.pickList.push(object.group);
    }
  }
}
