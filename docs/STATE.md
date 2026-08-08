# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-08-08 by Claude — **milestone 22: everything in the game had been falling through the island since milestone 17.** Chris's *"digging underground just felt like blocks disappearing"* turned out to be JIM-42: the only floor in the physics world was a plane at y = 0, and y = 0 has meant the waterline since the ground moved to y ≈ 35–75. Blast debris and **every trash can** fell 26–46 m through the terrain and slept at sea level. Fixed; things land now.

Earlier the same session — **milestone 21: the aimable headbutt now actually aims, and the underground is somewhere you can dig through and see.** Chris played milestone 20 and reported two things; they turned out to be four defects (JIM-38 to JIM-41), each measured before a line was written. All four fixed, all four with specs. Then a **fatness dial in the dev panel** (milestone 04, appended), because judging any of it at full fatness meant eating dozens of snacks first.

## Current phase

development

## Current milestone

**Nothing in flight. Five milestones are implemented and unplayed — that is the next thing.**

| milestone | state | tests |
|---|---|---|
| 17 — island and terrain | implemented, awaiting playtest | `terrain.spec.js` (10), `flycam.spec.js` (5) |
| 19 — pursuer AI | implemented, awaiting playtest | `pursuers.spec.js` (8) |
| 18 — underground | implemented, awaiting playtest | `underground.spec.js` (11) |
| 20 — aimable headbutt | implemented, awaiting playtest | `aim.spec.js` (9) |
| 21 — aim/dig/see underground | implemented, awaiting playtest | the 7 new specs in the two files above |
| 22 — things land on the ground | implemented, awaiting playtest | `physics.spec.js` (6) |

**Chris played round 1 of milestone 21 on 2026-08-08** and found two things, both fixed the same session: the dig needed a hard lock, and the crater never moved. Both were the same cause — the reticle had been rebuilt to ask the world and the blast had not, so they disagreed. `DIG_ANGLE` is gone; one march now answers what the swing strikes, whether that is ground, whether it is in reach, and where the sphere goes.

**Suite: 127 passed / 1 failed.** The failure is the pre-existing JIM-03 `interrupted feast`, and feast eating is still unverified end to end.

## Play it — everything below is a claim a test makes, not one Chris has made

