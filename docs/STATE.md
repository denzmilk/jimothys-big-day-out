# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-08-08 by Claude — **milestones 17, 19, 18 and 20 landed, plus two playtest fixes.** The island has a coast, hills and free depth; the pursuit has eyes and a memory; there is a sewer network with crab people in it; and the headbutt can be aimed, which is how you dig. Chris played it mid-session and the last three commits are his feedback.

## Current phase

development

## Current milestone

**Nothing in flight. Four milestones are implemented and unplayed — that is the next thing.**

| milestone | state | tests |
|---|---|---|
| 17 — island and terrain | implemented, awaiting playtest | `terrain.spec.js` (10), `flycam.spec.js` (5) |
| 19 — pursuer AI | implemented, awaiting playtest | `pursuers.spec.js` (8) |
| 18 — underground | implemented, awaiting playtest | `underground.spec.js` (7) |
| 20 — aimable headbutt | implemented, awaiting playtest | `aim.spec.js` (5) |

**Suite: 109 passed / 1 failed.** The failure is the pre-existing JIM-03 `interrupted feast`, and feast eating is still unverified end to end. `score and combo` and `heat rises with chaos` now pass. `animal control nets jimothy`, historically the flakiest spec, ran 7/7 three times.

## Play it — everything below is a claim a test makes, not one Chris has made

1. **F** to fly. WASD in the camera frame, Space/Z up and down, shift boosts ×5, ctrl creeps, **−/=** step the multiplier ×2 per press (0.25×–32×). Mouse look while pointer-locked.
2. **Climb Trash Panda Heights.** It rises 40 m from its foot, and the hillsides are smooth now rather than terraced.
3. **L**, then look down past halfway — the reticle turns **orange** when the swing will dig. Headbutt a ramp into the ground. Ten swings gets 3 m lean, 20 m fat.
4. **Get chased into an alley**, break line of sight, watch them search the wrong end. Then blast a wall elsewhere and see them turn toward the noise.
5. **Go underground** — stairwells are in the middle of arterial roads, or **DevTools → Level → "Drop into the nearest sewer"**. It should be dark and unpleasant, there should be crab people, and animal control should follow you in.

**Open judgement calls the tests deliberately do not make:**

- **Sewer fog is 3–30 m**, much tighter than the surface, on purpose. Chris has not been down yet. If it is too tight, ~6–60 m keeps the enclosure and lets you navigate.
- **Container density** was rebalanced and now reads 22–52 per streaming disc in every district. Furnished, or cluttered?
- **JIM-35** — one fat headbutt is 430 heat points against a tier-5 threshold of 100. Possibly intended; wants a decision.

## The engineering result that matters

**Ground is implicit.** `solid(x, y, z) = y < surfaceHeight(x, z)` unless an edit says otherwise. Only a constant 4-voxel skin is stored, because that is what the mesher draws; a blast below it materialises the faces it exposes and nothing else. Booted at `TERRAIN.DEPTH` 20 m and 200 m:

| | 20 m | 200 m |
|---|---|---|
| stored voxels | 947,634 | **947,634** |
| chunks | 191 | **191** |
| boot | 1237 ms | 1224 ms |

Byte-identical. `tests/terrain.spec.js` asserts the equality exactly. That is what made the whole underground affordable afterwards: milestone 18's second 2 × 2 km layer cost **203 chunks against 191**.

## ⚠️ The recurring bug of this project: a constant tuned for a world that no longer exists

**Eleven found so far, across four milestones.** Every one silent — nothing errors, the game just quietly does the wrong thing. When any world dimension changes, **grep every constant expressed in world units and ask what it meant when it was written.**

| constant | meant | broke |
|---|---|---|
| `PURSUER_SPAWN_POINTS` | the middle of the old map | the run had no lose condition away from spawn |
| `HIDE_SPOTS.POSITIONS` | ” | the only pressure valve covered ~5% of the world |
| `CITY.DOWNTOWN_RADIUS` | ” | downtown was four blocks; towers never appeared |
| `Tunables` `WORLD.BOUNDS: [10, 38]` | ” | any stored override clamped the island to a 76 m square (JIM-33) |
| `scene.fog` 40–200, `CAMERA.FAR` 500 | ” | 41% opaque at the edge of the loaded world (JIM-36) |
| `damageSphere(minVoxelY: 0)` | grade | a headbutt on a hill would have cratered the hillside |
| `findWallTarget(probeY: 1.0)` | ” | every probe on a hill hits rock, so it never found a standoff |
| `Pedestrians` scan from `0.5` | ” | started 50 m underground, buried them at bedrock |
| bins `height / 2`, snacks `0.18` | ” | spawned 45 m under a hill |
| `voxel.spec` `sparedGround >= 0` | ” | passes however deep the crater, if the hill is taller |
| headbutt aim = camera pitch | the horizon | the resting camera looks 26.6° down, so every swing aimed at the pavement |

