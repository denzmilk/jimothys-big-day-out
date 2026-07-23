# ADR 0002: Physics via cannon-es

## Status

accepted

## Date

2026-07-23

## Context

The core loop is physics comedy: tipping trash cans that tumble and spill, tank shells that ragdoll-launch Jimothy across the map (possibly out of trees), and exaggerated knockback as the heat system escalates. The gameplan explicitly references Goat Simulator feel. Hand-rolled arcade impulses handle "move and bump" fine, but tumbling rigid bodies, stacking spilled garbage, and believable-but-absurd launches are exactly where hand-rolls turn into a worse physics engine written one bug at a time.

## Decision

Use **cannon-es** (`^0.20.0`, already installed) as the physics engine. Jimothy is a **kinematic body under player control** (direct, arcade-tuned movement — not simulated) that switches to a **dynamic body while launched** (shell hits, big bonks), then recovers control on landing. Trash cans, garbage, and props are dynamic rigid bodies. A `PhysicsSystem` in `src/systems/` owns the cannon world and syncs body transforms to Three.js meshes each frame; gameplay reads/writes it only via EventBus + GameState.

## Consequences

### Positive

- Tumbling, stacking, and launches come free and look funny by default — the game's whole comedic register.
- Pure JS, no WASM/async init; trivially compatible with Vite, tests, and the deterministic `advanceTime()` hook (fixed-step `world.step`).
- Kinematic-while-controlled keeps movement feel hand-tunable (arcade-floaty per the gameplan) instead of fighting a simulator.

### Negative

- cannon-es development is slow (maintained fork of cannon.js); advanced features (compound convex precision, CCD) are limited — acceptable at ~dozens of bodies on one block.
- Fast tank shells may tunnel through thin colliders; mitigate with raycast-assisted shell hits rather than relying on narrowphase alone.
- Two movement regimes (kinematic ↔ dynamic) need careful handoff to avoid jitter on recovery.

## Alternatives considered

- **Rapier (`@dimforge/rapier3d-compat`):** faster and more robust, but WASM + async init adds build/test friction, and its precision is wasted on ~30 comedy bodies. Revisit only if cannon-es hits a wall.
- **Hand-rolled arcade impulses:** fine for movement, hopeless for tumbling cans and ragdoll launches — would grow into an unmaintained physics engine.
- **Full dynamic-body player at all times:** more "simulated" but makes waddle feel mushy and hard to tune; kinematic-with-launch-exceptions preserves control feel.

## Related

- ADR-0001 (engine and stack)
- `docs/gameplan.md` — heat tiers, tank shells, can tipping
