# Milestone 08: Jimothy fix pass — body, moves, and destruction discipline

## Status

in-progress

## Objective

Make Jimothy himself read correctly again. Five playtest defects (2026-08-06) all land in the same three files, and together they mean the character is currently untrustworthy to look at or judge: he tumbles sideways when he rolls, he's translucent, his head and legs drift off the belly as he fattens, and both moves chew the terrain into trenches.

**Why this before streaming ground:** the roadmap's next big item is Phase 1.1 (streaming/virtual ground), a multi-session job whose whole payoff is judged by eye — "does the city hold up at size?". You cannot answer that while the thing standing in the middle of it is see-through and spinning the wrong way. These five are small, confined, and share one playtest.

The pass also settles a design split the moves have been missing: **headbutt is the demolition tool, roll is the mobility tool.** The headbutt keeps the full fatness blast bonus; the roll only inherits a fraction of it and stops behaving like a tunnel-boring machine. Neither damages terrain by default — digging becomes something you *aim* for, which is what the backlogged aimable-headbutt feature will unlock.

## Scope

- `src/gameplay/JimothyController.js` — Euler order on the visual group; fatness anchoring computed about the body's centre; transparency only while hidden.
- `src/gameplay/JimothyLegs.js` — hip splay anchored the same way as head/tail.
- `src/gameplay/JimothyRig.js` — collect every piece material, not just `pieces[0]`, and neutralise a `BLEND`-mode material from the GLB.
- `src/level/VoxelWorld.js` — `damageSphere` gains a floor option so a blast can be told to spare terrain.
- `src/core/Game.js` — `onImpact` passes each move's terrain policy; `renderToText` gains the introspection the specs need.
- `src/core/Constants.js` — `MOVES.HEADBUTT`/`MOVES.ROLL` gain terrain and fat-scaling policy. No tuning outside this file (house rule 6).
- `src/main.js` — `setFatness` / `faceJimothy` test hooks.

## Out of scope

- **Aimable headbutt** (pitch control, reticle, charge). Backlogged 2026-08-06 — this milestone only removes the accidental digging; deliberate digging comes with aiming.
- Streaming ground, finer voxels, underground areas, water physics — all backlogged, all downstream of streaming.
- Structural integrity and material toughness (roadmap Phase 1.2/1.3).
- The 3 failing heat specs (roadmap Phase 0) — unrelated harness plumbing.

## Dependencies

- **Depends on:** milestone 06 (slop-rig), milestone 07 (destructible voxels)
- **Blocks:** nothing hard, but Phase 1.1 streaming should not start until the character is trustworthy to look at

## Acceptance criteria

- [x] Roll tumbles forward about Jimothy's own left–right axis at any heading, not about the world X axis — test: `tests/rig.spec.js::roll tumbles forward, not sideways`
- [x] The headbutt's body lean pitches forward at any heading (same root cause, separate assertion) — test: `tests/rig.spec.js::headbutt leans forward at any heading`
- [x] Jimothy renders fully opaque when not hidden, and still fades when hidden — every rig material, not just the first — test: `tests/rig.spec.js::jimothy is opaque unless hidden`
- [x] Head, tail and all four hips stay anchored to the body's surface from lean to maximum fatness — test: `tests/rig.spec.js::parts stay attached as he fattens`
- [x] A headbutt at maximum fatness demolishes a wall but leaves the ground surface intact — test: `tests/voxel.spec.js::headbutt spares the ground`
- [x] A roll at maximum fatness leaves the road walkable — test: `tests/voxel.spec.js::roll scrapes instead of trenching`
- [x] A roll removes less than half what a headbutt does into the same wall — test: `tests/voxel.spec.js::roll removes far less than a headbutt`
- [x] The roll reads as a slow wonky flop rather than a long fast spin: slower than a walk, one eased rotation, lateral wobble — playtest follow-up 2026-08-06
- [x] The headbutt no longer drags the head off the neck; pitch carries the performance instead of translation — test: `tests/rig.spec.js::head stays attached through a headbutt`
- [x] He always lands: no hovering against walls, never below grade, and the resting state is stable — test: `tests/voxel.spec.js::lands beside a building instead of hovering beside it`
- [x] The roll plays a tuck-and-sprawl rather than spinning a rigid model — test: `tests/rig.spec.js::roll plays a tuck-and-sprawl, not a rigid spin`
- [x] The tumble pivots about his middle, so no part of him passes through the road — test: `tests/rig.spec.js::roll tumbles about his middle, not his toes`
- [ ] Roll reads as a forward tumble, Jimothy looks solid, and destruction feels earned rather than automatic — verified by user playtest
- [ ] **Open, root cause found, deferred:** the see-through body is a source-mesh defect, not a material one — Jimothy's model is not watertight and `DoubleSide` shows his interior through the holes. Logged as **JIM-10** with measurements; fixing it means repairing the asset in `tools/prep_jimothy.py`, which is its own milestone rather than a line in this one. **JIM-11** (legs detached at the socket) is likely the same cause and should be re-judged after it.

