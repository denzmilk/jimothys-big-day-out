# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-08-07 by Claude — **milestones 10, 12 and 15 all landed.** Milestone 10 is signed off; 12 and 15 await playtest.

## Current phase

development

## Current milestone

**Milestone 15 — density and variety** (`docs/milestones/15-density-and-variety.md`, absorbs JIM-32): **implemented, awaiting playtest.**

Density is now a property of a *block*, so it cannot dilute as the map grows: **61–81 live containers at every corner of the island**, where before there were 70 across the whole map (i.e. none outside the centre). Six archetypes over five districts, with blocks subdividing into lots — craftsman 638, shop 485, apartment 445, warehouse 252, shed 170, tower 64 across 841 blocks.

**Milestone 12 — streaming ground** (`docs/milestones/12-streaming-ground.md`, JIM-01): **implemented, every AC ticked, awaiting Chris's playtest.**

Boot cost is now **flat in map size** — 1654 / 1652 / 1640 ms at `BOUNDS` 250 / 1000 / 4000, a 256× range in area inside measurement noise, against JIM-01's baseline of 19 s / 1007 draw calls / 3.5 GB. Shipped at `BOUNDS 1000` (16× the old area). 4000 is free at boot but the game has never been *played* that big.

**Milestone 10 — skinned rig: COMPLETE**, signed off by Chris (*"Looking much better now"*). Milestones 13 (navigation), 14 (island + water) and 11 (scamper gait) are written and unstarted.

**Suite: 78 passed / 2 failed of 80, serial.** Both failures are pre-existing (JIM-03), which is down from four — `tier-2 camera flash` and `heat rises with chaos` fixed themselves as side effects. `heat.spec` went 3/7 → 7/7.

## What this session did — part 2: milestone 12, streaming ground

`WORLD.BOUNDS` 250 → 1000 (16× the area) with boot **flat in map size**: 1654 / 1652 / 1640 ms at 250 / 1000 / 4000. The work is bounded by `STREAM.LOAD_RADIUS`, not by `BOUNDS`, so map size is now a design dial rather than a performance one.

**The layout / voxelize split is the thing to understand.** `src/level/Layout.js` answers "what is at (x, z)?" for the whole city as a pure seeded function — no voxels, no browser. `VoxelCity` only turns a footprint into voxels. Milestone 13's minimap and waypoints read layout, and milestone 14's coastline is one more layout function.

**Three things it turned up, all of which cost real time:**

1. **The old PRNG made the city order-dependent.** `buildDistrict` drew every block from one sequential stream in loop order, so a block depended on how many were built before it — under streaming the city would rearrange itself as you explored. Found by *writing the order-independence spec*, not by reading the code.
2. **Entities were regenerating the world behind the streamer's back.** Every gameplay query generates on demand (that is what stops JIM-19-shaped fall-throughs), but 26 pedestrians each sample the ground under themselves every frame from wherever they are. The resident set climbed 57 → 83 and kept going. On-demand generation is now bounded to `LOAD_RADIUS` of the streaming centre; outside it, `groundHeightAt` reports grade.
3. **The contents did not scale with the world**, and two of three had to be fixed here — see Blockers and JIM-32.

**Measured traversal** (40 s sim runs through the real city): **3m 19s** to scurry one side, 5m 31s walking, 7m 19s / 12m 12s while huge. Chris: *"It's meant to be explored."*

## What this session did — part 1: milestone 10, the skinned rig

Steps 4 and 5 of the animation port. Step 4 was one line. **Step 5 was the whole session**, and it found two real bugs.

The old `rig.spec.js` measured seven detached pieces' distance from the belly — the failure mode of an architecture that no longer exists. One continuous mesh cannot reproduce it. Restating those assertions around what skinning actually promises is what surfaced the defects:

- **JIM-25 — a fat Jimothy's feet walked out past his nose and under the road.** Scaling `body` multiplies every direct child's local *position*, not just its size. The counter-scale from `4a5cd67` fixed size only. At `widthScale` 1.70 the front feet reached `z 1.25` with the nose at `1.04`, sitting `0.20` **below grade**. Found by instrumenting, not by eye — nothing reported bone positions until this session. `JimothyRig.splayLeg` now lets the legs ride only the body bone's lateral axis (bow-legged waddle) and returns the spine and drop axes to rest.
- **JIM-26 — the roll pivot fed itself stale matrices.** JIM-20's symptom, a different cause, skinned path only. `_pivot` **feeds** `group.position`, so reading it from unrefreshed matrices is a feedback loop rather than a one-frame lag: traced mid-roll past π it diverged 0.21 → 2.21 → 0.39 and put the belly at `y -0.34`. `updateMatrixWorld(true)` before the read.

