# ADR 0018: RobotWorld visualization boundary

## Context

Three.js must render fleet positions without leaking WebGL into feature facades or ordinary UI components. Backend coordinates can span far beyond a hardcoded camera/ground scale.

## Decision

- `FleetFacade` never imports Three.js or `RobotWorld`.
- `RobotWorldHostComponent` is the only Angular bridge: maps fleet → `RobotWorldRobot` (omit `currentState === null`), syncs selection, resizes, and routes raycast clicks back via `FleetFacade.selectRobot` + `InspectionFacade.openAsset()`.
- The host depends on `RobotWorld` through `ROBOT_WORLD`. `provideRobotWorld()` constructs `ThreeRobotWorld`. The host does not import the concrete renderer.
- `ThreeRobotWorld` owns scene, camera, renderer, OrbitControls, raycaster, terrain, and a `Map<id, RobotSceneObject>`.
- Position interpolation is presentation-only and frame-rate-independent: `tick(deltaSeconds)` uses exponential smoothing. Interpolated positions never write back to Angular.
- Camera framing stays inside Three.js. The first positioned `syncFleet` auto-fits once, and only after initialize + a positioned snapshot. Fit uses a bounding sphere from robot positions (not terrain). Fog starts beyond the far side of that sphere so robots are not washed out. `fitFleet()` and `focusRobot(id)` animate camera + orbit target while preserving the current viewing direction. Selection does not auto-focus the camera.
- Terrain is a dark plane sized from current fleet bounds (plus a minimum). The decorative ring is not rendered; it had no backend meaning.
- Raycast selection walks `Object3D.parent` until it finds a string `userData.robotId`.
- The app is zoneless (`provideZonelessChangeDetection`, no `zone.js`). Signal writes from the click callback schedule change detection. `NgZone.run` / `runOutsideAngular` are unused.

## Consequences

Visualization can later accept incremental target updates without changing facade ownership. A different `RobotWorld` implementation can be provided without changing the host. Camera distance limits and fog follow fitted fleet span.

## Alternatives considered

Injecting the world into `FleetFacade` — rejected. Rebuilding the scene on every sync — rejected. Constructing `ThreeRobotWorld` inside the host — rejected so the host stays on the `RobotWorld` boundary. Per-frame lerp constants — rejected because smoothing speed would depend on FPS. Auto-fitting on every fleet update — rejected so future realtime motion does not yank the camera.