1. **`** for the dev panel → **Jimothy** tab. Drag fatness, or hit **Gorged**. The readout says what the number buys — blast radius, width, waddle speed, whether a bush still fits. **Everything below is worth trying at two fatnesses**, because fatness is the game's whole power curve: 0 is 0.75 m of blast, 90 is 5.05 m.
2. **F** to fly. WASD in the camera frame, Space/Z up and down, shift boosts ×5, ctrl creeps, **−/=** step the multiplier ×2 per press (0.25×–32×). Mouse look while pointer-locked.
3. **Climb Trash Panda Heights.** It rises 40 m from its foot, and the hillsides are smooth now rather than terraced.
4. **L**, then *look around*. The reticle should now sit **on** whatever you point at — a wall, a bin, the road — oriented to that surface, and it tracks left/right as well as up/down. Three colours: **cream** in reach, **orange** the swing will dig, **grey** too far to hit. **The crater lands where the marker is**, and a gentle look down digs — no hard lock (both fixed after Chris's round-1 playtest).
5. **Headbutt something off to your side.** He whips round to face it as he swings — that is the "snap on the swing" call.
6. **Get chased into an alley**, break line of sight, watch them search the wrong end. Then blast a wall elsewhere and see them turn toward the noise.
7. **Go underground** — stairwells are in the middle of arterial roads, or **DevTools → Level → "Drop into the nearest sewer"**. You should be able to *see* it now (JIM-41), and **point at a tunnel wall and headbutt a side passage through it** (JIM-40). Get fat first: a lean raccoon barely scratches the rock.

**Open judgement calls the tests deliberately do not make:**

- **The underground camera goes near-first-person.** Measured at 1.0 m in a sewer, because a 7 m boom does not fit in a 2.9 m pipe. He fades so you can see past him. If it reads badly, the fix is in the backlog: flatten the boom's pitch when squeezed, and it can sit 5–6 m back along the tunnel instead.
- **Sewer fog is 3–30 m**, much tighter than the surface, on purpose. Chris has still not been down. If it is too tight, ~6–60 m keeps the enclosure and lets you navigate.
- **Container density** was rebalanced and now reads 22–52 per streaming disc in every district. Furnished, or cluttered?
- **JIM-35** — one fat headbutt is 430 heat points against a tier-5 threshold of 100, and **milestone 21 made this much easier to hit**: ten swings at a tunnel wall reach tier 5. Wants a decision.
- **A lean Jimothy cannot really tunnel** — 7 voxels in 10 swings at fatness 0, against ~2 400 at fatness 40. Backlog; may well be intended. (Ten *downward* swings now sink him 4.4 m at fatness 0 and 28.7 m at fatness 40, both up from milestone 20.)
- **On a hillside, a swing at the RESTING aim now digs** — the hill genuinely is in front of you at chest height, so "digs when it will strike ground" says yes. On the flat it does not, and the marker turns orange either way. Intended, and a real behaviour change on sloped ground that Chris has not seen.

## The engineering result that matters

**Ground is implicit.** `solid(x, y, z) = y < surfaceHeight(x, z)` unless an edit says otherwise. Only a constant 4-voxel skin is stored, because that is what the mesher draws; a blast below it materialises the faces it exposes and nothing else. Booted at `TERRAIN.DEPTH` 20 m and 200 m:

| | 20 m | 200 m |
|---|---|---|
| stored voxels | 947,634 | **947,634** |
| chunks | 191 | **191** |
| boot | 1237 ms | 1224 ms |

Byte-identical. `tests/terrain.spec.js` asserts the equality exactly. That is what made the whole underground affordable afterwards: milestone 18's second 2 × 2 km layer cost **203 chunks against 191**.

## ⚠️ The recurring bug of this project: a constant tuned for a world that no longer exists

**Fourteen found so far, across six milestones.** Every one silent — nothing errors, the game just quietly does the wrong thing. When any world dimension changes, **grep every constant expressed in world units and ask what it meant when it was written.**

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
| `digsTerrain` = `aim >= DIG_ANGLE` | the only dig was DOWN | a flat swing underground removed 0 voxels; you could only go deeper (JIM-40) |
| `impactPoint` drops the standoff when digging | ” | no downward carry to replace it sideways, so the sphere stopped 5 mm short of every tunnel wall |
| **`CANNON.Plane()` at the origin — the only floor in the game** | grade | **every dynamic body fell 26–46 m through the island and slept at sea level (JIM-42)** |

**The last one is the biggest yet, and it hid for four milestones behind two things that were individually reasonable.** Jimothy is kinematic and clamps himself, so the player never fell; cans stream in around him, so the ones you walk up to spawned seconds ago and have not sunk far. A bug that is invisible near the player and obvious 100 m away is one a playtest cannot find — Chris only saw it underground, where rubble has nine metres of open tunnel to visibly drop out of.

**The last two are one bug wearing two coats, and the second only appeared after the first was fixed.** Opening the gate made `digsTerrain` true and the swing still removed nothing — the blast fired, the flag was right, and `damageSphere` called by hand with the same arguments removed a voxel. **When a fix does not take, re-measure rather than re-reason:** calling the layer below by hand is what separated "the gate is shut" from "the gate is open and the sphere is 5 mm short".

**`voxels.terrainHeightAt(x, z)` is the answer to the "grade" half.** `y = 0` now means the waterline and nothing else.

## Method lessons worth keeping

- **Measuring the cost of something is not the same as checking it works.** Milestone 17's fly camera streams a 176 m radius; I measured that in columns and heap and never checked you could *see* it. Fog was 85% opaque out there — the whole extra load radius was invisible until Chris said "the fog makes it hard to see much".
- **"Did it move?" cannot detect pacing.** The pursuer avoidance had a four-frame limit cycle — step left, which unblocks the right and blocks the left, step back, forever. It moved its full 8 cm every frame and travelled 5 cm a second. The first stuck-detector missed it completely. Net displacement over a window is the only thing that tells walking from pacing.
- **When adding a modifier to an existing verb, the modifier's neutral value must reproduce the old behaviour exactly.** The aim is `pitch - neutralPitch`, so "nobody is aiming" is 0. Milestone 21 is what happens when you only do this for *half* the modifier: the pitch was neutral-correct and the yaw was never wired at all, so the aimable headbutt shipped aiming on one axis.
- **When one consumer of a shared idea is rebuilt to ask the world, the others must be too — or they quietly disagree.** Milestone 21 rebuilt the reticle to march the world and left `impactPoint` a fixed projection and `digsTerrain` an angle threshold. All three were "where does this swing go", and the marker said reachable-ground at 0.04 rad while the swing refused until 0.54, with the crater pinned at 1.87 m regardless. **The fix was to delete two of them:** one `aimHit` march now answers what the swing strikes, whether that is ground, whether it is in reach and where the sphere lands. Two things that cannot be computed separately cannot drift.
- **Prefer a geometric fact to a threshold that approximates it.** `DIG_ANGLE` was trying to express "do not crater the road you are lunging over". Asking whether the swing will actually strike ground says the same thing exactly, needs no tuning, and is simultaneously stricter on the flat and looser on a hill — which is what the threshold was always failing to be.
- **A rule that moves a body toward clear space must REACH clear space in one move, or it is a ratchet.** Four separate bugs in milestone 22 were this one shape. Lifting a buried body to the top of the voxel it is *in* puts its centre in the next voxel up, so it lifts again — one voxel per step, 33 m/s, and the debris pool reached **13 km**. A *bounded* lift is the same ratchet, slower. The same sentence describes JimothyController's levitation loop (playtest 2026-08-06).
- **"Not steering it" is not the same as "stopping it".** The buried case first skipped the body without touching its velocity, and one can that spawned inside a kerb still reached the waterline 46 m down while all 29 others rested correctly. Declining to act on a body under gravity is a decision to let it accelerate through the planet.
- **Pooled objects remember their previous life.** Debris slots are recycled by index, so a slot's "previous position" is wherever it was used last — and a clamp that reverts into that position teleports the chunk across the district. Anything that TELEPORTS a body must clear its sweep history (`PhysicsSystem.resetSweep`), the same discipline `teleportJimothy` already follows.
- **A bug that is invisible near the player cannot be found by playing.** JIM-42 survived four milestones because cans stream in around Jimothy: the ones you can see spawned seconds ago and have not sunk far yet. It hid behind its own streaming, and was only visible underground where the rubble has open tunnel to fall through.
- **A test hook that fakes half a system will hide the other half.** `faceJimothy` turned his body without the camera, which was fine until the camera became half the aim — then two streaming specs failed because they had him facing a wall and swinging elsewhere, *a state no player can reach*. Fix the hook, not the game: the hook's job is to reproduce a real situation.
- **A reticle's promise has to be the thing a player reads it for.** Milestone 20 asserted the marker and the blast were the same point, which was true and became meaningless the moment the marker moved onto the contact surface while the sphere kept burying itself past it. The promise that survives both is *same bearing, and the blast contains the marker*.
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

- **⚠️ Six milestones await playtest** (17, 18, 19, 20, 21, 22), plus 08, 09, 12 and 15 from before. "Implemented, all AC ticked" is the ceiling (house rule 4). Milestone 10 is the only one signed off.
- **⚠️ JIM-11 (legs read as detached) needs re-judging, not more code.** The skinned rig should have retired it. Confirm at the same playtest.
- **JIM-37 — buildings pop in at 106 m**, now that fog no longer hides the streaming boundary. Chris asked for this to be logged. The cheapest real fix is a **building LOD ring**: `Layout.buildingsIntersecting` answers "what buildings are in this box" from the baked plan *without generating a voxel*, anywhere on the island, so everything from 106 m to the horizon can be one `InstancedMesh` of boxes. One draw call, no streaming.
- **JIM-34 — no greedy meshing.** A flat ground chunk emits 4096 quads where one would do (~1 MB per chunk). Invisible in normal play; it is what caps the fly camera at 385 m and makes `LOAD_RADIUS` expensive.
- **JIM-35 — one headbutt is a five-star wanted level.** Balance; wants Chris's judgement, and milestone 21 sharpened it — digging sideways for ten swings reaches tier 5.
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
- **The voxel world has NO colliders (ADR-0003), and never will.** Dynamic bodies are clamped against the grid after each substep by `PhysicsSystem._groundBodies`; Jimothy clamps himself and is deliberately excluded (he is KINEMATIC). Anything new with a mass gets the clamp for free by being handed to `physics.add`.
- **`fatFactor(fatness)` in `MathUtils`** is the one asymptotic curve everything fatness drives rides on — width, blast radius, speed penalty, hide squeeze. It was written longhand in four places; the dev readout would have been the fifth, and a readout that has drifted looks exactly like one that has not.
- **`voxels.raycast(ox,oy,oz, dx,dy,dz, maxDist)`** is the way to ask "what is along this line" — returns the hit point, the voxel, and the face normal, and skips the origin's own voxel. Same DDA as `hasLineOfSight`. The reticle and the camera boom both use it; anything else that needs to probe the world should too, rather than sampling in a loop.
- **The aim is TWO values.** `cameraSystem.aimPitch` (from the resting pitch) and `cameraSystem.yaw`. A move locks both at the moment it starts. `window.lookJimothy(yaw)` in specs; it forces `input.forcePointerLock`, because aiming only happens while locked and follow mode overwrites the yaw every tick.
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