**New instrumentation** (`render_game_to_text`): `rig.skinned`, `rig.bones`, `rig.boneScales` (world scale per bone) and `rig.parts` (each animated part's position in Jimothy's own frame, so walking and turning drop out and anything left moving is the animation). Bones have no per-piece object to read a transform off — without this there was no way to assert from outside that an animation moved anything, which is why the port could half-land unnoticed.

`JimothyRig` gained `_indexRestParts`, which buckets every vertex under the bone that dominates it. That is the skinned replacement for "which piece is this triangle in".

## Read this before writing another seam check

**An automated seam check was attempted, looked convincing, and is wrong.** It measured the gap between adjacent bones' vertex buckets — zero everywhere would mean nothing had come apart.

Triangles straddle the boundary between two bones, so a joint that **stretches** separates the two vertex sets exactly as a torn one would. A fat mid-roll Jimothy measured **0.077 world units** at the hip by exact per-vertex skinning, with a provably intact mesh. Stretching is what the milestone was built to do, so the metric reports success as failure, and no threshold separates the two.

The mesh is one continuous surface and is topologically incapable of tearing. "Seam" names a *rendering* judgement, which is why the AC says playtest. Do not rebuild this.

## ⚠️ Constants that secretly meant "the middle of the old map"

**Three of these have now been found in two milestones.** Assume there are more, and check every world-unit constant the next time `WORLD.BOUNDS` moves:

| constant | was | broke |
|---|---|---|
| `PURSUER_SPAWN_POINTS` | absolute ±25 | the run had **no lose condition** away from spawn |
| `HIDE_SPOTS.POSITIONS` | grid hardcoded to ±220 | the only pressure valve covered ~5% of the world |
| `CITY.DOWNTOWN_RADIUS` | literal 45 | downtown was four blocks; the tower archetype never appeared |

All three now derive from `WORLD.BOUNDS` or from the player.

## Next step

**Chris playtests milestones 12 and 15** — walk a long way, smash something, walk back, check it is still smashed. Watch for: whether the map feels explorable or empty (JIM-32 says it will feel empty away from the centre), and whether the pursuit still has teeth now pursuers spawn on a ring around him.

**Then pick from three written, unstarted milestones plus JIM-29.** Two milestones of infrastructure are behind us, so the case for something visible next is strong:

- **Milestone 14 — island + water.** Coastline instead of a walled edge, water deliberately too good, and the fairy godmother who bubbles Jimothy ashore saying the AI could not handle swimming mechanics. The most *visible* win available, and `isLand(x, z)` is one more layout function.
- **JIM-29 — katamari roll.** Now unblocked: there is finally something worth rolling through. Design is settled bar two questions (does food count on pickup or on sifting; what happens to the stash if the net lands).
- **Milestone 13 — navigation** (minimap, map screen, waypoints). Needs 12's layout layer, and draws the coastline for free once 14 lands — so it is cheapest *after* 14.
- **Milestone 11 — scamper gait** (JIM-22). Independent of all the above.

**The easter-egg world tour is now unblocked too** (`docs/backlog.md`) — milestone 15 built the shelf. Milestone 11's prerequisite is done: `tools/rig_jimothy.py` generates TWO-segment legs (`leg_*` hip→knee, `shin_*` knee→foot), because a single hip-to-foot bone cannot plant a foot on uneven ground.

**Fast travel was cut**, by Chris, after being asked how it should interact with the chase: *"nvm skip fast travel, waypoints only."* The reasoning is in milestone 13 — do not re-propose it without a deliberate decision about the pursuit structure.

**Do not rewrite the gait from scratch.** `JimothyLegs._updateTubes` already implements planted feet, drift threshold, step timing and foot lift. It was orphaned when the real model arrived. `_updateBones` is currently the crude diagonal-pair swing inherited from `_updateReal`; reconnect the tube logic to bones. `snapshot()` now reports real foot positions in bones mode, which milestone 11 needs to plant against terrain.

## Blockers

- **⚠️ Milestone 12 awaits playtest.** "Implemented, all AC ticked" is the ceiling (house rule 4). Milestones 08 and 09 sign-offs are also still open; milestone 10 is signed off.
- **⚠️ JIM-11 (legs read as detached) needs re-judging, not more code.** The skinned rig should have retired it outright — the legs are now part of the same surface. Confirm at the same playtest before touching anything.
- **⚠️ 3 specs failing, all PRE-EXISTING** (JIM-03) — `score and combo`, `heat rises with chaos`, `interrupted feast`. Feast eating is still unverified end-to-end. Down from four: **`tier-2 camera flash` now passes**, fixed as a side effect of making pursuers spawn relative to the player. Re-run any heat/fatness failure serially before blaming a code change; `animal control nets jimothy` is a known parallel-worker flake.
  - Suite grew 55 → 71 this session (rig 9 → 11, plus 8 layout and 6 streaming specs). Every spec file was run after the final change; only the three above fail.
