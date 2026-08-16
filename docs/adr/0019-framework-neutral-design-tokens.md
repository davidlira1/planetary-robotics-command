# ADR 0019: Framework-neutral Deep Space tokens

## Context

The approved dashboard palette and radii must not be scattered as hex literals across Angular components, and a future React client should reuse the same tokens.

## Decision

Put CSS custom properties in `@prc/design-system` (`tokens.css`) and the matching JS map in `tokens.ts`. Angular CSS imports the token file. Three.js reads `@prc/design-system/tokens` and converts hex to numeric colors in the visualization theme adapter. Components remain Angular components — no Web Components.

## Consequences

One palette source for CSS and WebGL. Visual fidelity stays with `dashboard-reference.html`.

## Alternatives considered

Material theme — rejected (wrong visual language). Framework-independent Web Components — rejected as unnecessary for Layer 5.
