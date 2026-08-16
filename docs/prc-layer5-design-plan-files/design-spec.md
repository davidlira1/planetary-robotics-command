# PRC Dashboard Design Specification

## Status

**APPROVED VISUAL REFERENCE FOR LAYER 5**

The visual source of truth is `dashboard-reference.html`.

Cursor must **implement this design**, not reinterpret or redesign it.

The reference HTML is a prototype, not production Angular architecture. Translate it into proper Angular feature components, shared design tokens, and the Three.js visualization boundary while preserving the visual result.

## 1. Visual direction

Name: **Deep Space**

Desired character:

- futuristic aerospace command software
- precise and technical
- dark, restrained, premium
- cyan used selectively for interaction/live telemetry
- semantic amber/red/green status colors
- substantial negative space in the world viewport
- no generic SaaS dashboard styling
- no excessive glow
- no novelty sci-fi fonts
- no decorative redesign beyond the approved prototype

The dashboard should feel like software used to operate planetary robots, not a marketing landing page.

## 2. Approved palette

Use semantic design tokens. Do not scatter literal values through Angular component styles.

| Semantic role | Value |
|---|---|
| Canvas background | `#050A0F` |
| Surface | `#0B131D` |
| Elevated surface | `#0E1823` |
| Border | `#233746` |
| Primary text | `#E5EDF2` |
| Muted text | `#748896` |
| Primary cyan accent | `#37DCFF` |
| Healthy / normal | `#4BE0A3` |
| Warning | `#FFD25C` |
| Critical | `#FF5269` |

Suggested token names:

```css
--prc-bg-canvas
--prc-bg-surface
--prc-bg-surface-elevated
--prc-border
--prc-text-primary
--prc-text-muted
--prc-accent-primary
--prc-status-normal
--prc-status-warning
--prc-status-critical
```

Add semantic spacing, typography, radius, motion, shadow/glow, and border tokens as required.

## 3. Desktop layout source of truth

Overall structure:

```text
┌───────────────────────────────────────────────────────────────┐
│ PRC // MISSION SYSTEMS                ● SYSTEM ONLINE        │
│ PLANETARY ROBOTICS COMMAND                                  │
├─────────────┬────────────────────────────┬────────────────────┤
│             │                            │ ASSET TELEMETRY    │
│ FLEET       │                            │                    │
│ ASSETS      │       THREE.JS WORLD       │ selected robot     │
│             │                            │ live metrics       │
│             │                            ├────────────────────┤
│             │                            │ ACTIVE ALERTS      │
├─────────────┼────────────────────────────┤                    │
│             │  four fleet summary tiles │                    │
└─────────────┴────────────────────────────┴────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ OPERATIONS FEED                                              │
└───────────────────────────────────────────────────────────────┘
```

Reference proportions:

- outer horizontal page padding: roughly 42px desktop
- left Fleet Assets rail: roughly 235px
- center world: flexible and visually dominant
- right rail: roughly 300px
- gaps: roughly 14px
- world height: roughly 570px in the reference
- metric strip: four equal tiles below the world
- Operations Feed: full width beneath the primary dashboard
- panel radius: about 6–8px
- borders: thin 1px technical separators

Do not change this into a card grid, left navigation application, world-first redesign, or generic SaaS layout.

## 4. Header

Contains:

- PRC geometric logo mark
- small `PRC // MISSION SYSTEMS` eyebrow
- `PLANETARY ROBOTICS COMMAND` title
- system-online state aligned right

Rules:

- compact height
- thin bottom divider
- cyan reserved for technical emphasis
- healthy semantic color for nominal system state
- no invented navigation items

## 5. Fleet Assets panel

Purpose: fleet list and robot selection.

Each row contains:

- compact identity/type badge
- robot id
- model/type subtitle
- health/status indicator

Interaction:

- hover: restrained cyan tint
- selected: cyan border/tint
- click: `FleetFacade.selectRobot(robotId)`

Data comes from `FleetFacade.robots`, initially loaded from `GET /api/v1/fleet`.

Visual semantics:

- robot type → shape/badge/text
- health → semantic status color
- selection → cyan treatment

Do not assign arbitrary colors per robot type.

## 6. Three.js world

The center world is the visual focus.

Layer 5 replaces the prototype's fake CSS world with actual Three.js while preserving the same composition and visual hierarchy.

