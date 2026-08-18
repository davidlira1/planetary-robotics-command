import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { dollyInspectionPose } from './camera-dolly';
import {
  cameraPositionFromTarget,
  calculateTightFleetCameraDistance,
  DEFAULT_VIEW_OFFSET,
  MARKER_RADIUS,
  MIN_FLEET_OVERVIEW_DISTANCE,
  MIN_INSPECTION_DISTANCE,
  normalizeDirection,
} from './camera-fit';
import { findAncestorRobotId } from './find-ancestor-robot-id';
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
  private readonly robots = new Map<string, RobotSceneObject>();
  private readonly fitGate = new InitialFitGate();
  private readonly cameraController = new RobotWorldCameraController();
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

    const hemi = new THREE.HemisphereLight(robotWorldTheme.lightAmbient, robotWorldTheme.graphiteDark, 0.42);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(robotWorldTheme.lightKey, 0.9);
    key.position.set(40, 80, 20);
    scene.add(key);
    const rim = new THREE.DirectionalLight(robotWorldTheme.accent, 0.22);
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
    const object = this.robots.get(robotId);
    if (!object) {
      return;
    }

    const startCameraPosition = this.camera.position.clone();
    const startControlsTarget = this.controls.target.clone();
    const endTarget = {
      x: object.renderedPosition.x,
      y: object.renderedPosition.y,
      z: object.renderedPosition.z,
    };
    const pose = dollyInspectionPose(startCameraPosition, endTarget, MIN_INSPECTION_DISTANCE);
    const startToTarget = startCameraPosition.distanceTo(startControlsTarget);
    const startToRobot = startCameraPosition.distanceTo(
      new THREE.Vector3(endTarget.x, endTarget.y, endTarget.z),
    );
    this.controls.maxDistance = Math.max(this.controls.maxDistance, startToTarget, startToRobot);
    this.cameraController.begin(pose.position, pose.target);
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
    if (this.camera && this.controls) {
      this.cameraController.tick(deltaSeconds, this.camera, this.controls);
      this.controls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer?.render(this.scene, this.camera);
    }
  };

  private handleClick(event: MouseEvent): void {
    if (!this.renderer || !this.camera || !this.raycaster) {
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [...this.robots.values()].map((object) => object.group);
    const hits = this.raycaster.intersectObjects(meshes, true);
    const robotId = findAncestorRobotId(hits[0]?.object);
    if (robotId) {
      this.onRobotSelected?.(robotId);
    }
  }
}
