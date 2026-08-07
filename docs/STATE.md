# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-08-07 by Claude — **milestones 17, 19 and 18 all landed, in that order.** The island has a coast, hills and 200 m of free depth; the pursuit has eyes, a memory and the ability to give up; and there is a sewer network under the arterials with crab people in it. All three are **implemented and awaiting Chris's playtest** (house rule 4).

## Current phase

development

## Current milestone

**Nothing in flight. Three milestones are implemented and unplayed — that is the next thing.**

| milestone | state | tests |
|---|---|---|
| 17 — island and terrain | implemented, awaiting playtest | `terrain.spec.js` (9), `flycam.spec.js` (5) |
| 19 — pursuer AI | implemented, awaiting playtest | `pursuers.spec.js` (8) |
| 18 — underground | implemented, awaiting playtest | `underground.spec.js` (7) |

**Suite: 102 passed / 2 failed.** Both failures are the pre-existing JIM-03 pair (`score and combo`, `interrupted feast`), down from three — `heat rises with chaos` fixed itself. `animal control nets jimothy`, historically the flakiest spec in the suite, ran 7/7 three times end to end.

## The next step: play it

Everything below is a claim a test makes. None of it is a claim Chris has made.

1. **Press F and fly.** WASD in the camera frame, Space/Z up and down, shift boosts ×5, ctrl creeps, **−/=** step the speed multiplier ×2 per press over 0.25×–32×. Mouse look while pointer-locked. Does the island read as a place from the air?
2. **Land and climb Trash Panda Heights.** It rises 40 m from its foot. Does a hill feel like a hill from the ground?
3. **Dig 20 m down.** The strata should change on the way.
4. **Get chased into an alley, break line of sight, and watch them search the wrong end of it.** Then blast a wall somewhere else and see them all turn toward the noise.
5. **Find a stairwell and go down.** They are in the middle of arterial roads. It should be dark and unpleasant, there should be crab people, and animal control should follow you in.

**Two things to look at specifically**, because they are judgement calls the tests deliberately do not make:

- **The fly camera loads a 385 m disc** (`STREAM.FLY_LOAD_RADIUS`, a slider in DevTools → Tune → Streaming). Seeing the *whole* island at once is not something this renderer does — see JIM-34.
- **Container density** was rebalanced (`CONTAINERS.KERB_SHARE_NO_ALLEYS`) and now reads 22–52 per streaming disc in every district. Does the street feel furnished, or cluttered?

## Milestone 17 — the island, and the one engineering decision

**Ground is IMPLICIT.** `solid(x, y, z) = y < surfaceHeight(x, z)` unless an edit says otherwise. Only a constant 4-voxel skin is stored, because that is what the mesher draws; a blast below it materialises the faces it exposes and nothing else. Measured at `TERRAIN.DEPTH` 20 m and 200 m:

| | 20 m | 200 m |
|---|---|---|
| stored voxels | 947,634 | **947,634** |
| chunks | 191 | **191** |
| boot | 1237 ms | 1224 ms |

**Byte-identical.** Boot is *under* milestone 12's 1654 ms baseline despite a height field, two bakes and hills. `tests/terrain.spec.js` asserts the equality exactly, so one voxel of drift fails it.

**Two shape decisions worth not re-litigating**, both recorded in the milestone:

- **Coastal hills are BLUFFS.** Trash Panda Heights' summit is 34 m from the water; it cannot be both 48 m tall and walkable from the beach. Fading hills in over a long coastal run "fixed" the slope and took the island's landmark climb from 48 m to 8. The spec now asserts *a walkable way up exists*, not that every approach is one.
- **The plan's per-bridge `span` is a crossing LENGTH, not a deck width** (70 m at a canal 84 m wide). Read as a width it built ribbons that filled a third of Lake Onion.

## ⚠️ Constants that secretly meant "grade" — five more, all silent

The three from earlier milestones meant "the middle of the old map". These meant "the waterline", and every one was wrong on a hill rather than broken:

| where | was | broke |
|---|---|---|
| `damageSphere(minVoxelY)` | absolute `0` | a headbutt on a 50 m hill was told to spare everything below sea level, and would have cratered the hillside |
| `Game.findWallTarget(probeY)` | absolute `1.0` | on a hill every probe hits rock, so it called the first spot it tried a wall |
| `Pedestrians._sync` | scan from `0.5` | started 50 m underground, found nothing, buried them at bedrock |
| bins and snacks | `height / 2`, `0.18` | spawned 45 m under a hill and stayed there |
| `voxel.spec`'s `sparedGround` | `>= 0` | passes however deep the crater is, as long as the hill is taller |

