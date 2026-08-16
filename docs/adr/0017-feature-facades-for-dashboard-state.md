# ADR 0017: Feature facades for dashboard state

## Context

The command dashboard needs shared fleet selection and independent alert loading without a global store or NgRx. Drawer open/mode is used by sibling features (Three.js host and alerts). One-shot HTTP must remain cancelable if the dashboard shell is destroyed while a request is in flight.

## Decision

- `FleetFacade` owns robots, selection, loading/error, and `loadedAt`. `selectedRobot` is computed. Unknown ids are ignored.
- `AlertsFacade` owns open alerts (`status=OPEN`, `limit=50`). Failure does not block fleet/world.
- `InspectionFacade` is presentation-only UI orchestration: `mode`, `selectedAlertId`, `openAsset()`, `openAlert(id)`, `close()`. It does not store selected robot identity; `FleetFacade` owns that.
- Public facade state is `asReadonly()`. Consumers read `facade.robots()`; they cannot `facade.robots.set(...)`. Writes stay on private `WritableSignal`s and public intents.
- `loadFleet()` / `loadAlerts()` return `Observable<void>`. All state writes stay inside the facade (`tap` / `catchError` / `finalize`). The shell subscribes with `takeUntilDestroyed(DestroyRef)` so teardown unsubscribes and cancels `HttpClient`.
- Facades are provided on `CommandDashboardShellComponent`, not `providedIn: 'root'`. They are dashboard-session state. HTTP adapters and the generated client stay in `app.config.ts`.
- No `IFleetStore`, no god store, no sibling component references.

## Consequences

List, 3D, telemetry, alerts, and the drawer share one shell-scoped instance. Destroying the shell cancels in-flight loads and drops session state. Layer 5 has no polling.

## Alternatives considered

NgRx — rejected as ceremony for two one-shot reads. Drawer-local state only — rejected because 3D and alerts both open the drawer. `providedIn: 'root'` — rejected so facade lifetime matches the dashboard session rather than outliving a destroyed shell. `firstValueFrom` in the facade — rejected because a Promise cannot be canceled by Angular teardown.
