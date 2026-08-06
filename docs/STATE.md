# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-08-06 by Claude — milestone 08 fix pass (Jimothy's body and his two moves).

## Current phase

development

## Current milestone

**Milestone 08 — Jimothy fix pass** (`docs/milestones/08-jimothy-fix-pass.md`). All seven automated AC pass; awaiting Chris's playtest. `docs/roadmap.md` is still the delivery plan after this.

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

Chris playtests milestone 08's exit condition, then **Phase 1.1 (streaming/virtual ground)** per `docs/roadmap.md` — still the measured prerequisite for the map size he wants, and now also for finer voxels, underground areas, and house interiors.

## Blockers

- **⚠️ The see-through body is a MESH problem, now logged as JIM-10.** Chris's screenshot located it at the joins, not the belly. The model is not watertight — 27,964 open boundary edges on the body alone (measured by welding vertices by position and counting single-use edges), and the material is `DoubleSide`, so every hole shows his dark interior. **Do not "fix" it with `FrontSide`** — culling makes the holes show the background instead, which is worse. Candidate fixes and the ruled-out causes are in `docs/issues.md`.
- **⚠️ Everything is still uncommitted** — now ~36 files across two sessions. Chris has not approved a commit (house rule 1). Ask.
- **⚠️ 4 specs failing, confirmed PRE-EXISTING** (JIM-03) — `score and combo`, `heat rises with chaos`, `tier-2 camera flash`, `interrupted feast`. Not caused by milestone 08: verified by running them against the pre-session staged state in a throwaway worktree. The old "3 failing" list in the roadmap was wrong and has been corrected. Feast eating is still unverified end-to-end. Final suite: **50 passed / 5 failed of 55**, where the 5th (`animal control nets jimothy`) is a **parallel-worker flake** — it passed twice at `--workers=1`. Re-run any heat/fatness failure serially before blaming a code change; the four genuine ones reproduce serially.
- Map size is still capped by eager ground allocation (JIM-01).

## Notes for next session

- **Never edit source while a Playwright run is in flight.** Vite HMR injects the change into the running suite and the results become meaningless — this bit us this session and cost a full re-run.
- **To prove a failure is pre-existing rather than yours, without touching the working tree:** `TREE=$(git write-tree)`, `COMMIT=$(git commit-tree $TREE -p HEAD -m baseline)`, `git worktree add --detach <path> $COMMIT`, symlink `node_modules` in, kill the dev server on 3000 so the worktree starts its own, run the specs there, then `git worktree remove --force`. Mutates nothing, and with 36 files uncommitted across two sessions that matters. This is how JIM-03 was cleared.
- Terrain is voxel **y < 0** (`buildGround` writes strata at -1/-2, buildings start at 0). That single fact is what lets a blast be told to spare the road, and it's the cheapest lever for anything similar.
- Playtest on the production preview (`npm run build && npm run preview -- --port 4173`), never the dev server.
- Tests boot with `__MANUAL_TIME__` and `__SKIP_RIG__`. **`__SKIP_RIG__` hides real bugs:** the placeholder body sits at an offset *inside* its slot, so it scales in step with every anchor and the fatness-separation defect literally cannot reproduce without the real model. Any spec about how his pieces relate to each other must pay the ~40 s model load.
- `MOVES` now carries per-move destruction *policy* (`FAT_BLAST_SHARE`, `DIGS_TERRAIN`), and `onImpact` takes the move's whole config rather than positional arguments. Add new moves by adding a config, not by threading another parameter.
- `findWallTarget()` searches for a standoff facing real structure rather than hardcoding a coordinate — the city is procedural and any fixed coordinate rots the moment the layout changes. Use it for any future destruction spec.
- **Chris's new asks are in `docs/backlog.md`, not lost:** water physics, finer voxels (hard-blocked on streaming — voxel count scales with the cube of 1/size), underground areas, aimable headbutt, world variety (real-Seattle reference, road hierarchy, building types, interior furnishings), and the Trump sun/moon gag (rides on day/night).
- cannon-es `applyImpulse(impulse, relativePoint)` takes a **body-relative** point. Don't reintroduce that one.