Plus **JIM-33**: `Tunables` still declared `WORLD.BOUNDS` as `[10, 38]` — the 250-unit map's slider — so any stored override was clamped to 38 and would have collapsed the island to a 76 m square.

**`voxels.terrainHeightAt(x, z)` is the answer to all of them.** Anything that needs to know where the floor is asks; `y = 0` now means the waterline and nothing else.

## Milestone 19 — the bug that looked like the opposite of itself

The steering was never the problem, exactly as the milestone predicted. `_steer` still walks straight at a target; the target now belongs to a state machine (patrol / suspicious / chase / search / give up), and vision is a cone plus a DDA march through the voxel grid.

**The obstacle avoidance re-derived which way to turn every frame.** That gives a four-frame limit cycle: step left, which unblocks the right and blocks the left, step right, repeat. Every frame it moved its full 8 cm; every second it travelled 5 cm. Traced: `-9.81,34.09 → -9.86,34.03 → -9.81,34.09 → …`. **The first stuck-detector missed it completely, because it asked "did it move" — and it did.** Commitment is the fix (a wall-follower, not a pathfinder), and the detector now measures net displacement over a window, which is the only thing that can tell walking from pacing.

Also: **they spawn `suspicious`, briefed with where he was** — they appear *because* the wanted level says someone reported him. And **suspicion runs on the same clock as a search while they are still walking to the lead**, or an unreachable lead is followed forever.

## Milestone 18 — a second 2 × 2 km layer for 6% more chunks

The sewer is **derived from the arterials**, not authored: the roads are themselves expanded from district polygons, so hand-drawn sewer lines would rot the first time an angle changed. Entrances are **guaranteed at bake time** — a run with nowhere to put a stairwell is not built at all, so a sealed pocket cannot exist to be found later.

**The AC caught a bug no surface test could have.** The net's range check was horizontal: an animal controller at the top of a shaft was "5 m away" from a raccoon 9 m below it, and netted him through the ceiling. Vision and the net are three-dimensional now.

## Read this before writing another seam check

**An automated seam check was attempted, looked convincing, and is wrong.** It measured the gap between adjacent bones' vertex buckets — zero everywhere would mean nothing had come apart.

Triangles straddle the boundary between two bones, so a joint that **stretches** separates the two vertex sets exactly as a torn one would. A fat mid-roll Jimothy measured **0.077 world units** at the hip by exact per-vertex skinning, with a provably intact mesh. Stretching is what the milestone was built to do, so the metric reports success as failure, and no threshold separates the two.

The mesh is one continuous surface and is topologically incapable of tearing. "Seam" names a *rendering* judgement, which is why the AC says playtest. Do not rebuild this.

## Blockers

- **⚠️ Three milestones await playtest, plus milestones 08, 09, 12 and 15 from before.** "Implemented, all AC ticked" is the ceiling (house rule 4). Milestone 10 is the only recent one signed off.
- **⚠️ 2 specs failing, both PRE-EXISTING** (JIM-03) — `score and combo`, `interrupted feast`. Feast eating is still unverified end to end. Re-run any heat/fatness failure serially before blaming a code change.
- **⚠️ JIM-11 (legs read as detached) needs re-judging, not more code.** The skinned rig should have retired it outright. Confirm at the same playtest before touching anything.
- **JIM-34 — no greedy meshing.** A flat chunk of ground emits 4096 quads where one would do, so a ground chunk costs ~1 MB of geometry. Invisible in normal play (210 m disc, ~110 draw calls); it is what caps the fly camera at 385 m.
- **JIM-35 — one headbutt is a five-star wanted level.** `HEAT.PER_DEMOLITION` is 0.4 per voxel and a fat headbutt removes ~1,075 of them: 430 points against a tier-5 threshold of 100. May well be intended; wants a decision rather than a discovery.

## Newest asks (2026-08-07, logged not lost)

