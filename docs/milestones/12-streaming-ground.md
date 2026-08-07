# Milestone 12: Streaming ground — a city too big to hold in memory

## Status

not started

## Objective

Close **JIM-01**. The world is built eagerly at boot: `buildGround` writes a voxel at every column across the whole map before the first frame. At `WORLD.BOUNDS 250` and `VOXEL.SIZE 0.55` that is roughly **910 × 910 × 2 ≈ 1.65M ground voxels**, which forces every chunk into existence and meshes all of them. Measured at 5× per side: **19 s boot, 1007 draw calls, 3.5 GB heap** — which is why the map shipped at 5× *area* instead of the size it wants to be.

> Chris, 2026-08-07: *"Much bigger map"* — chosen over a same-size perf fix, on the grounds that a perf fix is invisible in a playtest.

Generate and mesh only what is near the player; unload what is not; and let the map get much bigger as a result.

## Why this is first

It gates almost everything else on the list, and doing content first means authoring it twice:

- **Finer voxels** — voxel count scales with the cube of 1/size.
- **Underground areas** and **house interiors** — both multiply the voxel count of an already-eager world.
- **Procedural space authoring** (`docs/backlog.md`, 2026-08-07) — a generator that authors a *kind* of place has nothing to hang off until chunks generate on demand.
- **Milestone 13 (navigation)** — depends on the layout layer this introduces.

## The layout / voxelize split

**The single most important design decision here, and the reason milestone 13 is cheap.**

Generation splits into two layers:

- **Layout** — pure, cheap, seeded, and queryable *without* generating anything: "what is at world (x, z)?" → road / block / building footprint + type + height. Derived from `CITY.SEED` and the block grid, exactly as `buildDistrict` already derives it. No voxels, no meshes, no allocation per query.
- **Voxelize** — expensive: turn a layout region into actual voxels in a chunk. Runs on demand, near the player only.

The minimap, the map screen and waypoint placement all read **layout**, never voxels. Without this split a minimap under streaming would show only the handful of chunks currently loaded — i.e. almost nothing — and a waypoint could not be dropped on anywhere the player has not already been, which is precisely where you want to drop one.

It also makes the city testable without building it: layout queries are pure functions over a seed.

## Scope

- `src/level/Layout.js` (new) — the pure layout layer. Block grid, road mask, per-block building type/size/height from the seeded PRNG. Extracted from `buildDistrict`'s existing logic, not reinvented.
- `src/level/VoxelWorld.js` — chunk lifecycle: `ensureLoaded(cx, cz)`, `unload(...)`, an LRU or radius policy, and geometry disposal on unload.
- `src/level/VoxelCity.js` — `buildGround` and the building builders become **chunk-clipped**: given a chunk's extent, write only the voxels that fall inside it.
- `src/core/Constants.js` — `STREAM` block: load radius, unload radius (hysteresis), chunk budget per frame. `WORLD.BOUNDS` raised.
- `src/core/Game.js` — drive streaming from Jimothy's position each frame; extend `render_game_to_text()` with chunk counts, loaded/unloaded totals and edit-store size.

## Buildings straddle chunk borders — the trap

`buildCraftsman` writes a 14×12×9 footprint from one origin; `CHUNK_XZ` is 64 voxels. A building near a chunk seam writes into two or four chunks. Generating "the buildings in this chunk" by origin alone leaves **sliced houses** at every seam.

The fix is that a chunk asks layout for every building whose *footprint intersects* it, then voxelizes each one **clipped** to its own extent. Each builder must therefore be safe to run more than once across different chunks and produce identical results — which it will, because layout is pure and seeded.

## Damage must survive an unload

> Chris, 2026-08-07: damage persists.

An unloaded chunk that regenerates from the seed comes back **pristine**, healing every hole Jimothy made. In a game whose point is destruction, that is not an acceptable failure.

Store **edits, not chunks**: a per-chunk sparse map of voxel index → material (0 for removed). Re-apply after voxelizing on reload. Memory then scales with *how much has been wrecked*, not with world size, so an untouched city costs nothing.

## Out of scope

- Structural integrity / collapse (JIM-02). Streaming makes it harder, not easier; keep them apart.
- Finer voxels. This unblocks them; changing `VOXEL.SIZE` in the same milestone would confound the perf measurements.
- Underground areas and house interiors — they need this, they are not part of it.
- The minimap, map screen and waypoints — **milestone 13**. This milestone owes them the layout layer and nothing more.
- Retuning heat/pursuer pacing for the larger map. Expected to need it (see risks); do it with Chris at the playtest, not blind.

## Dependencies

- **Depends on:** nothing. ADR-0003 (voxels) already in place.
- **Blocks:** milestone 13 (navigation), procedural space authoring, finer voxels, underground areas, house interiors, JIM-02

## Acceptance criteria

- [ ] Boot time is flat as `WORLD.BOUNDS` grows — measured at the old bounds and at the new, and the two are within noise of each other
- [ ] `WORLD.BOUNDS` raised to at least 4× per side (16× area) with boot under 2 s and heap bounded — the numbers JIM-01 recorded (19 s / 3.5 GB at 5× per side) are the baseline to beat
- [ ] Draw calls stay bounded as the map grows — they track the load radius, not the world size
- [ ] Walking in any direction for a long distance never produces a hole in the ground, and never drops Jimothy through it: `groundHeightAt` must be correct for a column whose chunk has not been generated yet
- [ ] No sliced buildings at chunk seams — walk the seam of a chunk containing a house and assert the footprint is whole
- [ ] Blast a wall, walk far enough for the chunk to unload, come back: **the hole is still there**
- [ ] Memory is bounded on a long run — walk a long loop and assert loaded-chunk count plateaus rather than climbing
- [ ] Restart still rebuilds a clean city and leaks nothing (existing `restart rebuilds the district` spec keeps passing)
- [ ] The city is still deterministic from `CITY.SEED` — same seed, same layout, whatever order chunks happened to load in

## Exit condition

User runs in one direction for far longer than the old map allowed → the city keeps coming, boot was instant, the frame rate holds, and a building he smashed on the way out is still smashed when he comes back past it.

## Test plan

Mostly assertable without a playtest, which is unusual for this project and worth exploiting:

- **Layout is pure** — unit-test it directly. Same seed → same answers; no world, no scene, no browser.
- **Determinism under load order** — query layout for a region, then force chunks to load in a deliberately scrambled order and assert the resulting voxels match. This is the assertion that catches order-dependent generation bugs, which are otherwise found only by a player walking an unusual path.
- **Seam integrity** — pick a building whose footprint crosses a chunk boundary (found via layout, not hardcoded — the city is procedural and any fixed coordinate rots, per `findWallTarget`) and assert its voxel footprint is complete.
- **Damage persistence** — blast, teleport far away, `advanceTime` past the unload, teleport back, assert the voxels are still absent.
- **Boot scaling** — build at two different bounds and compare boot time and chunk count.

## Risks

- **Pacing was tuned on a small map.** Pursuers, heat decay and the animal-control converge all assume the player cannot get far away. A 16× map may make heat trivially escapable. Expect to need a tuning pass **with Chris**; do not pre-emptively retune blind, and do not let it expand this milestone.
- **A frame-budget cliff.** Generating several chunks in one frame will hitch. Budget chunks-per-frame and prefer a visible pop at the horizon over a stutter under the player.
- **`groundHeightAt` is the sharp edge.** It currently returns bedrock depth for a missing chunk, which reads as "no floor" — the exact shape of the JIM-19 fall-through. Any column the player can reach must be generated *before* physics queries it, or the query must generate synchronously.
