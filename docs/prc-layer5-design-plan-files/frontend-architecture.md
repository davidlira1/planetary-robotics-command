# PRC Layer 5 Frontend Architecture

## 1. Core dependency direction

```text
Angular UI
    ↓
Feature Facades
    ↓
Signals / RxJS workflows
    ↓
Data-source interfaces
    ↓
HTTP adapters
    ↓
Generated OpenAPI Angular client
    ↓
PRC REST API
```

Visualization:

```text
FleetFacade state
    ↓
RobotWorldHostComponent
    ↓
RobotWorld abstraction
    ↓
ThreeRobotWorld
    ↓
Three.js / WebGL
```

`FleetFacade` must not inject or know about `RobotWorld` or Three.js.

## 2. Initial data flow — no polling in Layer 5

At dashboard startup:

```text
GET /api/v1/fleet
        ↓
FleetDataSource
        ↓
FleetFacade
        ↓
robots Signal

GET /api/v1/alerts?status=OPEN&limit=50
        ↓
AlertsDataSource
        ↓
AlertsFacade
        ↓
alerts Signal
```

The two loads are independent.

**No periodic polling in Layer 5.**

The intended future flow is:

```text
GET /fleet once → initial state
future realtime push → incremental updates → FleetFacade → Three.js targets
```

Do not implement realtime yet.

## 3. OpenAPI-generated Angular client

Source of truth:

`specs/openapi/openapi.v1.yaml`

Requirements:

- use OpenAPI Generator `typescript-angular`
- pin generator version
- choose newest stable Angular version mutually compatible with that generator
- generated output isolated in `libs/api-client-angular/generated/`
- generated files are DO NOT HAND EDIT
- root generation command such as `pnpm api:generate:angular`
- freshness/drift check such as `pnpm api:check:angular`
- document chosen Angular and generator versions

Feature components/facades do not import generated API service classes directly.

Only HTTP adapter/data-access implementations consume generated services.

## 4. Data-source interfaces

Frontend-local external-data boundaries, not backend `@prc/ports`.

Conceptually:

```ts
interface FleetDataSource {
  getFleet(): Observable<FleetSnapshot>;
}

interface AlertsDataSource {
  getAlerts(query: AlertsQuery): Observable<AlertsResult>;
}
```

Concrete implementations:

```text
FleetHttpDataSource → generated Fleet service
AlertsHttpDataSource → generated Alerts service
```

Use Angular InjectionTokens where appropriate.

Do not create a generic Repository or generic API service.

## 5. FleetFacade

Component-facing API for fleet state.

Own:

- robots
- selectedRobotId
- loading
- error

Derived:

- selectedRobot

Intents:

- loadFleet()
- selectRobot(robotId)
- clearSelection()

Signals hold current state.

`selectedRobot` must be computed from robots + selectedRobotId, never stored independently.

Selection invariant:

> selectedRobotId is null or references a robot currently present in the loaded fleet.

Unknown ids should be ignored/handled explicitly in Layer 5.

Do not add `IFleetStore` / `SignalFleetStore`. The Facade itself hides the state implementation.

## 6. AlertsFacade

Separate state owner.

Own:

- alerts
- loading
- error
- minimal query state if needed

Intent:

- loadAlerts()

Initial query: `status=OPEN`, `limit=50`.

Alerts failure must not block fleet/world rendering.

Alert clicks select through FleetFacade.

## 7. Signals vs RxJS

Use Signals primarily for:

- current fleet
- selection
- derived selected robot
- alerts
- loading/error
- synchronous feature/application state

Use RxJS primarily for:

- generated HTTP requests
- async workflows
- future cancellation/selection-dependent requests
- future realtime streams

Do not force everything into one reactive model.

## 8. Suggested component hierarchy

```text
CommandDashboardShell
├── CommandHeaderComponent
├── FleetAssetsComponent
├── RobotWorldHostComponent
├── FleetSummaryMetricsComponent
├── AssetTelemetryComponent
├── ActiveAlertsComponent
├── OperationsFeedComponent
└── InspectionDrawerComponent
```

Shell owns composition/layout, not business logic or infrastructure.

No normal component directly calls HttpClient.

No feature component imports generated OpenAPI service classes.

No normal feature component manipulates raw `THREE.*`.

## 9. Shared selection flow

```text
Fleet row click ───┐
                   │
3D robot click ────┼──► FleetFacade.selectRobot(id)
                   │
Alert click ───────┘
```

