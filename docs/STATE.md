# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-08-07 by Claude — **milestone 10 (skinned rig) is implemented and pushed.** The skinned model is now what ships.

## Current phase

development

## Current milestone

**Milestone 10 — skinned rig** (`docs/milestones/10-skinned-rig.md`, ADR-0004): implemented, **awaiting Chris's playtest**. Every measurable AC passes. `RIG.SKINNED` now defaults to `true` and `__FORCE_SKINNED__` is gone — Jimothy is one continuous mesh on a 12-joint armature, and the seven-piece split path survives only as a one-line fallback.

The one open AC is the exit condition and is playtest-only by nature: **no seam visible at the neck, hips or tail in any pose, including mid-roll and mid-headbutt.**

**Next milestone, order CONFIRMED by Chris 2026-08-07:** streaming ground (JIM-01, roadmap Phase 1.1) → milestone 11 scamper gait. Rationale: streaming gates finer voxels, underground areas and house interiors, and doing city content first means authoring it twice.

## What this session did

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

## Next step

**Chris playtests milestone 10** (house rule 4) — roll, headbutt, then eat until huge. Watch for: a seam at neck/hips/tail in any pose, and whether the fat silhouette reads right now that the legs splay sideways instead of sliding forward.

Then **streaming ground (JIM-01)**, then **milestone 11 — scamper gait** (`docs/milestones/11-scamper-gait.md`, JIM-22): sprawled low stance plus terrain-aware foot IK. Its prerequisite is done — `tools/rig_jimothy.py` generates TWO-segment legs (`leg_*` hip→knee, `shin_*` knee→foot), because a single hip-to-foot bone cannot plant a foot on uneven ground.

**Do not rewrite the gait from scratch.** `JimothyLegs._updateTubes` already implements planted feet, drift threshold, step timing and foot lift. It was orphaned when the real model arrived. `_updateBones` is currently the crude diagonal-pair swing inherited from `_updateReal`; reconnect the tube logic to bones. `snapshot()` now reports real foot positions in bones mode, which milestone 11 needs to plant against terrain.

## Blockers

- **⚠️ Milestone 10's exit condition needs Chris's eyes.** "Implemented, awaiting playtest" is the ceiling (house rule 4). Same for milestones 08 and 09, whose sign-offs are still open.
- **⚠️ JIM-11 (legs read as detached) needs re-judging, not more code.** The skinned rig should have retired it outright — the legs are now part of the same surface. Confirm at the same playtest before touching anything.
- **⚠️ 4 specs failing, confirmed PRE-EXISTING** (JIM-03) — `score and combo`, `heat rises with chaos`, `tier-2 camera flash`, `interrupted feast`. Feast eating is still unverified end-to-end. `animal control nets jimothy` is a **parallel-worker flake** — re-run any heat/fatness failure serially before blaming a code change; the four genuine ones reproduce serially.
  - **Full suite this session, serial: 53 passed / 4 failed of 57** (`npx playwright test --workers=1`, 37 min). Exactly the four above — **no regressions from the skinned flip**, and `animal control nets jimothy` passed serially, confirming the flake diagnosis. Suite grew 55 → 57: `rig.spec.js` went from 9 specs to 11.
- Map size is still capped by eager ground allocation (JIM-01).

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