- **⚠️ JIM-32: the map is 16× bigger and its contents are not.** Beyond the central district there are no cans and no snacks — ground and buildings only. This is the "empty big map" failure the gameplan explicitly warns about. Probably the next thing to do.
- ~~Map size is still capped by eager ground allocation (JIM-01)~~ — **fixed**, milestone 12.

## Newest asks (2026-08-07, logged not lost)

- **JIM-23 lasso** — design SETTLED by Chris: a landed lasso starts a struggle (mash the roll button), breaking free flings the catcher, a background **exhaustion** stat means escaping twice in a row is unlikely, and a thrown lasso can tangle pedestrians/bins. Only the rope *implementation* (real cannon-es chain vs. convincing fake) is open — decide that with a measurement, not a guess.
- **JIM-24 "as big as a house"** — the fatness ceiling is ~1.9× width, roughly an order of magnitude short of the stated fantasy. `SPEED_PENALTY_MAX` is already raised 0.45 → 0.7 as step one. The rest is a rebalance, not a constant bump: the camera must pull back with girth, the kinematic sphere stops being a sane shape, the city becomes furniture rather than obstacles, and the asymptotic curve `fat/(fat+SOFTCAP)` mathematically cannot exceed `MAX_WIDTH_GAIN` no matter how much he eats. Wants its own milestone. **Note JIM-25 is the first thing that rebalance will meet** — the belly's underside already reaches `y 0.36` at the current ceiling, and it goes below grade well before "house".

## Notes for next session

- **The bone rest-pose trap, still the first thing that will bite you.** glTF bones carry their bind orientation in `bone.quaternion`. Writing `bone.rotation.x = …` the way the old code wrote `slot.rotation.x = …` destroys the rest pose and collapses the skeleton — measured: `head` and `tail` rest pointing in opposite directions, but after zeroing both read identically. `JimothyRig.pose()` is the only sanctioned way to move a bone; it composes a delta against the captured rest quaternion. Full detail in milestone 10 step 1.
- **Bone axis mapping, measured with the bind orientation intact:** `x` pitch (head chin drops, tail lifts, legs swing fore/aft — the gait axis), `y` twist along the bone (invisible), `z` lateral (head turns, tail wags, legs splay — the sprawl axis for JIM-22). Consistent across bones because `rig_jimothy.py` builds them all the same way.
- **The `body` bone's own frame, measured from the four hips' bind positions:** `x` lateral (flips sign L↔R), `y` along the spine (differs front↔rear; the only non-zero component on `neck` and `head`), `z` the drop from spine to hip (identical on all four). This is what JIM-25 needed. `tail`'s bind position is exactly `[0,0,0]` — the body bone's origin — so it never rides outward, by construction.
- **Measure the SOURCE before blaming an asset.** JIM-10 cost an extra session because it was recorded as "the Meshy model is rough" without ever checking it. It was fine. Use `node tools/mesh_report.mjs <file.glb>` — it welds vertices by position first, because glTF splits them per face-corner at UV/normal seams and raw indices make a perfect mesh look like loose triangles.
- **A probe aimed at the middle of a thing cannot find a defect at its edges.** Two pixel probes sampled Jimothy's belly centre, correctly reported "solid", and missed a model that was 64% open at the seams. Sample where the geometry is interesting.
- **Never edit source while a Playwright run is in flight.** Vite HMR injects the change into the running suite and the results become meaningless.
- **To prove a failure is pre-existing rather than yours, without touching the working tree:** `TREE=$(git write-tree)`, `COMMIT=$(git commit-tree $TREE -p HEAD -m baseline)`, `git worktree add --detach <path> $COMMIT`, symlink `node_modules` in, kill the dev server on 3000, run the specs there, then `git worktree remove --force`. This is how JIM-03 was cleared.
- Terrain is voxel **y < 0** (`buildGround` writes strata at -1/-2, buildings start at 0). That single fact is what lets a blast be told to spare the road.
- Playtest on the production preview (`npm run build && npm run preview -- --port 4173`), never the dev server.
- Tests boot with `__MANUAL_TIME__` and `__SKIP_RIG__`. **`__SKIP_RIG__` hides real bugs** — only `rig.spec.js` pays the model load, and every defect this session found was invisible without it.
- `MOVES` carries per-move destruction *policy* (`FAT_BLAST_SHARE`, `DIGS_TERRAIN`), and `onImpact` takes the move's whole config rather than positional arguments. Add new moves by adding a config, not by threading another parameter.
- `findWallTarget()` searches for a standoff facing real structure rather than hardcoding a coordinate — the city is procedural and any fixed coordinate rots the moment the layout changes.
- **Chris's asks are in `docs/backlog.md`, not lost:** water physics, finer voxels (hard-blocked on streaming), underground areas, aimable headbutt, world variety, and the Trump sun/moon gag.
- cannon-es `applyImpulse(impulse, relativePoint)` takes a **body-relative** point. `cannon-es` keeps shapes in `body.shapes[]`; there is no `body.shape`.
