# ADR 0018: RobotWorld visualization boundary

## Context

Three.js must render fleet positions without leaking WebGL into feature facades or ordinary UI components.

## Decision

- `FleetFacade` never imports Three.js or `RobotWorld`.
- `RobotWorldHostComponent` is the only Angular bridge: maps fleet → `RobotWorldRobot` (omit `currentState === null`), syncs selection, resizes, and routes raycast clicks back via `FleetFacade.selectRobot` + `InspectionFacade.openAsset()`.
- The host depends on `RobotWorld` through `ROBOT_WORLD`. `provideRobotWorld()` constructs `ThreeRobotWorld`. The host does not import the concrete renderer.
- `ThreeRobotWorld` owns scene, camera, renderer, OrbitControls, raycaster, and a `Map<id, RobotSceneObject>`.
- Position interpolation is presentation-only and frame-rate-independent: `tick(deltaSeconds)` uses exponential smoothing. Interpolated positions never write back to Angular.
- Raycast selection walks `Object3D.parent` until it finds a string `userData.robotId`.
- `focusRobot` moves `OrbitControls.target` only. It does not animate the camera.
- The app is zoneless (`provideZonelessChangeDetection`, no `zone.js`). Signal writes from the click callback schedule change detection. `NgZone.run` / `runOutsideAngular` are unused.

## Consequences

Visualization can later accept incremental target updates without changing facade ownership. A different `RobotWorld` implementation can be provided without changing the host.

## Alternatives considered

Injecting the world into `FleetFacade` — rejected. Rebuilding the scene on every sync — rejected. Constructing `ThreeRobotWorld` inside the host — rejected so the host stays on the `RobotWorld` boundary. Per-frame lerp constants — rejected because smoothing speed would depend on FPS.