All interested UI reacts to selected state.

No component-to-component orchestration.

## 10. RobotWorld boundary

Conceptual interface:

```ts
interface RobotWorld {
  initialize(
    host: HTMLElement,
    hooks: { onRobotSelected(id: string): void }
  ): void;

  syncFleet(robots: readonly RobotWorldRobot[]): void;
  setSelectedRobot(robotId: string | null): void;
  focusRobot(robotId: string): void;
  resize(width: number, height: number): void;
  destroy(): void;
}
```

Small visualization model:

```text
id
type
position | null
headingDegrees
healthStatus
```

Robots without current state are omitted from the scene in Layer 5.

## 11. RobotWorldHostComponent

Bridge between Angular and visualization.

Responsibilities:

- initialize world after view creation
- observe FleetFacade robots
- map fleet DTO/application model → RobotWorldRobot
- call syncFleet
- observe selectedRobotId → setSelectedRobot
- ResizeObserver → resize
- Three.js click callback → FleetFacade.selectRobot(id)
- destroy world on teardown

Continuous rendering should run outside Angular's normal UI update path where appropriate.

Only meaningful application interactions cross back into Angular state.

## 12. ThreeRobotWorld owns rendering state

Three.js owns:

- Scene
- PerspectiveCamera
- WebGLRenderer
- OrbitControls
- Raycaster
- robot registry
- mesh/group objects
- hover state
- target/rendered positions
- animation loop
- GPU resource lifecycle

Angular does not store frame-by-frame camera or mesh state in Signals.

## 13. RobotSceneObject

```text
RobotSceneObject
└── THREE.Group
    ├── type geometry / primitive model
    ├── selection ring
    ├── health indicator
    └── future label / heading element
```

Maintain `Map<string, RobotSceneObject>`.

`syncFleet` should create/update/remove incrementally and must not rebuild the entire scene on every state sync.

Visual grammar:

- robot type → shape/geometry
- health → semantic status color
- selection → cyan selection treatment

## 14. Position interpolation

Backend position is authoritative.

When a new backend coordinate arrives later, Three.js updates a target position and renders smooth movement toward it.

Interpolated positions never flow back into Angular state.

Layer 5 has no automatic updates after initial load; the interpolation architecture is nevertheless established for the future realtime layer.

## 15. Design system

Framework-neutral design assets live in `libs/design-system/`.

Share:

- CSS custom-property tokens
- icons/assets where appropriate
- design documentation

Angular components remain Angular components. Do not introduce framework-independent Web Components merely for theoretical React reuse.

Future React can consume the same design tokens and design specification.

## 16. Local development

Nest API currently has no CORS configuration.

Use Angular development proxy:

```text
localhost:4200/api/*    → localhost:3000/api/*
localhost:4200/health/* → localhost:3000/health/*
```

Do not modify backend CORS just for Layer 5 local development.

## 17. Testing

### FleetFacade

- load success
- load error
- select
- selectedRobot derived correctly
- unknown id selection invariant
- clear selection

### AlertsFacade

- load success
- load failure independent from fleet
- initial open-alert query

### UI

- fleet list render
- selected row treatment
- click selects robot
- telemetry null/no-selection states
- alerts render/click selection

### Data adapters

- generated API response is consumed/mapped correctly where mapping exists

### Visualization

Prefer pure/helper tests:

- fleet → RobotWorldRobot mapping
- robot registry create/update/remove
- target state updates

Avoid brittle screenshot/pixel unit tests in Layer 5.

## 18. Acceptance criteria

Layer 5 is complete when:

1. Angular dashboard visually matches `dashboard-reference.html`.
2. Dashboard runs against the real local API.
3. Angular API client is generated from OpenAPI.
4. Generator version is pinned.
5. Components do not directly use HttpClient.
6. Feature components do not import generated service classes.
7. Fleet loads once through FleetFacade.
8. Alerts load once independently through AlertsFacade.
9. No polling or realtime push exists yet.
10. Shared selection works across fleet, telemetry, alerts, and Three.js.
11. Three.js is behind RobotWorld.
12. Robot positions render from backend fleet coordinates.
13. Orbit/zoom/resize work.
14. 3D robot clicks select application robots.
15. Deep Space tokens drive styling.
16. Loading/error/empty states exist.
17. Angular production build succeeds.
18. Frontend tests pass.
19. Existing backend tests remain green.
20. Architecture docs are updated.

STOP after Layer 5.