**`voxels.terrainHeightAt(x, z)` is the answer to the "grade" half.** `y = 0` now means the waterline and nothing else.

## Method lessons worth keeping

- **Measuring the cost of something is not the same as checking it works.** Milestone 17's fly camera streams a 176 m radius; I measured that in columns and heap and never checked you could *see* it. Fog was 85% opaque out there — the whole extra load radius was invisible until Chris said "the fog makes it hard to see much".
- **"Did it move?" cannot detect pacing.** The pursuer avoidance had a four-frame limit cycle — step left, which unblocks the right and blocks the left, step back, forever. It moved its full 8 cm every frame and travelled 5 cm a second. The first stuck-detector missed it completely. Net displacement over a window is the only thing that tells walking from pacing.
- **When adding a modifier to an existing verb, the modifier's neutral value must reproduce the old behaviour exactly.** The aim is `pitch - neutralPitch`, so "nobody is aiming" is 0.
- **Two consumers of one formula must share the function, not the formula.** The reticle and the blast both call `impactPoint`; the way a reticle comes to lie is a second copy.
- **Sample the same point.** The mesher and the generator both read the height field at the **voxel centre**; deriving the same value from a caller's exact `(x, z)` disagreed by a whole voxel near a voxel edge and silently disabled the smoothing there (0.30 m of drift).
- **Snapshot ORDER is not identity.** A blast raises heat, heat spawns paparazzi, and `pursuers[0]` becomes somebody else mid-spec. Pursuers carry a stable `id`.
- **Set up, THEN baseline.** A treasure spec asserted heat was unchanged across a pickup and caught its own eleven digging blasts (950 points). The baseline belongs between the setup and the thing under test.
- **Don't await a promise that only settles inside `advanceTime`.** Nothing ticks until the `evaluate` returns. Capture into a global, step, then read.

## Read this before writing another seam check

**An automated seam check was attempted, looked convincing, and is wrong.** It measured the gap between adjacent bones' vertex buckets — zero everywhere would mean nothing had come apart.

Triangles straddle the boundary between two bones, so a joint that **stretches** separates the two vertex sets exactly as a torn one would. A fat mid-roll Jimothy measured **0.077 world units** at the hip by exact per-vertex skinning, with a provably intact mesh. Stretching is what the milestone was built to do, so the metric reports success as failure, and no threshold separates the two.

The mesh is one continuous surface and is topologically incapable of tearing. "Seam" names a *rendering* judgement, which is why the AC says playtest. Do not rebuild this.

## Blockers

- **⚠️ Four milestones await playtest** (17, 18, 19, 20), plus 08, 09, 12 and 15 from before. "Implemented, all AC ticked" is the ceiling (house rule 4). Milestone 10 is the only one signed off.
- **⚠️ JIM-11 (legs read as detached) needs re-judging, not more code.** The skinned rig should have retired it. Confirm at the same playtest.
- **JIM-37 — buildings pop in at 106 m**, now that fog no longer hides the streaming boundary. Chris asked for this to be logged. The cheapest real fix is a **building LOD ring**: `Layout.buildingsIntersecting` answers "what buildings are in this box" from the baked plan *without generating a voxel*, anywhere on the island, so everything from 106 m to the horizon can be one `InstancedMesh` of boxes. One draw call, no streaming.
- **JIM-34 — no greedy meshing.** A flat ground chunk emits 4096 quads where one would do (~1 MB per chunk). Invisible in normal play; it is what caps the fly camera at 385 m and makes `LOAD_RADIUS` expensive.
- **JIM-35 — one headbutt is a five-star wanted level.** Balance; wants Chris's judgement.
- **⚠️ 1 spec failing, PRE-EXISTING** (JIM-03) — `interrupted feast`.

## Newest asks (logged, not lost)

