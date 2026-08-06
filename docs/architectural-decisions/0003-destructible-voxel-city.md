# ADR 0003: Destructible voxel city (Seattle)

## Status

accepted — 2026-07-23. (Briefly proposed as spike-gated; Chris overruled the gating: *"It's AI slop though, so performance probably isn't a big deal."* Agreed on process — the ceremony was disproportionate. The chunked architecture below is kept anyway, not as optimization but because it is roughly the same amount of code as the naive version and the naive version does not run at all. Budgets below are sanity checks, not gates.)

## Date

2026-07-23

## Context

Chris's direction (2026-07-23): *"For the city, I'm actually thinking we do full destroy possibility. so everything can be damaged/broken down, for that maybe we need the city to be a bit physics based voxels instead of too many custom models"* and *"We will need to do a seattle themed city too."*

This is a deliberate turn away from the current world model. Today the "block" is a flat plane, four curb walls, and ten trash cans — everything else was going to be hand-placed custom models (gameplan art direction, backlog asset milestone). Three forces push toward voxels instead:

1. **The game is already about escalating destruction.** Heat tier 5 rolls in tanks firing shells. If shells can't break the neighbourhood, the fantasy is hollow. Destruction is also a natural chaos source → heat, which the HeatSystem already models as a data-driven event map.
2. **Asset economics.** A hand-modelled city needs dozens of unique GLBs (houses, fences, cars, shopfronts, the Space Needle) plus damaged variants of each. A voxel city needs a handful of *materials* and a level definition. Given the asset pipeline is one person driving Meshy and Blender, this is an order-of-magnitude reduction in modelling work.
3. **The aesthetic fits.** Photo-textured voxels land squarely in the demi-real jank the gameplan already commits to (ADR-0001).

The counter-force is performance: naive voxels are a classic way to destroy a browser game's frame rate. The `threejs-perf` skill's measured numbers frame the budget — 19.6k individual cubes cost ~19,365 draw calls and 28.5 ms render CPU p95, versus 2 draw calls and 0.5 ms when batched. A voxel city that renders per-voxel meshes is dead on arrival; one that meshes per chunk is comfortable.

This also collides with a written anti-goal. `docs/gameplan.md` says *"Not open world — one block, dense and hand-placed."* A Seattle city is a scope expansion, and it must be a conscious one rather than drift.

## Decision

Adopt a **chunked voxel world with localized destruction** as the city representation, themed as Seattle, and **prove it with a spike before building content** (milestone 07).

Architecture:

- **Data.** The city is a 3D grid of 1-byte material ids (0 = air), partitioned into fixed chunks (16³ voxels). Voxel edge ~0.4 m, so a craftsman house is roughly 20×15×20 voxels. The level is authored as a compact definition (building footprints + rules) rather than per-voxel data, so it stays diffable and hand-editable in the dev tools.
- **Rendering.** One greedy-meshed `BufferGeometry` per chunk, sharing a single material backed by a texture atlas of Seattle surfaces (clapboard, shingle, brick, moss, asphalt, glass). A chunk re-meshes only when its dirty flag is set. This keeps draw calls proportional to chunks, not voxels.
- **Physics.** Intact structure gets **no cannon bodies at all**. Jimothy is already kinematic with hand-rolled clamping, so he collides against the voxel grid by direct lookup — exact, free, and far less code than greedy box decomposition. Debris is the only dynamic body source.
- **Damage.** An impact (tank shell, big bonk, later powerups) clears voxels within a radius, marks affected chunks dirty, and spawns debris. Debris is a **pooled, hard-capped** set (target ≤150 live) rendered through a single `InstancedMesh` with batched matrix writes, each backed by a pooled cannon body; the oldest recycles when the cap is hit, and settled debris despawns on a timer.
- **Budgets** (enforced by the spike): ≤300 draw calls, ≤200 dynamic bodies, chunk re-mesh ≤5 ms, no frame-time regression versus today's build.

Scope: the gameplan anti-goal changes from *"one block, dense and hand-placed"* to **"one dense, destructible Seattle district — not a streaming open world."** The world stays bounded and hand-authored; it simply becomes breakable.

## Consequences

### Positive

- Tank shells finally mean something: tier 5 can level the neighbourhood, which is the clip-worthy payoff the whole heat ladder builds toward.
- Destruction becomes a first-class chaos source feeding heat — one entry in `HeatSystem.SOURCES`, per its existing data-driven design.
- Modelling work collapses: buildings become level data plus a material atlas, freeing the Meshy/TRELLIS pipeline for characters (paparazzi, animal control, tanks) where custom models actually matter.
- Seattle theming gets cheap set pieces — a voxel Space Needle that can be toppled is content a hand-modelled pipeline would never afford.
- Rubble is a natural gameplay surface: it can block pursuers, create climbable piles, and bury feasts.

### Negative

- **This is the largest technical lift in the project.** Chunked meshing, greedy box colliders, and debris pooling are each nontrivial, and getting any of them wrong shows up as frame drops rather than a clean failure.
- Voxel geometry fights the organic silhouettes the game already has (Jimothy, trees). Expect an aesthetic seam between the character and the world.
- Bounded destruction needs design guardrails: a fully levelled district removes hide spots and can strand the heat system's pressure valve.
- The deterministic test harness gets harder — destruction state must be snapshot-able for `render_game_to_text()` without dumping thousands of voxels.
- Milestone 03 (trees & the army) is affected: tank shells now need to interact with voxels, so its shell work should land after or alongside this.

## Alternatives considered

- **Hand-modelled city with pre-broken variants:** conventional and prettier per-object, but multiplies the asset workload by every destroyable prop and caps destruction at "swap model A for model B." Rejected on asset economics and expressiveness.
- **Per-voxel meshes/bodies (naive voxels):** simplest to write, catastrophic to run — the measured 19,365-draw-call case. Rejected outright.
- **Physics-library fracture (convex decomposition at runtime):** cannon-es has no real support, and runtime fracture is expensive and hard to make comedic rather than mushy. Rejected.
- **Fake destruction (particles + hiding meshes):** cheap and safe, but the player can't reshape the block, which is the point of Chris's request. Rejected, though the debris *presentation* borrows from it.

## Related

- Supersedes the gameplan anti-goal "one block, dense and hand-placed" (gameplan updated in the same change).
- Affects milestone 03 (trees & the army) — shell/voxel interaction.
- Depends on ADR-0002 (cannon-es) for the debris bodies; the sleep-exemption note there applies to any player-adjacent body.
- Milestone 07 is the spike that must pass before this ADR moves from proposed to accepted.
