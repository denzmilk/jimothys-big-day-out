# Milestone 22: Things land on the ground

## Status

**implemented 2026-08-08, awaiting playtest.**

Depends on: milestone 17 (the island), which is what broke this.

## Objective

Make every dynamic body in the game collide with the world you can see, instead of falling through it to sea level.

> Chris, 2026-08-08: *"We'll need to add back in the voxel physics for the headbutt too — digging underground just felt like blocks disappearing."*

He is describing a symptom of **JIM-42**, and the cause is much larger than the headbutt.

## The bug

`PhysicsSystem` builds its entire static collision world in its constructor: a horizontal `CANNON.Plane` **at y = 0**, plus four 2 m perimeter walls at y = 2. That is the flat 250 m block the game had before milestone 17. The voxel world deliberately has no collision bodies at all (ADR-0003 — a body per chunk is what makes voxel destruction unaffordable), and **nothing replaced the plane when the ground moved up to y ≈ 35–75.**

`y = 0` now means the waterline. So every dynamic body falls straight through the island.

**Trash cans**, height relative to the terrain directly under them:

| t | median | worst | asleep |
|---|---|---|---|
| 0 s | −0.10 m | −0.30 m | 0 / 30 |
| 1 s | −7.99 m | −8.19 m | 0 / 30 |
| 4 s | −26.14 m | −46.05 m | 25 / 30 |
| 8 s | −26.14 m | −46.05 m | **30 / 30** |

They spawn in exactly the right place — `_spawnCan` was fixed for hills in milestone 17 — then sink out of the world and sleep at sea level.

**Blast debris** sprays from y ≈ 41.8 and is at **9.3 m, still falling**, two seconds later. In a sewer it is at **0.3 m** by the first sample.

**Why nobody caught it.** Jimothy is kinematic and hand-clamped against the grid, so the player never fell. Cans stream in around the player, so the ones you walk up to spawned seconds ago and have not sunk far — the bug hides behind its own streaming. It is worst underground, where debris has nine metres of open tunnel to visibly drop out of, which is exactly where Chris was looking.

**Fourteenth member of the family in `docs/STATE.md`**, and the largest: a constant that meant "grade" and now means "the waterline". The same sentence was written about `damageSphere(minVoxelY: 0)` one session ago.

## The approach, and why not real collision bodies

ADR-0003 says static structure gets **no** physics bodies, and that is not negotiable here — it is the decision that makes a destructible voxel city affordable at all, and the measurement behind it (a mesh per voxel is ~19k draw calls) applies just as hard to collision shapes.

So dynamic bodies collide the way Jimothy already does: **by grid lookup, after the step.** `PhysicsSystem` owns the cannon world, so it owns the clamp — one place, applied to every dynamic body it has ever been handed, which means the vehicles and props in the entity-registry backlog get it for free rather than each re-implementing it.

Three parts, mirroring the controller:

1. **Rest on the floor** — scan down from where the body *was*, not only from where it is, so a fast-falling chunk cannot tunnel through a 0.55 m voxel in one 1/60 s step.
2. **Stop at walls** — per-axis revert, the same shape as `JimothyController._clampAxis`, minus the auto-step (rubble does not climb kerbs).
3. **Wake when the floor goes** — a body resting on ground that is then blasted away must fall. Nothing else can notice: there are no collision events to lose, because there is no collider. This is the part that actually turns "the blast removed voxels" into destruction you can watch.

## Scope

- `src/systems/PhysicsSystem.js` — the clamp, `attachWorld`, and `resetSweep`.
- `src/core/Game.js` — hand the physics system the voxel world.
- `src/core/Constants.js` — a `PHYSICS` block for restitution, friction, the settle threshold and the runaway height cap.
- `src/gameplay/Debris.js` — park the pool asleep; clear the sweep on reuse.
- `src/gameplay/TrashCans.js` — spawn on the walkable surface, and not at all inside a building.
- `tests/physics.spec.js` — new.

## Out of scope