- **JIM-23 lasso** — design SETTLED by Chris: a landed lasso starts a struggle (mash the roll button), breaking free flings the catcher, a background **exhaustion** stat means escaping twice in a row is unlikely, and a thrown lasso can tangle pedestrians/bins. Only the rope *implementation* (real cannon-es chain vs. convincing fake) is open — decide that with a measurement, not a guess.
- **JIM-24 "as big as a house"** — the fatness ceiling is ~1.9× width, roughly an order of magnitude short of the stated fantasy. `SPEED_PENALTY_MAX` is already raised 0.45 → 0.7 as step one. The rest is a rebalance, not a constant bump: the camera must pull back with girth, the kinematic sphere stops being a sane shape, the city becomes furniture rather than obstacles, and the asymptotic curve `fat/(fat+SOFTCAP)` mathematically cannot exceed `MAX_WIDTH_GAIN` no matter how much he eats. Wants its own milestone. **Note JIM-25 is the first thing that rebalance will meet.**

## What is left, and what it now unblocks

- **Milestone 13 — navigation** (minimap, map screen, waypoints). Cheapest it will ever be: the coastline, the districts, the sewer network and their names are all baked and queryable (`districtNameAtWorld`, `sewerNetwork`). A map that shows only where you have been is also what the milestone says makes tunnels tense.
- **Milestone 11 — scamper gait** (JIM-22). Independent of everything above. **Do not rewrite it from scratch** — `JimothyLegs._updateTubes` already implements planted feet, drift threshold, step timing and foot lift; it was orphaned when the real model arrived. Reconnect the tube logic to bones.
- **JIM-29 katamari roll**, **JIM-31 photo book** (which now has treasure to print), and the **easter-egg world tour**.
- **`cityPlan.js`'s parks, plazas and landmarks are not on the island** — the Space Noodle is currently nowhere. In the backlog; re-read its trademark warning before re-siting it.

## Notes for next session

- **Grade is not a constant.** Ask `voxels.terrainHeightAt(x, z)`. See the table above — five separate literals meant "just above grade" and all five were wrong.
- **`VOXEL.EMPTY` (255), not 0, for anything removed or carved.** Below the stored skin a 0 means "nothing stored, ask the height field", so a hole written as 0 heals itself the instant anything looks at it.
- **The bone rest-pose trap.** glTF bones carry their bind orientation in `bone.quaternion`. Writing `bone.rotation.x = …` destroys the rest pose and collapses the skeleton. `JimothyRig.pose()` is the only sanctioned way to move a bone.
- **Bone axis mapping, measured:** `x` pitch (the gait axis), `y` twist along the bone (invisible), `z` lateral (the sprawl axis for JIM-22).
- **Measure the SOURCE before blaming an asset.** JIM-10 cost an extra session because it was recorded as "the Meshy model is rough" without checking. It was fine. `node tools/mesh_report.mjs <file.glb>`.
- **A probe aimed at the middle of a thing cannot find a defect at its edges.** Sample where the geometry is interesting.
- **Never edit source while a Playwright run is in flight.** Vite HMR injects the change into the running suite and the results become meaningless.
- **To prove a failure is pre-existing rather than yours, without touching the working tree:** `TREE=$(git write-tree)`, `COMMIT=$(git commit-tree $TREE -p HEAD -m baseline)`, `git worktree add --detach <path> $COMMIT`, symlink `node_modules` in, kill the dev server on 3000, run the specs there, then `git worktree remove --force`.
- Playtest on the production preview (`npm run build && npm run preview -- --port 4173`), never the dev server.
- Tests boot with `__MANUAL_TIME__` and `__SKIP_RIG__`. **`__SKIP_RIG__` hides real bugs** — only `rig.spec.js` pays the model load.
- `MOVES` carries per-move destruction *policy*, and `onImpact` takes the move's whole config. Add new moves by adding a config, not by threading another parameter.
- **The level pipeline, in order:** `islandPlan.js` (data) → `Terrain.js` (height field + implicit ground) → `CityPlanner.js` (class grid, blocks, buildings, sewers) → `Layout.js` (adapter, joins the two) → `VoxelCity.js` (footprint → voxels) → `VoxelWorld.js` (voxel engine, knows nothing about islands). The one-way dependency is what lets `CityPlanner` ask `Terrain` where the water is without a cycle.
- cannon-es `applyImpulse(impulse, relativePoint)` takes a **body-relative** point. `cannon-es` keeps shapes in `body.shapes[]`; there is no `body.shape`.
