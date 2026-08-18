# ADR 0018: RobotWorld visualization boundary

## Context

Three.js must render fleet positions without leaking WebGL into feature facades or ordinary UI components. Backend coordinates can span far beyond a hardcoded camera/ground scale.

## Decision

- `FleetFacade` never imports Three.js or `RobotWorld`.
- `RobotWorldHostComponent` is the only Angular bridge: maps fleet → `RobotWorldRobot` (omit `currentState === null`), syncs selection, resizes, and routes model/label clicks through `handleWorldRobotClick` (`FleetFacade.selectRobot` + `RobotWorld.focusRobot` on a new selection; `InspectionFacade.toggleAsset()` on a repeat click of the same robot). Fleet-list selection selects only and does not auto-focus the camera (FOCUS SELECTED remains a manual action). Mapping may pass presentation inputs such as `velocityMetersPerSecond`; interpolated or predicted coordinates never write back.
- The host depends on `RobotWorld` through `ROBOT_WORLD`. `provideRobotWorld()` constructs `ThreeRobotWorld`. The host does not import the concrete renderer.
- `ThreeRobotWorld` owns scene, camera, renderer, CSS2D overlay, OrbitControls, raycaster, terrain, the BASE origin marker, and a `Map<id, RobotSceneObject>`. Robot hulls use themed steel PBR; health is beacon-only; selection is cyan accent.
- Motion is presentation-only and frame-rate-independent: each robot keeps a bounded buffer of authoritative samples (`recordedAt`, position, heading). The renderer uses `renderTime = Date.now() - INTERPOLATION_DELAY_MS` (1800 ms: one telemetry interval plus jitter), interpolates between the surrounding samples, and HOLDs the newest sample when there is no future sample. Interpolated positions never write back to Angular.
- Camera framing stays inside Three.js. The first positioned `syncFleet` auto-fits once, and only after initialize + a positioned snapshot. Overview and FIT FLEET use a perspective-frustum fit along the current viewing direction (bounding-sphere fit is fallback when the camera basis is degenerate). Fog still starts beyond the far side of the fleet bounding sphere so robots are not washed out. `fitFleet()` animates camera + orbit target while preserving the current viewing direction. `focusRobot(id)` eases camera position and the orbit target from the current pose toward the rendered robot along the current camera-to-robot ray; there is no target or position snap. A world click on a new robot selects and focuses it without opening the inspector; a second click on the same robot toggles the asset drawer. Fleet-list selection does not focus.
- Terrain is a dark plane sized from current fleet bounds (plus a minimum). Sparse local marks and a BASE pylon sit at the documented simulator origin `(0,0,0)`; there is no full-screen grid.
- Robot labels are CSS2D elements created by the renderer (not Angular components inside scene objects).
- Raycast selection walks `Object3D.parent` until it finds a string `userData.robotId`.
- The app is zoneless (`provideZonelessChangeDetection`, no `zone.js`). Signal writes from the click callback schedule change detection. `NgZone.run` / `runOutsideAngular` are unused.

## Consequences

Visualization can later accept incremental target updates without changing facade ownership. A different `RobotWorld` implementation can be provided without changing the host. Camera distance limits and fog follow fitted fleet span.

## Alternatives considered

Injecting the world into `FleetFacade` — rejected. Rebuilding the scene on every sync — rejected. Constructing `ThreeRobotWorld` inside the host — rejected so the host stays on the `RobotWorld` boundary. Per-frame lerp constants — rejected because smoothing speed would depend on FPS. Auto-fitting on every fleet update — rejected so realtime motion does not yank the camera. Bounding-sphere overview fit — superseded for production framing because a flat fleet left too much empty margin; kept as degenerate-basis fallback.