## Playtest round 2 (2026-08-06)

Chris confirmed the roll now tumbles forward, and reported two follow-ups. Both were in-scope refinement of this milestone's objective, so they were appended rather than spawned:

- **"It's a bit long — should be a wonky slow roll forward, almost like a flop."** The roll travelled at 13 u/s, *faster than the scurry* (10) and more than twice the walk (6), for 9.75 m over 2.5 rotations. It read as a dodge. Now 5 u/s over 0.9 s (4.5 m) and **one** rotation, eased in-out so he commits, tips past the balance point and drops — a constant-rate spin looks like a wheel. Plus a lateral wobble that fades in and out so he doesn't snap upright on landing.
  This *changes what the move is for*: the roll is no longer a mobility tool, since it's now slower than walking. The `MOVES` comment was updated rather than left to rot — headbutt is the demolition tool, roll is the comedy tool that scrapes what it flops into.
- **"The headbutt also separates the body mesh."** The head slot was translated up to 0.47 units on a 1.7-unit raccoon — a quarter of his body length — which dragged the open neck seam (JIM-10) into view. Anticipation and follow-through are now carried by **pitch** (body 0.34 rad, head 1.6× that) with translation cut to 0.12. All seven of those previously-inline magic numbers moved into `MOVES.HEADBUTT` per house rule 6.

## Playtest round 3 (2026-08-06)

- **"Stop him falling through the floor."** Root cause was the inverse of the symptom: he never *landed*. Auto-step ran while airborne, so falling past a building lifted him up its side every frame — hovering, permanently not-grounded, accumulating downward velocity for the next gap. Gated auto-step on `grounded`, made the ground scan swept, and added a hard below-surface clamp. Logged as **JIM-19** with the frame trace.
- **"We need an animation for the roll."** The rig has no animation clips — it's seven separated meshes driven procedurally (milestone 06) — so the roll animation is procedural too: legs fold under him (front and rear toward each other, which is what makes the silhouette read as a ball), chin tucks to chest, tail curls in, body squashes wider-and-shorter. Ramped as a trapezoid — gather up, hold the pose through the flop, sprawl back out — rather than a bell curve, so the balled-up shape persists through the tumble instead of only touching it at the midpoint.

## Playtest round 4 (2026-08-06)

- **"The rotate is at his toes instead of central."** Correct, and it was a consequence of round 1: `group.position` is his *feet*, so the visual group's origin sits at ground level. Yaw about that origin is right; the pitch I added for the roll was not, and it swung his body through the road in an arc. Fixed by offsetting the group by `(c − R·c)` — algebraically `T(c)·R·T(−c)`, i.e. rotation about `c` — with `c` kept purely vertical so yaw (which leaves such a vector fixed) contributes exactly nothing and ordinary turning is untouched. Logged as **JIM-20**. Verified both numerically and by capturing frames to `output/iterate/roll-*.png`.