- **JIM-23 lasso** — design SETTLED: a landed lasso starts a struggle (mash roll), breaking free flings the catcher, a background **exhaustion** stat makes escaping twice unlikely, and a thrown lasso can tangle pedestrians/bins. Only the rope *implementation* (real cannon-es chain vs. convincing fake) is open — decide with a measurement.
- **JIM-24 "as big as a house"** — the fatness ceiling is ~1.9× width, an order of magnitude short of the fantasy. `SPEED_PENALTY_MAX` is already 0.7 as step one. The rest is a rebalance: the camera must pull back with girth, the kinematic sphere stops being a sane shape, the city becomes furniture, and `fat/(fat+SOFTCAP)` mathematically cannot exceed `MAX_WIDTH_GAIN`. Wants its own milestone, and **JIM-25 is the first thing it will meet**.
- **Hold-to-charge on the headbutt** — deliberately left in the backlog by milestone 20. Separate feel decision, wants its own playtest.

## What is left, and what it now unblocks

- **Milestone 13 — navigation** (minimap, map screen, waypoints). Cheapest it will ever be: coastline, districts, sewer network and their names are all baked and queryable (`districtNameAtWorld`, `sewerNetwork`, `Terrain.grid`). A map that shows only where you have been is also what makes tunnels tense.
- **JIM-37's building LOD ring** — small, visible, and the thing Chris noticed unprompted.
- **Milestone 11 — scamper gait** (JIM-22). Independent. **Do not rewrite it from scratch** — `JimothyLegs._updateTubes` already implements planted feet, drift threshold, step timing and foot lift; it was orphaned when the real model arrived. Reconnect the tube logic to bones.
- **JIM-29 katamari roll**, **JIM-31 photo book** (which now has treasure to print), and the **easter-egg world tour**.
- **`cityPlan.js`'s parks, plazas and landmarks are not on the island** — the Space Noodle is nowhere. In the backlog; re-read its trademark warning before re-siting it.

## Notes for next session

- **Grade is not a constant.** Ask `voxels.terrainHeightAt(x, z)`.
- **`VOXEL.EMPTY` (255), not 0, for anything removed or carved.** Below the stored skin a 0 means "nothing stored, ask the height field", so a hole written as 0 heals itself instantly.
- **The level pipeline, in order:** `islandPlan.js` (data) → `Terrain.js` (height field + implicit ground) → `CityPlanner.js` (class grid, blocks, buildings, sewers) → `Layout.js` (adapter) → `VoxelCity.js` (footprint → voxels) → `VoxelWorld.js` (voxel engine, knows nothing about islands). The one-way dependency lets `CityPlanner` ask `Terrain` where the water is without a cycle.
- **Smoothing is mesh-time only.** Undisturbed ground has its top face displaced onto the height field; anything dug drops out and renders blocky. Smooth is what you found, voxel is what you did to it.
- **The bone rest-pose trap.** glTF bones carry their bind orientation in `bone.quaternion`. Writing `bone.rotation.x = …` destroys the rest pose and collapses the skeleton. `JimothyRig.pose()` is the only sanctioned way to move a bone.
- **Bone axis mapping, measured:** `x` pitch (the gait axis), `y` twist along the bone (invisible), `z` lateral (the sprawl axis for JIM-22).
- **Measure the SOURCE before blaming an asset.** JIM-10 cost an extra session because it was recorded as "the Meshy model is rough" without checking. It was fine. `node tools/mesh_report.mjs <file.glb>`.
- **A probe aimed at the middle of a thing cannot find a defect at its edges.** Sample where the geometry is interesting.
- **Never edit source while a Playwright run is in flight.** Vite HMR injects the change into the running suite and the results become meaningless.
- **To prove a failure is pre-existing without touching the working tree:** `TREE=$(git write-tree)`, `COMMIT=$(git commit-tree $TREE -p HEAD -m baseline)`, `git worktree add --detach <path> $COMMIT`, symlink `node_modules` in, kill the dev server on 3000, run the specs there, then `git worktree remove --force`.
- Playtest on the production preview (`npm run build && npm run preview -- --port 4173`), never the dev server.
- Tests boot with `__MANUAL_TIME__` and `__SKIP_RIG__`. **`__SKIP_RIG__` hides real bugs** — only `rig.spec.js` pays the model load.
- `MOVES` carries per-move destruction *policy*, and `onImpact` takes the move's whole config plus a direction vector. Add moves by adding a config.
- cannon-es `applyImpulse(impulse, relativePoint)` takes a **body-relative** point. `cannon-es` keeps shapes in `body.shapes[]`; there is no `body.shape`.
