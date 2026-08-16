# Cursor Instructions — PRC Layer 5

You are implementing Layer 5 of Planetary Robotics Command.

Before planning or coding, read these files in full:

1. `docs/design/dashboard-reference.html`
2. `docs/design/design-spec.md`
3. `docs/design/frontend-architecture.md`
4. existing `docs/architecture.md`
5. `specs/openapi/openapi.v1.yaml`

## Priority order

When requirements compete:

1. existing backend/API correctness
2. `frontend-architecture.md`
3. visual fidelity to `dashboard-reference.html`
4. `design-spec.md`
5. implementation convenience

## Visual instruction — non-negotiable

`dashboard-reference.html` is the approved visual source of truth.

Do **not** redesign it.

Translate it into production Angular components while preserving:

- three-column command-center layout
- header composition
- Fleet Assets rail
- dominant center world
- four metric tiles beneath world
- Asset Telemetry panel
- Active Alerts panel
- Operations Feed region
- Deep Space palette
- spacing/borders/radii
- restrained technical/aerospace character

Do not substitute generic Material/SaaS styling.

Do not add random colors, gradients, navigation, grids, or panels.

If the prototype contains static data that current backend contracts cannot truthfully provide, preserve the visual region but show a truthful empty/future/loading state rather than fabricating realtime data.

## Data instruction

Layer 5 loads `/fleet` once and `/alerts` once during dashboard initialization.

There is **NO POLLING** in Layer 5.

There are **NO WEBSOCKETS / realtime push** in Layer 5.

Realtime is intentionally deferred to a future layer.

## Architecture instruction

Preserve `frontend-architecture.md`.

Especially:

- FleetFacade never knows about Three.js/RobotWorld
- RobotWorldHostComponent bridges FleetFacade → RobotWorld
- no component directly uses HttpClient
- no feature component imports generated OpenAPI services
- generated client is infrastructure
- no raw THREE.* outside the visualization implementation
- design tokens live in framework-neutral design-system package
- shared selection flows through `FleetFacade.selectRobot()`
- no god store
- no `IFleetStore`
- no NgRx in Layer 5

## Generated API client

Use a pinned OpenAPI Generator version and the repository's OpenAPI YAML.

Before scaffolding Angular, verify the newest mutually compatible stable Angular + `typescript-angular` generator combination and document the selected versions.

Generated code must be reproducible and must not be hand edited.

## Process

**Do not begin implementation immediately.**

First produce a detailed implementation plan based on the actual repository.

The plan must explicitly include:

- selected Angular version and why
- selected OpenAPI Generator version and why
- package/folder layout
- generated-client location
- design-token package
- data-source interfaces and HTTP adapters
- Facade state ownership
- component hierarchy
- exact mapping from reference HTML regions to Angular components
- RobotWorld / ThreeRobotWorld ownership
- local dev proxy
- tests
- scripts
- acceptance checklist

STOP after producing the plan so it can be reviewed before code execution.