- **Smoothing dug surfaces (JIM-43)** — the other half of Chris's sentence, and a replacement of the quad mesher rather than an extension. Its own milestone, and it must be decided together with JIM-34.
- **World-consuming fatness (JIM-24)** — escalated the same day; a rebalance of the whole game's dynamic range.
- **The perimeter walls at y = 2.** Also from the 250 m block, also meaningless now — but they are wired to the `WORLD.BOUNDS` tunable and to a milestone-04 acceptance criterion, and they are harmless where they sit. Left alone deliberately rather than by oversight.
- **The `y = 0` plane itself stays**, as a backstop. `TERRAIN.SEA_LEVEL` is 0, so it is exactly the waterline: anything that leaves the island now rests on the sea rather than falling forever.

## What shipped, and the four bugs found on the way

`tests/physics.spec.js`, 6 specs. **Suite: 125 passed / 1 failed**, the failure being the pre-existing JIM-03.

Everything now settles to **exactly 0.27 m above its floor** — half a voxel, which is a 0.55 m cube sitting on the ground — within about two seconds, on the surface and in a sewer. The clamp costs **0.11 ms per step for 190 bodies**, against a bare `world.step` of 0.10 ms.

The clamp was written in an hour. Four of the five hours went on things it broke, and all four are the same shape: **a rule that moves a body toward clear space has to REACH clear space in one move, or it is a ratchet.**

1. **The pool went to orbit.** Lifting a buried body to the top of the voxel it is *in* puts its centre in the next voxel up. One voxel per step, 33 m/s: the parked debris pool had climbed **13 km** through bedrock, and since the ground scan is O(height) each of those 144 bodies was walking 24,000 voxels per step — 157 ms per clamp, which turned a 5 s test into a three-minute hang. A buried body now stops instead of being lifted, and a bounded lift would have been the same ratchet, slower.
2. **Freezing is not the same as stopping.** The first version skipped buried bodies without touching their velocity, so one can that spawned inside a kerb still reached the waterline 46 m down while all 29 others rested correctly. "We are not steering this one" quietly means "this one accelerates through the planet".
3. **Pooled bodies remembered a previous life.** Debris slots are recycled by index, so slot 7's "previous position" is a spot by whatever wall was smashed three seconds ago — and the clamp reverts *into* that position. `PhysicsSystem.resetSweep` now exists, and anything that teleports a body must call it. Same discipline as `teleportJimothy` clearing `_prevFeetY`.
4. **There was no ceiling.** `DEBRIS.IMPULSE` fires upward by design, so with only a floor clamp one chunk of every underground blast sailed through the 2.9 m sewer roof and set into the rock above like a fossil.

**Two adjacent bugs it exposed**, both fixed here because the clamp turns them from invisible into permanent:

- **Bins spawned against the bare terrain height**, not the surface you can stand on — so one per run spawned inside a kerb or a wall. Roads and foundations sit *on* the terrain; `groundHeightAt` knows that and `terrainHeightAt` does not. A bin whose spot is inside a building is now not spawned at all.
- **The debris pool shipped 150 awake bodies falling out of the world from frame zero.** Every slot starts dead, and `update` only sleeps a slot it has just killed, so nothing ever slept the initial ones. Invisible before this milestone and expensive after it.

## Acceptance criteria

- [x] Trash cans are still resting on their own ground long after they spawn — the regression, asserted as a drop of centimetres rather than tens of metres
- [x] Blast debris on the surface comes to rest on the terrain, not at sea level
- [x] Blast debris in a sewer settles on the tunnel floor — the case Chris was looking at
- [x] Debris does not pass through a tunnel wall
- [x] Blasting the ground out from under a resting can makes it fall — including one that had gone to sleep
- [x] Jimothy is unaffected: he is kinematic and clamps himself, and must not be clamped twice
- [x] Costs no measurable frame time at the debris cap
- [ ] Rubble reads as rubble — **verified by user playtest**

## Exit condition

User headbutts a wall and watches the chunks fly out, bounce, and come to rest on the floor in front of him — above ground and in a tunnel.
