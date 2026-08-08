# Milestone 21: Aim, dig and see underground — the milestone-20 fix pass

## Status

**implemented 2026-08-08, awaiting playtest.**

Depends on: milestone 20 (the aimable headbutt), milestone 18 (the underground).

## Objective

Make the aimable headbutt actually aimable, and make the underground somewhere you can dig through and see.

> Chris, 2026-08-08: *"the headbutt 'aim' doesn't really line up with anything, we need the reticle to dynamically move (like a physics object) to highlight any item/surface it's on — currently it just changes for the ground but not really in front of you. Then once you're underground the 'smoothness' we had on the outer world goes away and it turns into blocks — you can't dig in a direction once a hole is made, all you can do is go deeper."*

Four defects, all measured before any code was written: **JIM-38** (aim yaw), **JIM-39** (reticle), **JIM-40** (dig sideways), **JIM-41** (camera in the rock). They are one milestone because they are one experience — pointing at a thing and hitting it — and because three of the four only show up together, underground.

## The four, and why each is the shape it is

### JIM-38 — the aim was only ever half-wired

Milestone 20 wired `CameraSystem.aimPitch` and never wired the yaw. The move and the reticle both read `JimothyController.yaw`, which updates only while he is walking. Standing still, looking left does nothing: measured 4.712 (camera) against 3.142 (Jimothy), reticle with Jimothy.

**Aim yaw is the camera yaw, always.** In orbit mode that is the mouse; in follow mode it is the bearing the camera already trails him at, so nothing changes when nobody is aiming — the same neutrality rule milestone 20 established for pitch.