## Exit condition

User gets fat, presses C in the street → Jimothy tumbles head-over-tail forward, the road is still a road behind him → presses E at a wall → the wall bursts, the ground under it does not → at every size his head, tail and legs stay part of one solid, opaque animal.

## Test plan

Red-first. Rig/visual assertions go in `tests/rig.spec.js` (the only spec that loads the 4.4 MB model, per `docs/STATE.md`); destruction assertions go in `tests/voxel.spec.js` under `__SKIP_RIG__`. Both drive the game through `render_game_to_text()` + `advanceTime()`.

Three new hooks make the defects checkable without screenshots:

- `jimothy.up` — the visual group's world-space up axis. A forward tumble keeps it in the plane of his heading; the sideways bug throws it onto his right axis. This is the whole roll bug expressed as one dot product.
- `jimothy.parts` — per-piece radial position `q` in the body's own ellipsoid frame (`q ≤ 1` = touching or inside the belly). Separation is `q` climbing with fatness.
- `rig.materials` — `{ transparent, depthWrite, opacity }` per material, so "see-through" is an assertion instead of an opinion.

Playtest on the production preview (`npm run build && npm run preview -- --port 4173`), never the dev server.

## Notes

- **Root cause of the roll bug:** `THREE.Euler`'s default `'XYZ'` order applies the X rotation in the parent frame, so `group.rotation.x` tumbled about world X while `rotation.y` held the yaw. Facing world +X that is a barrel roll. `'YXZ'` applies yaw first and pitch in the yawed frame. One line, and it silently fixes the headbutt lean too.
- **Root cause of the separation bug:** the body slot scales about *its own centre* while head/tail/hip anchors were scaled about the *group origin* (`base * fatWidth`). Different centres, so the surfaces diverge. Anchoring the scale to the body's centre makes contact exact at every fatness by construction, rather than by tuned fudge factors. The 2026-07-23 pass fixed "the pieces don't move at all"; it did not make them track the surface.
- **The see-through body is a source-mesh defect (JIM-10), and both of my material hypotheses were wrong.** Worth reading as a record of what was ruled out, so nobody re-runs it:
  - The GLB declares one **opaque** material — no `alphaMode`, three JPEG textures, so no alpha channel exists anywhere in the asset. It arrives with `depthWrite: true`, so the well-known `GLTFLoader`-forces-`depthWrite:false`-on-`BLEND` trap does not apply.
  - A pixel probe put a magenta backdrop behind him and read the framebuffer at the belly's own projected centre: solid raccoon brown, byte-identical with `transparent` forced on and off, versus pure magenta with the pieces hidden.
  - **Both probes sampled the belly, which is solid — and therefore missed the seams.** Chris's screenshot showed the fault at the joins and the rear haunch. Counting edges used by exactly one triangle (after welding vertices by position) gives 27,964 open boundary edges on the body, 9,869 on the tail, and thousands on every leg. With `DoubleSide`, each hole shows the dark inside of the shell. That is the mottled, speckled look.
  - The lesson: a probe aimed at the middle of a thing cannot find a defect at its edges. Sample the seams.
  The permanent `transparent: true` was still wrong and was still removed — it parked all seven pieces in the sorted transparent queue for the whole run to buy nothing. But that is a correctness fix, not a fix for the reported symptom, and the bug is **not** closed.
- Separately worth remembering: the only *deliberate* translucency in the build is the hide fade (`opacity 0.5` in a bush) and the bushes themselves (`0.75`). With ~50 bushes on a 68 m grid, walking through one is easy to misread as a rendering fault if the symptom is ever reported away from the joins.
- Terrain is voxel `y < 0` (`buildGround` writes layers at `-1`/`-2`; buildings start at `0`), which is why a single `minVoxelY` floor on `damageSphere` cleanly separates "smash the house" from "dig the road".
- Bedrock stays indestructible independently of this — see milestone 07 notes; without a floor a dig strands him.
