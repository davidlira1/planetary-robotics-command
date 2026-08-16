import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { findAncestorRobotId } from './find-ancestor-robot-id';
import { RobotSceneObject } from './robot-scene-object';
import { syncRegistry } from './robot-registry';
import { robotWorldTheme } from './robot-world-theme';
import type { RobotWorld, RobotWorldRobot } from './robot-world';

export class ThreeRobotWorld implements RobotWorld {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private raycaster: THREE.Raycaster | null = null;
  private clock: THREE.Clock | null = null;
  private readonly pointer = new THREE.Vector2();
  private readonly robots = new Map<string, RobotSceneObject>();
  private selectedId: string | null = null;
  private frame = 0;
  private onRobotSelected: ((id: string) => void) | null = null;
  private readonly onClick = (event: MouseEvent) => this.handleClick(event);

  initialize(host: HTMLElement, hooks: { onRobotSelected(id: string): void }): void {
    this.destroy();
    this.onRobotSelected = hooks.onRobotSelected;
    this.clock = new THREE.Clock();

    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(robotWorldTheme.background);
    scene.fog = new THREE.Fog(robotWorldTheme.background, 180, 620);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2000);
    camera.position.set(80, 70, 110);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 40;
    controls.maxDistance = 320;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(robotWorldTheme.lightAmbient, 0.55));
    const key = new THREE.DirectionalLight(robotWorldTheme.lightKey, 0.85);
    key.position.set(40, 80, 20);
    scene.add(key);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(220, 48),
      new THREE.MeshStandardMaterial({
        color: robotWorldTheme.surface,
        roughness: 0.95,
        metalness: 0.05,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    scene.add(ground);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(78, 79.2, 64),
      new THREE.MeshBasicMaterial({
        color: robotWorldTheme.ring,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    scene.add(ring);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;
    this.raycaster = new THREE.Raycaster();
    renderer.domElement.addEventListener('click', this.onClick);
    this.loop();
  }

  syncFleet(robots: readonly RobotWorldRobot[]): void {
    if (!this.scene) {
      return;
    }
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
  }

  setSelectedRobot(robotId: string | null): void {
    this.selectedId = robotId;
    for (const [id, object] of this.robots) {
      object.setSelected(id === robotId);
    }
  }

  /**
   * Moves OrbitControls.target to the robot. Does not animate or reposition the camera.
   */
  focusRobot(robotId: string): void {
    const object = this.robots.get(robotId);
    if (!object || !this.controls) {
      return;
    }
    this.controls.target.copy(object.renderedPosition);
  }

  resize(width: number, height: number): void {
    if (!this.camera || !this.renderer) {
      return;
    }
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
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
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.raycaster = null;
    this.clock = null;
    this.onRobotSelected = null;
  }

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    const deltaSeconds = this.clock?.getDelta() ?? 0;
    for (const object of this.robots.values()) {
      object.tick(deltaSeconds);
    }
    this.controls?.update();
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
