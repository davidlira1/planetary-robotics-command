import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  cameraPositionFromTarget,
  DEFAULT_VIEW_OFFSET,
  fleetFitDistance,
  inspectionBounds,
  MIN_FIT_SPAN,
  normalizeDirection,
} from './camera-fit';
import { findAncestorRobotId } from './find-ancestor-robot-id';
import { boundingSphereRadius, calculateFleetBounds, type FleetBounds, type Vec3 } from './fleet-bounds';
import { InitialFitGate } from './initial-fit-gate';
import { applyRendererSize } from './renderer-size';
import { RobotSceneObject } from './robot-scene-object';
import { syncRegistry } from './robot-registry';
import { RobotWorldCameraController } from './robot-world-camera-controller';
import { robotWorldTheme } from './robot-world-theme';
import type { RobotWorld, RobotWorldRobot } from './robot-world';

const MIN_DISTANCE = 40;
const MIN_TERRAIN_SIZE = 240;
const TERRAIN_PADDING = 2.4;
const DEFAULT_MAX_DISTANCE = 320;

export class ThreeRobotWorld implements RobotWorld {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private raycaster: THREE.Raycaster | null = null;
  private clock: THREE.Clock | null = null;
  private ground: THREE.Mesh | null = null;
  private readonly pointer = new THREE.Vector2();
  private readonly robots = new Map<string, RobotSceneObject>();
  private readonly fitGate = new InitialFitGate();
  private readonly cameraController = new RobotWorldCameraController();
  private selectedId: string | null = null;
  private pendingRobots: readonly RobotWorldRobot[] | null = null;
  private lastPositionedRobots: readonly RobotWorldRobot[] = [];
  private lastFitBounds: FleetBounds | null = null;
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
    scene.fog = new THREE.Fog(robotWorldTheme.background, 180, 620);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2000);
    camera.position.set(DEFAULT_VIEW_OFFSET.x, DEFAULT_VIEW_OFFSET.y, DEFAULT_VIEW_OFFSET.z);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    applyRendererSize(renderer, width, height, window.devicePixelRatio);
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = DEFAULT_MAX_DISTANCE;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(robotWorldTheme.lightAmbient, 0.55));
    const key = new THREE.DirectionalLight(robotWorldTheme.lightKey, 0.85);
    key.position.set(40, 80, 20);
    scene.add(key);

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

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;
    this.ground = ground;
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
      this.applyFraming(bounds, false);
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
    const bounds = calculateFleetBounds(this.lastPositionedRobots);
    if (!bounds) {
      return;
    }
    this.applyFraming(bounds, true);
  }

  focusRobot(robotId: string): void {
    const object = this.robots.get(robotId);
    if (!object) {
      return;
    }
    const target = {
      x: object.targetPosition.x,
      y: object.targetPosition.y,
      z: object.targetPosition.z,
    };
    this.applyFraming(inspectionBounds(target), true, target);
  }

  resize(width: number, height: number): void {
    if (!this.camera || !this.renderer) {
      return;
    }
    const usable = width >= 8 && height >= 8;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    applyRendererSize(this.renderer, width, height, window.devicePixelRatio);
    if (usable && this.needsAspectRefit && this.lastFitBounds) {
      this.needsAspectRefit = false;
      this.applyFraming(this.lastFitBounds, false);
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
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.raycaster = null;
    this.clock = null;
    this.ground = null;
    this.onRobotSelected = null;
    this.pendingRobots = null;
    this.lastPositionedRobots = [];
    this.lastFitBounds = null;
    this.needsAspectRefit = false;
    this.fitGate.reset();
    this.cameraController.active = false;
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

  private applyFraming(bounds: FleetBounds, animate: boolean, target = bounds.center): void {
    if (!this.camera || !this.controls) {
      return;
    }
    this.lastFitBounds = bounds;
    if (this.camera.aspect < 0.05 || this.camera.aspect > 40) {
      this.needsAspectRefit = true;
    }
    const radius = Math.max(boundingSphereRadius(bounds), MIN_FIT_SPAN / 2);
    const required = fleetFitDistance(
      bounds,
      THREE.MathUtils.degToRad(this.camera.fov),
      this.camera.aspect,
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