Required:

- PerspectiveCamera
- WebGLRenderer
- OrbitControls
- restrained dark world/terrain
- primitive robot scene objects
- robot positions from `/fleet`
- heading from backend state
- health visual
- selection visual
- presentation interpolation
- raycast robot selection
- resize handling

Do **not** introduce a generic full-screen sci-fi grid. A subtle/local spatial reference may be used only if it improves depth and must remain visually subordinate.

The frontend does not simulate authoritative movement. Backend coordinates are truth; Three.js interpolates presentation only.

## 7. Fleet summary metrics

Four equal tiles below the world:

1. Fleet Online
2. Average Battery
3. Active Alerts
4. Telemetry/last-updated indicator

These may be derived from already-loaded frontend state where semantically honest.

Examples:

- online count from operational status
- average battery from robots with current state
- active alert count from loaded open alerts

Do not hardcode fake live telemetry frequency. If frequency is not truly known, use a truthful value such as last fleet update.

## 8. Asset Telemetry panel

Uses `FleetFacade.selectedRobot`.

Do not issue another HTTP request merely for fields already included in `/fleet`.

Display as space permits:

- robot id
- model/type
- operational status
- battery
- signal
- temperature
- velocity
- heading
- position
- health

Required states:

- no selection
- selected robot with no current state
- selected robot with no health state
- populated state

Never recalculate backend health thresholds in Angular.

## 9. Active Alerts panel

Source: `AlertsFacade`.

Layer 5 behavior:

- load open alerts once during dashboard initialization
- independent loading/error/empty states
- click alert → select its robot through `FleetFacade.selectRobot(alert.robotId)`

Display:

- robot id
- alert type
- severity
- message
- timestamp if space allows

Severity colors come from semantic tokens.

## 10. Operations Feed

The visual region stays because it is part of the approved layout.

Layer 5 must not fabricate a realtime stream if no backend contract exists.

Acceptable:

- truthful empty/future state
- limited content derived from already available real data if semantics are accurate

Do not add a backend endpoint just to fill this panel in Layer 5.

## 11. Inspection drawer

The reference includes a right-side overlay drawer.

Interaction intent:

- robot inspection can open the drawer
- world remains visible beneath backdrop
- drawer enters from right
- ESC closes
- backdrop click closes

Layer 5 may populate only data already available from current contracts. Do not invent contracts merely for the drawer.

## 12. Typography

- small uppercase technical eyebrow labels
- letter spacing for section labels
- monospace/technical numbers where appropriate
- larger telemetry values
- professional sans-serif for major titles/body where useful

Do not make all copy monospace.

## 13. Panels

- dark surfaces
- 1px borders
- 6–8px radius
- restrained depth
- minimal shadow
- no thick neon outline around every container

Avoid giant SaaS radii, fluffy spacing, pastel gradients, and excessive pill controls.

## 14. Motion

Suggested semantic timing:

```text
fast       120–160ms
standard   180–240ms
deliberate 280–360ms
```

Use sparingly for hover, selection, drawer, and meaningful transitions.

Respect `prefers-reduced-motion`.

## 15. Responsive behavior

Desktop-first command-center application.

Minimum expectation:

- excellent desktop layout
- usable laptop layout
- narrow widths deliberately collapse secondary content rather than crushing columns
- no overlapping text

Full mobile product design is out of scope.

## 16. Visual non-negotiables

Cursor must NOT:

- redesign the layout
- choose another palette
- add random purple/pink gradients
- add excessive glow
- introduce a generic global background grid beyond what is explicitly in the approved reference
- add navigation that does not exist
- use arbitrary type colors where health color already has meaning
- replace the command-center visual language with Material/SaaS cards
- fabricate fake live operational data

When ambiguous, prefer fidelity to `dashboard-reference.html`.

## 17. Angular translation

Do not copy the prototype into a single Angular component.

Translate visual regions into boundaries such as:

```text
CommandDashboardShell
├── CommandHeader
├── FleetAssets
├── RobotWorldHost
├── FleetSummaryMetrics
├── AssetTelemetry
├── ActiveAlerts
├── OperationsFeed
└── InspectionDrawer
```

`dashboard-reference.html` defines **what it should look and feel like**.

`frontend-architecture.md` defines **how the production Angular implementation is organized**.