**The body snaps at the moment the swing fires** (Chris's call, 2026-08-08). The alternative — turning continuously while the pointer is locked — is tighter but rewrites a walk-around feel that is already signed off. The windup is 0.12 s of rearing back, which covers the turn.

### JIM-39 — a reticle that never asks the world what is there

`impactPoint` is `from + dir * dist` and nothing else, so the marker hangs at a fixed range. It looks correct pointing down purely because the ground happens to be about that far away.

**The reticle marks where the aim ray first meets the world**, found by a DDA march (`VoxelWorld.raycast`, sibling of the existing `hasLineOfSight` traversal) plus a `THREE.Raycaster` pass over container meshes. It orients to the surface normal instead of lying flat, so it reads as a decal on a wall rather than a ring in the air.

**It must not become a second copy of the blast arithmetic** — that is milestone 20's rule and the reason there is one `impactPoint`. It does not: the march runs along *the same ray*, and asks `impactPoint` itself for the range that counts as reachable, so the two cannot disagree about direction or reach.

What the reticle promises is therefore restated, and it is a stronger promise than "two positions match": **in reach means this swing connects; a miss marker means it does not.** That is the thing a player reads it for, and it is what the spec asserts. The old spec compared the marker's position to the blast's, and that comparison stopped meaning anything the moment the marker moved onto the contact point while the sphere kept burying itself past it — so it was rewritten as *same bearing, and the blast sphere contains the marker*.

**It looks further than it can hit, deliberately.** `RETICLE.LOOK_RANGE` is 40 m against a headbutt's ~3 m. Chris asked for it to highlight whatever it is on, and a marker that vanishes past three metres highlights nothing; the third colour is what stops that being a lie.

### JIM-40 — the dig gate is right above ground and wrong below it

`digsTerrain` requires `aim >= DIG_ANGLE`, and `damageSphere` then floors removal at the column's own surface. Underground, everything is below that floor: a flat swing removes **0** voxels where an aimed-down one removes 11, from the same spot.

The gate is not wrong — it is what stops a flat swing cratering the street, and `aim.spec.js` guards that. It is *scoped* wrong. **Terrain is a target unconditionally once he is more than `DIG_BELOW` beneath his own column's surface**, because there is no road down there to protect. Above ground, nothing changes.

**And that fix alone did not work, which is the interesting part.** With the gate open the flat swing still removed nothing: the blast fired, `digsTerrain` was true, and calling `damageSphere` by hand with the same arguments removed a voxel. The whole difference was **5 mm**.

`impactPoint` drops the radius-sized standoff for a digging swing, because milestone 20 measured that at full fatness the standoff buried the sphere and left a lid over the cavern. That reasoning is entirely about pointing **down** — the downward carry is what takes the blast clear of his body. A horizontal dig gets no carry, and without the standoff the sphere centre sat 0.745 m from a wall it could reach 0.750 m into. Every swing a knife-edge miss.

So the standoff **shrinks with the downward carry** (`hypot(dir.x, dir.z)` — 1 flat, 0 straight down) rather than switching off with a flag. One rule covers both, and milestone 20's measured shaft depths survive it. Twelfth member of the family in `docs/STATE.md`: a value that was right for the only direction that existed when it was written.

### JIM-41 — a 7 m boom in a 2.9 m pipe

`CameraSystem` has no occlusion test at all. Measured in a sewer: the camera *inside solid rock*, 40 % of the boom buried. You are looking at the world from inside it, back faces culled, so the tunnel vanishes and unrelated chunk faces are what is left — Chris's "it turns into blocks".

The boom marches out from the look target and stops short of the first solid. In a sewer that necessarily means near-first-person, so he fades at close range, reusing the material-fade transition the hide spots already use.

## Scope

- `src/level/VoxelWorld.js` — `raycast()`, returning the hit and its face normal.
- `src/systems/CameraSystem.js` — `aimYaw`; the boom collides.
- `src/gameplay/JimothyController.js` — the aim yaw drives the move; the facing snaps on fire; fade at close camera range.
- `src/core/Game.js` — one `aimHit` march feeds the reticle, the dig test and the blast; `blastReach`; `impactPoint` lands on what it strikes.
- `src/core/Constants.js` — `DIG_BELOW`, `BLAST_BITE`, camera collision values, reticle miss colour. `DIG_ANGLE` deleted.
- `src/systems/InputSystem.js` — a pointer-lock override, so specs can drive the real aiming path headless.
- `src/main.js` — a look hook.

## Out of scope

- **Hold-to-charge**, still. Backlog, separate feel decision (milestone 20 deferred it too).
- **Aiming the roll.** Milestone 20 decided the roll commits to a flop; nothing here changes that, and `aim.spec.js` guards it.
- **Smoothing dug or built surfaces.** "Smooth is what you found, voxel is what you did to it" stands. JIM-41 is the reason the underground read as blocky, not the mesher.
- **Follow mode placing its camera from `pitch`.** Milestone 20's known rough edge; still a camera feel Chris has signed off.

## What shipped

`tests/aim.spec.js` grew to 11 specs, `tests/underground.spec.js` to 11. **Suite: 127 passed / 1 failed**, the failure being the pre-existing JIM-03 `interrupted feast`.

Measured on the production path, dev console clean:

| | before | after |
|---|---|---|
| camera inside rock, in a sewer | **true**, 40 % of the boom buried | never — asserted over a walk along the tunnel, 25 samples per step |
| camera distance in a sewer | 7.5 m (through the wall) | 1.0 m (`COLLIDE_MIN`), and he fades |
| flat swing underground | 0 voxels | 2 444 at fatness 40, 2 149 at fatness 90 |
| reticle, sweeping the look yaw | fixed to his facing | tracks it, and reports hit / hit-in-reach / miss per bearing |

**Two things worth Chris's judgement rather than a fix:**

- **A lean Jimothy barely scratches a tunnel wall** — 10 flat swings at fatness 0 removed 7 voxels, against ~2 400 at fatness 40. That is `FAT_BLAST_SHARE: 1.0` doing exactly what it says ("this is the move eating is meant to buy"), and tunnelling being a fat-raccoon activity seems right. But it is close to "the mechanic does nothing" at the low end.
- **Digging sideways reaches heat tier 5 in ten swings.** That is JIM-35 again, and JIM-40 makes it much easier to trigger: the underground is now a place you can spend a long time destroying.

## Appended after Chris's playtest, 2026-08-08

> *"The headbutt into the ground feels a bit off, it's like it only works if you hard lock into the ground and only works direct in front of you?"*

Two complaints, one cause: **the reticle and the swing were computed separately and disagreed.** The marker had been rebuilt to ask the world; the blast had not.

Measured before the fix, sweeping the pitch at fatness 0:

| aim below neutral | marker | swing |
|---|---|---|
| 0.04 | reachable ground, 2.15 m ahead | refuses to dig |
| 0.44 | reachable ground, 1.02 m ahead | refuses to dig |
| 0.54 | reachable ground, 0.80 m ahead | digs |

`DIG_ANGLE` was 0.5 of an available 1.04, so **more than half the downward travel bought nothing** while the reticle said the ground was right there — that is "hard lock into the ground", and it is a disagreement rather than a tuning problem.

And the crater never moved. Across a sweep where the marker travelled from 1.07 m to 0.49 m ahead, the blast landed at **1.87 m every single time**, because `impactPoint` was still a fixed standoff that never asked what was in front — "only works direct in front of you". Left/right aiming was fine (measured at 0.00 rad of error), so JIM-38 was not the problem.

**Both are fixed by deleting `DIG_ANGLE` and making one march answer everything.** `Game.aimHit` is called once per swing and once per frame; from it come *what the swing strikes*, *whether that is ground*, *whether it is in reach*, and *where the sphere goes*. They can no longer differ, because there is nothing left to differ.

- **It digs when it will actually strike ground** — geometry, not an angle. Stricter where it matters: a flat swing across a street still cannot crater the road, because a horizontal ray from chest height does not reach the ground inside a headbutt's reach. That is the 2026-07-23 fix restated as a fact rather than a threshold, and `voxel.spec.js::headbutt spares the ground` still passes.
- **The blast lands on what the marker is on**, buried by `VOXEL.BLAST_BITE` of its own radius so it takes a bite rather than grazing.

**Measured after**, at the same spots:

| | before | after |
|---|---|---|
| shallowest digging aim | 0.54 | **0.04** — set by where the ground is |
| crater across a pitch sweep | pinned at 1.87 m | tracks the marker, 1.58 → 6.72 m |
| ten downward swings, fatness 0 | 3.0 m (milestone 20) | **4.4 m** |
| ten downward swings, fatness 40 | 19.7 m (milestone 20) | **28.7 m** |

Depth went *up* rather than down, which was the risk: at a steep aim with a big blast the bite reproduces the old standoff to within 2 %, so nothing milestone 20 measured was traded away.

**Worth Chris's eye at the next playtest:** on a hillside, a swing at the *resting* aim now digs, because the hill genuinely is in front of you at chest height. On the flat it does not. That is the intended reading of "digs when it will strike ground", and the reticle turns orange to say so — but it is a real behaviour change on sloped ground.

## Acceptance criteria

- [x] Looking left and right moves the reticle — the aim ray is the camera's bearing, not his facing
- [x] The headbutt lands where the reticle was, and he turns to face it as he swings
- [x] The reticle sits on the first surface along the aim, oriented to it — asserted against a wall, which is the case the old projection never touched
- [x] The reticle marks a miss when there is nothing in range, and a swing then removes nothing — the pair, since "always on a surface" and "always a miss" each pass one half alone
- [x] Underground, a flat headbutt digs sideways; above ground a flat headbutt still spares the road — asserted as a pair for the same reason
- [x] The camera never sits inside solid rock, in a sewer or in a dug shaft
- [x] Reticle state is in `render_game_to_text()`
- [x] Looking down does not require hard-locking: no aim exists where the marker says reachable ground and the swing refuses — asserted as the property, since the honest answer is geometry and a magic angle would assert something the game should not promise
- [x] The crater lands where the marker is rather than at a fixed distance — asserted as a relationship across three aims, because any single one can agree by coincidence
- [ ] It feels like aiming, and the underground is legible — **verified by user playtest** *(round 1 done 2026-08-08; the two findings above are fixed and want re-checking)*

## Exit condition

User drops into a sewer, points at the tunnel wall, sees the reticle land *on it*, headbutts a side passage through it, and can see what he is doing the whole time.
