# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-08-07 by Claude — milestone 09 (mesh repair). Milestone 08 committed.

## Current phase

development

## Current milestone

**Milestone 10 — skinned rig** (`docs/milestones/10-skinned-rig.md`, ADR-0004). Blender pipeline + load path DONE and verified; **the animation port from slots to bones is what's left** — that milestone's "Where this stopped" section lists the five remaining steps in order. `RIG.SKINNED` is opt-in (`window.__FORCE_SKINNED__`) so the working split model still ships.

**Chris chose streaming ground (JIM-01, roadmap Phase 1.1) as the next milestone after this one** — rationale: it gates finer voxels, underground areas and house interiors, and doing city content first means authoring it twice.

Previous: **Milestone 09 — mesh repair** (`docs/milestones/09-mesh-repair.md`). JIM-10 fixed; all measurable AC pass, awaiting Chris's playtest. Milestone 08 is committed (`0427bf9`) and its own playtest sign-off is still open too.

**Committed this session (local only, NOT pushed):**
- `48311ac` — voxel city, pedestrians, slop-rig pipeline (the previous session's staged work)
- `0427bf9` — milestone 08 fix pass

## Milestone 09 summary

**JIM-10 was mis-diagnosed and the correction is the whole story.** It was logged as a bad source asset. Measuring the source first showed `jimothy.glb` is essentially watertight — 597 boundary edges out of 1,198,253 (0.0%). **Our own `prep_jimothy.py` was shredding it.**

Stage-by-stage instrumentation found the culprit:

| stage | verts | faces | boundary | non-manifold |
|---|---|---|---|---|
| imported | 623,874 | 798,967 | 386,765 | **0** |
| **decimated** | 127,090 | 40,000 | 55,690 | **48,237** |
| split | — | 41,219 | 56,414 | 0 |

glTF stores a vertex per face-corner at every UV/normal seam, so Blender received 623,874 vertices for a surface with 398,267 and treated the duplicates as disconnected. Decimate then collapsed a mesh it thought was in thousands of pieces. The split stage was innocent (0 faces skipped).

**Fix:** weld (`remove_doubles`, 1e-5) *before* decimating, cap each piece's cut with `holes_fill`, recalc normals. **56,414 → 940 boundary edges (98.3%)**; body 63.9% → 1.1% open. Size 4.66 → 4.71 MB. Confirmed visually from four angles.

## Last action

Scope-triaged a nine-item request down to one focused pass over Jimothy himself, on the reasoning that Phase 1.1 (streaming ground) is judged by eye and can't be judged while the character is visibly wrong.

**Fixed:**

- **Roll spun sideways.** `group.rotation.x` tumbled about the WORLD x axis because the group used three.js's default `'XYZ'` Euler order, which applies x in the parent frame. Set `rotation.order = 'YXZ'`. This silently fixed the headbutt's lean too — it had the same bug, just less visibly.
- **Head/tail/legs drifted off the body as he fattened.** The belly scales about its slot's origin; the anchors were being scaled about the GROUP origin (`base * fatWidth`), i.e. about his feet. Different pivots, so the surfaces diverged. Anchors now scale about `bodyBase`, which makes contact exact at every size by construction instead of by a fudge factor.
- **Headbutt and roll ploughed the terrain.** `damageSphere` gained a `minVoxelY` floor; terrain is voxel y < 0 and structures start at 0, so passing 0 means "smash the house, spare the road". Both moves now set `DIGS_TERRAIN: false`.
- **Roll was a tunnel-boring machine.** New design split, recorded in `MOVES`: **headbutt is the demolition tool, roll is the mobility tool.** Roll's `RADIUS_SCALE` 0.8 → 0.55 and it inherits only 30 % of the fatness blast bonus (`FAT_BLAST_SHARE`); the headbutt keeps 100 %.
- Removed the permanently-on `transparent: true` on Jimothy's materials — it parked all seven pieces in the sorted transparent queue for the entire run to buy nothing. Transparency is now a state, applied only on the transition into/out of a bush. The fade also now covers *every* piece material, not just `pieces[0]`.

**Playtest round 2 (same session):** Chris confirmed the roll tumbles forward, then flagged two more. Both appended to milestone 08:

- **Roll was too long.** It ran at 13 u/s — faster than the scurry (10), twice the walk (6) — for 9.75 m over 2.5 rotations, reading as a dodge. Now 5 u/s / 0.9 s / **one** eased rotation with a lateral wobble: a wonky flop. Note this **changes what the move is for** — it's slower than walking now, so the roll is the comedy tool, not the mobility tool. The `MOVES` comment says so rather than lying.
- **Headbutt separated the body mesh.** The head was translated 0.47 units on a 1.7-unit raccoon, dragging the open neck seam (JIM-10) into view. Pitch now carries the performance; translation cut to 0.12. Logged as JIM-18 — a **mitigation, not a cure**: any head movement shows the seam until JIM-10 is fixed.

**Playtest round 3 (same session):**

- **"Stop him falling through the floor" (JIM-19) — the symptom was inverted.** He wasn't falling through anything; he was never *landing*. Auto-step ran while airborne, so falling past a building lifted him up its side every frame: probe blocked → air above → lift → gravity → repeat. The frame trace showed `floor=0` while his feet sat at 4.4 — nothing under him at all. Permanently not-grounded (so no hop) and accumulating downward velocity for the next gap. Auto-step is now gated on `grounded`, the ground scan is **swept** from the previous frame's feet (so a surface crossed mid-frame still catches him), and a final clamp makes ending a frame below the column's surface impossible. `GROUND_STICK` (0.25) replaces an inline 0.05 that was too tight for stepped voxel geometry.
- **Roll animation.** The rig has no clips — seven separated meshes driven procedurally — so this is procedural: legs fold under him (front and rear toward each other, which is what makes the silhouette read as a ball), chin to chest, tail curls, body squashes wider-and-shorter. Trapezoid ramp so he holds the balled pose through the flop rather than only touching it at the midpoint. Exposed as `jimothy.tuck`.

**Playtest round 4 (same session):** **"The rotate is at his toes instead of central"** (JIM-20) — correct, and a consequence of round 1. `group.position` is his **feet**, so the visual group's origin is at ground level. Yaw about that origin is right; the pitch added for the roll was not, and it swung him through the road. Fixed by offsetting the group by `(c − R·c)` — algebraically `T(c)·R·T(−c)` — with `c` kept **purely vertical** so yaw (which leaves such a vector fixed) contributes exactly zero and ordinary turning is untouched. Verified numerically via new `jimothy.bodyY`/`bodyBottom` fields and visually in `output/iterate/roll-*.png`.

**Added:** `render_game_to_text()` gains `jimothy.up`, `jimothy.parts` (per-anchor radial position in the belly's own ellipsoid frame) and `rig.materials`, so three defects that were previously eyeball-only are now assertions. Hooks: `setFatness`, `faceJimothy`, `groundHeightAtWorld`, `findWallTarget`, `__game`.

## Next step

**Finish milestone 10's animation port** — the five ordered steps are in `docs/milestones/10-skinned-rig.md` under "Where this stopped". Step 1 (establish the bone axis mapping empirically, one axis at a time, and write it down) is the only genuinely unknown part; the rest is mechanical.

Then **milestone 11 — scamper gait** (`docs/milestones/11-scamper-gait.md`, JIM-22): sprawled low stance plus terrain-aware foot IK. Its prerequisite is already done — `tools/rig_jimothy.py` now generates TWO-segment legs (`leg_*` hip→knee, `shin_*` knee→foot, 12 joints), because a single hip-to-foot bone cannot plant a foot on uneven ground.

**Do not rewrite the gait from scratch.** `JimothyLegs._updateTubes` already implements planted feet, drift threshold, step timing and foot lift — it was orphaned when the real model arrived and `_updateReal` (a crude swing) took over. Reconnect that logic to bones.

**Order CONFIRMED by Chris 2026-08-07:** finish milestone 10's animation port → **streaming ground (JIM-01)** → milestone 11 scamper gait.

**Trap already found and documented, do not rediscover it:** glTF bones carry their bind orientation in `bone.quaternion`. Writing `bone.rotation.x = …` the way the old code wrote `slot.rotation.x = …` destroys the rest pose and collapses the skeleton — measured: `head` and `tail` rest pointing in opposite directions, but after zeroing both read identically. Compose deltas against a captured rest quaternion instead. Full detail in milestone 10 step 1.

**On Blender:** Chris offered to learn rigging. Told him not to — the remaining unknown is bone-axis mapping (a 20-minute empirical test, not a rigging skill), and procedural generation is genuinely better here because it re-derives from the model's proportions and stays diffable. The one place his Blender time WOULD pay off is weight painting, since distance falloff is anatomically naive near the tail/rump. Revisit only if it reads badly.

## Newest asks (2026-08-07, logged not lost)

- **JIM-23 lasso** — design now SETTLED by Chris: a landed lasso starts a struggle (mash the roll button), breaking free flings the catcher, a background **exhaustion** stat means escaping twice in a row is unlikely, and a thrown lasso can tangle pedestrians/bins. Only the rope *implementation* (real cannon-es chain vs. convincing fake) is open — decide that with a measurement, not a guess.
- **JIM-24 "as big as a house"** — the fatness ceiling is currently ~1.9× width, roughly an order of magnitude short of the stated fantasy. `SPEED_PENALTY_MAX` is already raised 0.45 → 0.7 as step one. The rest is a rebalance, not a constant bump: the camera must pull back with girth, the kinematic sphere stops being a sane shape, the city becomes furniture rather than obstacles, and the asymptotic curve `fat/(fat+SOFTCAP)` mathematically cannot exceed `MAX_WIDTH_GAIN` no matter how much he eats. Wants its own milestone.

## Blockers

- **⚠️ All five commits are LOCAL ONLY — not pushed.** Chris approved committing, not pushing.
- **⚠️ Milestone 10 is half-landed BY DESIGN.** The skinned model is real, loads, and renders seamlessly — but nothing animates it yet, so `RIG.SKINNED` stays opt-in and the game still ships the seven-piece model. Do not flip that flag until the animation port is done, or Jimothy will stand in a T-pose equivalent.
- **⚠️ Old note kept for context:** Chris approved committing, not pushing. Ask before touching `origin`.
- **⚠️ JIM-11 (legs read as detached) needs re-judging, not more code.** The leg sockets are now capped, so the join no longer shows a hole. Whatever gap remains is a different cause — most likely the hip pivot sitting at the top of the leg's bounding box, which swings the leg top out of the socket. Get Chris's eyes on it before changing anything.
- **⚠️ Milestone 08 AND 09 both await playtest sign-off.** Everything either one claims is "implemented, tests pass" — that is the ceiling until Chris plays it (house rule 4).
- **⚠️ 4 specs failing, confirmed PRE-EXISTING** (JIM-03) — `score and combo`, `heat rises with chaos`, `tier-2 camera flash`, `interrupted feast`. Not caused by milestone 08: verified by running them against the pre-session staged state in a throwaway worktree. The old "3 failing" list in the roadmap was wrong and has been corrected. Feast eating is still unverified end-to-end. Final suite: **50 passed / 5 failed of 55**, where the 5th (`animal control nets jimothy`) is a **parallel-worker flake** — it passed twice at `--workers=1`. Re-run any heat/fatness failure serially before blaming a code change; the four genuine ones reproduce serially.
- Map size is still capped by eager ground allocation (JIM-01).

## Notes for next session

- **Measure the SOURCE before blaming an asset.** JIM-10 cost an extra session because it was recorded as "the Meshy model is rough" without ever checking the Meshy model. It was fine. Use `node tools/mesh_report.mjs <file.glb>` — and note it welds vertices by position first, because glTF splits them per face-corner at UV/normal seams and raw indices make a perfect mesh look like loose triangles.
- **A probe aimed at the middle of a thing cannot find a defect at its edges.** Two pixel probes sampled Jimothy's belly centre, correctly reported "solid", and missed a model that was 64% open at the seams. Chris's screenshot found it. Sample where the geometry is interesting.
- **Never edit source while a Playwright run is in flight.** Vite HMR injects the change into the running suite and the results become meaningless — this bit us this session and cost a full re-run.
- **To prove a failure is pre-existing rather than yours, without touching the working tree:** `TREE=$(git write-tree)`, `COMMIT=$(git commit-tree $TREE -p HEAD -m baseline)`, `git worktree add --detach <path> $COMMIT`, symlink `node_modules` in, kill the dev server on 3000 so the worktree starts its own, run the specs there, then `git worktree remove --force`. Mutates nothing, and with 36 files uncommitted across two sessions that matters. This is how JIM-03 was cleared.
- Terrain is voxel **y < 0** (`buildGround` writes strata at -1/-2, buildings start at 0). That single fact is what lets a blast be told to spare the road, and it's the cheapest lever for anything similar.
- Playtest on the production preview (`npm run build && npm run preview -- --port 4173`), never the dev server.
- Tests boot with `__MANUAL_TIME__` and `__SKIP_RIG__`. **`__SKIP_RIG__` hides real bugs:** the placeholder body sits at an offset *inside* its slot, so it scales in step with every anchor and the fatness-separation defect literally cannot reproduce without the real model. Any spec about how his pieces relate to each other must pay the ~40 s model load.
- `MOVES` now carries per-move destruction *policy* (`FAT_BLAST_SHARE`, `DIGS_TERRAIN`), and `onImpact` takes the move's whole config rather than positional arguments. Add new moves by adding a config, not by threading another parameter.
- `findWallTarget()` searches for a standoff facing real structure rather than hardcoding a coordinate — the city is procedural and any fixed coordinate rots the moment the layout changes. Use it for any future destruction spec.
- **Chris's new asks are in `docs/backlog.md`, not lost:** water physics, finer voxels (hard-blocked on streaming — voxel count scales with the cube of 1/size), underground areas, aimable headbutt, world variety (real-Seattle reference, road hierarchy, building types, interior furnishings), and the Trump sun/moon gag (rides on day/night).
- cannon-es `applyImpulse(impulse, relativePoint)` takes a **body-relative** point. Don't reintroduce that one.
