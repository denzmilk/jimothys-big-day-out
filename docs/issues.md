# Issue register — Jimothy's Big Day Out

> The project's tracked defect and blocker list. `docs/backlog.md` holds *deferred ideas*; this file holds *things that are wrong*. Every issue has an ID, a status, evidence, and where it lives in the code.
>
> Issue IDs are stable and never reused. `docs/roadmap.md` references them by ID.
>
> **Status values:** `open` · `in-progress` · `fixed` (with the session that fixed it) · `wontfix` (with a reason) · `cannot-reproduce`
>
> ⚠️ **Not yet mirrored to GitHub.** The repo has a remote (`denzmilk/jimothys-big-day-out`) but the `gh` CLI on this machine is an x86 binary and won't run on Apple Silicon (`bad CPU type in executable`). Fix `gh` (`brew install gh`) and these can be filed as real GitHub issues; until then this file is the register.

## Open

### JIM-10 — Jimothy's mesh is full of holes; you can see his interior

**Status:** fixed 2026-08-07 (milestone 09) · **Severity:** high (it's the character, on screen at all times) · **Reported:** 2026-08-06 (Chris, with screenshot)

> **The original diagnosis below was WRONG and is kept for the record.** It blamed the source asset. The source asset is fine: `jimothy.glb` has 798,967 triangles, 1,198,253 edges and only **597 boundary edges — 0.0%**. It is essentially watertight. **Our own prep script was shredding it.** See "Root cause" below.

The model is not watertight. Measured directly from `public/assets/models/jimothy-rig.glb` by welding vertices by position and counting edges used by only one triangle:

| piece | tris | boundary edges |
|---|---|---|
| body | 19,850 | **27,964** |
| tail | 6,071 | 9,869 |
| head | 4,478 | 5,938 |
| leg_RR | 3,547 | 4,861 |
| leg_RL | 3,297 | 4,391 |
| leg_FR | 1,393 | 1,753 |
| leg_FL | 1,364 | 1,638 |

A sealed mesh has zero. The material renders `DoubleSide`, so every hole shows the dark *inside* of the shell — which is the mottled, speckled rear haunch in Chris's screenshot and the "slightly see-through" report.

**Do not "fix" this by switching to `FrontSide`** — backface culling would make the holes show the background instead of the interior, which is strictly worse.

Candidate fixes, cheapest last:

1. Repair at build time in `tools/prep_jimothy.py`: `remove_doubles` to weld, `recalc_normals`, then fill boundary loops (`bmesh.ops.holes_fill` / `triangle_fill`) per piece. Correct fix, zero runtime cost, re-runnable.
2. Overlap the pieces slightly at reassembly so each cut seam is buried inside its neighbour — the "slop-approved" plan already noted in the backlog's slop-rig entry.
3. Chris's suggestion: an opaque filler blob inside each piece to plug gaps visually ("a flat texture underneath"). Cheapest, robust, hides source-mesh sins generally.

(1) and (3) are complementary: (1) fixes the asset, (3) insures against the next Meshy export being just as ragged.

#### Root cause (2026-08-07) — we decimated before welding

Instrumenting each stage of `tools/prep_jimothy.py` (boundary edges per stage, via `bmesh` `edge.is_boundary`) located it exactly:

| stage | verts | faces | boundary | non-manifold |
|---|---|---|---|---|
| imported | 623,874 | 798,967 | 386,765 | **0** |
| **decimated** | 127,090 | 40,000 | 55,690 | **48,237** |
| split (7 pieces) | — | 41,219 | 56,414 | 0 |

glTF stores a separate vertex for every face-corner wherever UVs or normals split, so the importer hands Blender **623,874 vertices for a surface that only has 398,267**. Blender treats those duplicates as genuinely disconnected geometry. Decimate then collapses a mesh it believes is in thousands of separate pieces — non-manifold edges go from 0 to 48,237 and the surface tears apart. The split stage was innocent all along (it skipped 0 faces); it merely inherited the wreckage.

This is why the two earlier pixel probes disagreed with the report: the *underlying surface* really was solid where they sampled. The tearing is distributed across the whole model, concentrated visually at the seams.

#### Fix

1. **Weld before decimating.** `bmesh.ops.remove_doubles` at `WELD_DISTANCE = 1e-5` immediately after import (623,874 → 398,267 verts, exactly matching the independently-computed count for the source surface). Decimate then operates on real topology.
2. **Cap each piece's cut.** Splitting necessarily opens a hole where each neighbour used to be — the neck socket, four leg sockets, the tail stump. `bmesh.ops.holes_fill` on the boundary loops closes every piece into a solid, so pieces can move without dragging a hole into view (which is what the headbutt was doing — JIM-18).
3. `recalc_face_normals` after both, so the filled caps face outward.

**Result: 56,414 → 940 boundary edges, a 98.3% reduction.** The body went from 63.9% open to 1.1%. File size 4.66 → 4.71 MB. Verified visually from four angles — the ragged, speckled rear haunch in Chris's screenshot is gone.

The weld also merges duplicate UV corners at seams, which can smear the texture very slightly there. That is the deliberate trade and it is invisible next to the holes it removes.

**Verify with:** `node tools/mesh_report.mjs public/assets/models/jimothy-rig.glb` — boundary edges should stay in the hundreds, never the tens of thousands.

**Where:** `tools/prep_jimothy.py`, `tools/mesh_report.mjs`, `public/assets/models/jimothy-rig.glb`

---

### JIM-20 — Roll tumbled about his toes, clipping him through the road

**Status:** fixed 2026-08-06 (milestone 08, playtest round 4) · **Test:** `tests/rig.spec.js::roll tumbles about his middle, not his toes`

`group.position` is his **feet** (`p.y - PLAYER_CONFIG.RADIUS`), so the visual group's origin sits at ground level. Yaw about that origin is correct — a vertical axis through his feet is exactly right for turning — but the milestone-08 roll added a *pitch* on the same group, and pitching about a ground-level origin swings the whole body through the floor in an arc. A quarter turn puts the belly's centre at grade; the rest of the flop buries it.

**Fix:** offset the group by `(c − R·c)`, where `c` is the pivot and `R` the group's rotation. That is algebraically identical to `T(c)·R·T(−c)` — rotation about `c` — without adding a node to the hierarchy or re-expressing every slot position.

`c` is deliberately kept **purely vertical** (`0, h, 0`). Yaw leaves such a vector fixed, so `c − R·c` is exactly zero whenever he is merely turning: ordinary movement is untouched and only the tumble is affected. `h` is read from whichever mesh is currently the belly, so it is right for both the real rig and the placeholder.

Verified numerically (`jimothy.bodyY` / `bodyBottom` in `render_game_to_text`) and visually — frames captured to `output/iterate/roll-*.png` show him fully inverted mid-flop with clear air beneath.

---

### JIM-19 — Hovering against buildings / "falling through the floor"

**Status:** fixed 2026-08-06 (milestone 08, playtest round 3) · **Test:** `tests/voxel.spec.js::lands beside a building instead of hovering beside it`

Reported as falling through the floor; the actual defect was the opposite — **he never landed at all.**

The auto-step in `_resolveVoxels` ran every frame regardless of whether he was on the ground. Falling past a building, his side probe hit the wall, the space above it was clear, so he was lifted — then gravity pulled him back down, the probe hit again, and he was lifted again. Frame trace beside a craftsman at (-15.6, 0):

```
i=259  feet=4.026  floor=0  vy=-4.533  grounded=false
i=260  feet=3.941  floor=0  vy=-5.100  grounded=false
i=261  feet=4.397  floor=0  vy= 0.000  grounded=false   ← lifted back up
```

`floor=0` is the giveaway: nothing was under him at all. He hovered against the wall indefinitely, permanently not-grounded (so unable to hop), carrying a large negative velocity into whatever gap he met next — which is what surfaced as falling through the world.

**Fix:** auto-step only runs while `grounded`. Stepping up is a walking affordance; airborne, a wall should simply stop him. Two further hardening changes went in alongside:

- The ground scan is now **swept** — it starts from the higher of his current and previous feet position, so a surface crossed *between* frames still catches him. The update loop allows deltas up to 0.1 s, which is enough to step past thin geometry.
- A final clamp: he can never end a frame below his own column's surface. Falling out of the world is now impossible rather than merely unlikely.
- `PLAYER_CONFIG.GROUND_STICK` (0.25, was an inline 0.05) — how far above a surface still counts as standing on it. The old value was too tight for stepped voxel geometry.

Investigated by sweeping 289 positions across the city, dropping him from 2–80 m, and running 0.1 s worst-case frames: all landed at exactly grade. Only the beside-a-building case reproduced, which is why the frame trace was needed.

---

### JIM-18 — Headbutt pulled the head off the neck

**Status:** fixed 2026-08-06 (milestone 08, playtest round 2) · **Test:** `tests/rig.spec.js::head stays attached through a headbutt`

Listed among the open issues only because it is the same underlying exposure as JIM-10: the head slot was translated up to 0.47 units on a 1.7-unit raccoon, which dragged the open neck seam into view. Mitigated by making **pitch** carry the anticipation and follow-through (body 0.34 rad, head 1.6×) and cutting the translation to 0.12.

**This is a mitigation, not a cure.** Any head movement at all will show the seam until JIM-10 is fixed; the animation was made small enough that it doesn't. If JIM-10 gets a proper repair, the thrust can be opened back up for a punchier hit.

---

### JIM-23 — Animal control needs a real mechanic: the lasso

**Status:** open · **Severity:** high (it is the only run-ender, and right now it isn't a mechanic) · **Reported:** 2026-08-07 (Chris)

> "For the animal control/enemies, they need to have a better function instead of 'walk into jimothy and you lose' — so add an issue to give them like a lassoo which is a physics enabled rope they need to get around jimothy's head. As jimothy grows it gets easier as he gets slower."

Today capture is a proximity check: an officer reaches you, the run ends. There is no counterplay beyond "don't be near him", nothing to watch, and no moment of tension — which is a lot of weight for **the only run-ender in the game** to carry.

Replace it with a **thrown lasso**: a physics rope the officer must land over Jimothy's head. That gives the chase a readable telegraph (wind-up → throw → rope in flight), a dodge window, and a failure state for the *officer* rather than only for the player.

**Why the difficulty curve falls out for free:** fatness already costs speed (`FATNESS.SPEED_PENALTY_MAX`, 45% at the asymptote) and now grows the hitbox too. A fat Jimothy is both slower to dodge and a bigger target, so the lasso gets easier the greedier you've been — with no separate difficulty tuning. That is the fat-is-the-score fantasy paying off as *risk*, which the game currently only expresses as a speed penalty.

**Design settled by Chris, 2026-08-07:**

- **A landed lasso does not end the run — it starts a struggle.** Mash the roll button to break free. Reuses a control the player already knows, and turns the worst moment in the game into the most active one.
- **Breaking free flings the catcher away.** The escape is a *win*, with a physical payoff, not just a reset to neutral.
- **Exhaustion is a background stat.** Each capture drains it, so escaping twice in a row is unlikely — "if you get caught attempted twice in a row you're probably out". This is what stops mashing from being a free pass while keeping every single capture survivable. It also gives the run a soft failure curve instead of a binary one: the player can *feel* the noose tightening.
- **A thrown lasso can catch the wrong thing.** Pedestrians, bins, other officers. Misses become comedy rather than dead air, and it rewards using crowds as cover.

Still open:

- Rope simulation: a cannon-es chain of small bodies with distance constraints is the honest version and gives real slapstick, but a chain per officer at tier 4–5 needs a budget. A cheaper fake (animated curve + a single "did it land" test) may read just as well. **Decide with a measurement, not a guess** — that is how JIM-01 and JIM-10 went wrong.
- Does exhaustion regenerate, and how fast? It is the difference between a run that can recover and one that only decays.
- Does it interact with hide bushes and heat tiers, or is it purely spatial?

---

### JIM-24 — Jimothy should be able to get as big as a house

**Status:** open · **Severity:** high (it is the core fantasy) · **Reported:** 2026-08-07 (Chris)

> "Speed slow down can be more aggressive, the idea is that Jimothy can get as big as a house if he keeps eating."

Fatness currently asymptotes at roughly **1.9× body width** (`SOFTCAP 25`, `MAX_WIDTH_GAIN 0.9`). That is "chunky raccoon", not "the size of a house". The ceiling is the whole point of the game — *fat is the score* — and it is currently set about an order of magnitude too low.

`FATNESS.SPEED_PENALTY_MAX` also raised 0.45 → 0.7 (2026-08-07) as the first step: eating should hurt, and it is what makes the lasso (JIM-23) land.

Raising the ceiling properly touches more than one constant, and each of these is a real question rather than a number to bump:

- **Camera.** A house-sized Jimothy does not fit the current follow distance. The camera must pull back with girth, or he fills the screen and the player cannot see the street.
- **Collision radius** already tracks fatness, but at house scale the *kinematic sphere* stops being a reasonable shape for something that wide and low.
- **The city stops being an obstacle course and becomes furniture.** At house scale he steps over craftsman houses rather than smashing through them, which inverts the destruction fantasy — destruction may need to scale with him, or the growth curve needs to stay under the rooflines.
- **Hide spots stop working entirely** well before house scale (`HIDE_SQUEEZE` already handles this) — that is correct and intended, but worth confirming it degrades gracefully rather than snapping.
- **Blast radius** (`BLAST_PER_FAT`) compounds with size; a house-sized Jimothy with the current curve levels a block per headbutt.
- The **asymptotic** curve (`f = fat / (fat + SOFTCAP)`) can never exceed `MAX_WIDTH_GAIN` no matter how much he eats. House scale needs either a much larger gain or a different curve — a soft cap that keeps *rewarding* eating rather than flattening.

Wants its own milestone; it is a rebalance of the whole game around a much larger dynamic range, not a constant change.

**Where:** `src/core/Constants.js` (`FATNESS`, `CAMERA`), `src/systems/CameraSystem.js`, `src/gameplay/JimothyController.js`

**Depends on:** nothing hard, though ragdoll (JIM-08, Phase 2) would make a tangled officer much funnier.
**Where:** `src/gameplay/Pursuers.js`, `src/systems/PhysicsSystem.js`, `docs/gameplan.md` (the net is described there as the only run-ender — update it when this lands)

---

### JIM-27 — Jimothy costumes

**Status:** open · **Severity:** medium (clip value; not on the critical path) · **Reported:** 2026-08-07 (Chris)

> "Jimothy costumes too as an issue"

Wearable looks for Jimothy, persisting for a run. Absorbs the older **"pants as wearable cosmetic"** backlog entry (looted pants visibly worn rather than score-only), which was blocked on the milestone 03 loot system and on there being any way to dress him at all.

**The skinned rig (milestone 10) decides how hard this is, and the two options are very far apart:**

1. **Texture swap** — a costume is an alternate base-colour map on the one material. Nearly free, works today, no new geometry, no rig work. Covers anything paint-shaped: hi-vis vest, hawaiian shirt, a tuxedo painted on.
2. **Costume geometry bound to the same skeleton** — a separate mesh skinned to the *same* 12 bones and posed by the same `rig.pose()` calls. Needed for anything with a silhouette: a hat, a cape, sunglasses, a traffic cone on his head. Costs a per-costume Blender export step in `tools/rig_jimothy.py`, and every costume has to be re-bound if the armature ever changes.

**Do not mix the two without deciding.** Option 1 for the first pass is almost certainly right — it gets costumes into the game for a texture each, and the whole art direction is "photoreal texture on a bad model" anyway (JIM-28), so a painted-on tuxedo *is* the joke. Option 2 only for the ones that need a shape.

**Note the fatness interaction:** costume geometry bound to `body` inflates with the belly, which is correct; bound to `neck`/`leg_*` it inherits the counter-scale and stays default size, also correct. A hat parented to `head` will behave. This is only a problem if a costume spans the belly *and* an extremity.

**Where:** `src/gameplay/JimothyRig.js`, `tools/rig_jimothy.py`, `src/core/Constants.js` (`ASSET_PATHS`)

**Depends on:** JIM-28 for the textures themselves. Feeds the `scaffold-gateables` skin-picker shape if monetization ever happens.

---

### JIM-28 — Everything needs textures, and they should be janky on purpose

**Status:** open · **Severity:** medium (it is most of the game's look) · **Reported:** 2026-08-07 (Chris)

> "we'll need to texture everything too… you're welcome to use pinokio to install an image gen LLM (high quality, use my M5 pro to get some good results). I think if the textures are a bit janky - like photo realistic on a shitty model - that's the right vibe."

**This confirms the art direction already written into `docs/tech.md`** rather than changing it — that file has said "photographic PBR textures… the photo-texture-on-simple-geometry look is the intended demi-real jank" since the idea phase. What is new is the *source*: locally generated rather than CC0-sourced.

**Plan:** install a local image-gen model via Pinokio (there is a `pinokio` skill available) and run it on Chris's M5 Pro, so texture generation costs nothing per asset and can be iterated on freely — which matters, because "janky in the right way" is a taste target that will need many passes.

Open, and worth deciding before generating a library:

- **Which model.** Needs to do tileable/seamless PBR-ish output, not just pretty pictures. Some are much better at repeating surfaces than others.
- **Tileability.** A non-tiling texture on a voxel wall reads as a bug, not as jank. This is the one place "janky" is the wrong answer.
- **What gets a generated texture vs. a flat colour.** The voxel city is thousands of faces; texturing everything is a memory and draw-call question, not just an art one. Check against `voxels.drawCalls` in `render_game_to_text()`.
- **Consistency.** Independently generated textures drift in lighting and colour temperature, and a city built from them looks like a collage rather than a place. Generate in batches with a shared prompt stem.

**Where:** `public/assets/textures/`, `src/world/VoxelCity.js` (materials), `docs/tech.md` (asset pipeline — update when the source changes)

**Blocks:** JIM-27 (costumes are textures first). Pairs naturally with the procedural-space work in `docs/backlog.md` — a generator that authors a *kind* of place wants a matching set of surfaces for it.

---

### JIM-22 — Legs should scamper: sprawled, low, with physics-aware footing

**Status:** open · **Severity:** medium (it's the character's whole read) · **Reported:** 2026-08-07 (Chris)

> "What I want with his little legs is to have them be a bit more scamper-y, so a bit more sprawling and lower to the ground, like he's sort of creeping about — then have the physics aware footing you get with unity/unreal engine."

Two separate things:

**(a) Pose — sprawled and low.** Hips splayed wider, knees bent outward, body carried closer to the ground, faster cadence. A creeping raccoon, not a trotting dog. This is tuning, not architecture, and belongs in `Constants` so it can be dialled during playtest.

**(b) Footing — feet plant on real terrain.** What Unity/Unreal give via IK rigs: the foot finds the ground, the limb bends to reach it, and the body responds. On this game's voxel terrain that means sampling `groundHeightAt` per foot, so feet land correctly on crater lips, rubble piles and kerbs instead of sliding through them.

**Most of (b) already exists and was abandoned.** `JimothyLegs._updateTubes` implements a real gait — planted feet, drift threshold, step timing, foot lift — for the fallback stretchy tubes. When the real model loads, `_updateReal` takes over and is only a crude swing. The planting logic is the hard part and it is already written and playtested; it needs reconnecting to actual geometry rather than reinventing.

**Prerequisite, now done:** two-segment legs. `tools/rig_jimothy.py` generates `leg_*` (hip→knee) and `shin_*` (knee→foot) per leg — 12 joints total. A single hip-to-foot bone is a rigid stick and cannot plant a foot on uneven ground. The knee is also deliberately offset outward, which pre-defines the bend direction; a perfectly straight limb is ambiguous to an IK solver.

**Where:** `src/gameplay/JimothyLegs.js` (revive `_updateTubes`' planting against bones), `src/core/Constants.js` (`LEGS` sprawl/cadence), `tools/rig_jimothy.py` (done)

---

### JIM-21 — Seams: the rig separates instead of stretching

**Status:** implemented 2026-08-07 (milestone 10), **awaiting Chris's playtest** — the skinned model is now what ships (`RIG.SKINNED` defaults true) · **Severity:** high (it caps how far any animation can go) · **Reported:** 2026-08-07 (Chris)

> "We do need to fix the seams — have the mesh stretch instead of just separate/break."

**Why this stays open until Chris plays it.** There is no automated seam check and there cannot be a useful one: the mesh is one continuous surface, topologically incapable of tearing, and an attempt to measure gaps between adjacent bones' vertex sets reported 0.077 world units at the hip of a fat mid-roll Jimothy whose mesh was provably intact — because triangles straddle the boundary, so a joint that *stretches* separates them exactly as a torn one would. "Seam" is a rendering judgement. `rig.parts` in `render_game_to_text()` reports every part's position if one does show up.

Jimothy is **seven rigid solids** parented into slots (milestone 06). Any animation that moves a piece slides it past its neighbour, because there is no geometry spanning the joint. Milestone 09 capped the sockets so you no longer see *through* him, but a capped socket sliding past a capped stump is still a visible seam — and it is why the headbutt's head thrust had to be cut to 0.12 (JIM-18) and why the legs still read as detached (JIM-11).

**No amount of work on the split approach fixes this.** Separate solids cannot deform across a joint; that is what skinning is for.

**Fix:** one continuous mesh bound to an armature, with smooth vertex weights across each joint so the surface stretches. Bones can be placed from the same anatomy landmarks the split already computes (`neck_y`, `tail_y`, `leg_z`, plus L/R and front/back), so the hard-won calibration carries over. The game then drives **bone rotations** in exactly the places it currently drives slot rotations — head bob, tail wiggle, leg swing, roll tuck, headbutt pitch — so `JimothyController`'s animation logic survives largely intact.

Retires: the socket-capping half of JIM-10, JIM-11, and the JIM-18 thrust cap. Also lays groundwork for Phase 2 ragdoll, which wants a joint hierarchy anyway.

**Where:** `tools/prep_jimothy.py` (armature + auto-weights, export with skin), `src/gameplay/JimothyRig.js` (SkinnedMesh + bone lookup), `src/gameplay/JimothyController.js` and `JimothyLegs.js` (drive bones, not slots)

**Tooling note:** no Blender MCP server is connected to this session, and none is needed — the pipeline already runs headlessly via `blender --background --python`, which `docs/STATE.md` records as the better loop for batch asset work.

---

### JIM-11 — Legs still read as detached from the body

**Status:** open · **Severity:** medium · **Reported:** 2026-08-06 (Chris, with screenshot)

Distinct from the fatness-scaling drift fixed in milestone 08 (that one was about the gap *growing* as he ate; this is a gap present at baseline). Two suspected contributors, neither confirmed:

- The leg sockets on the body are open holes (JIM-10), so the join has nothing to close it visually even when the pieces are touching.
- The hip pivot sits at the top of the leg's bounding box (`JimothyRig._mount`), and `JimothyLegs._updateReal` swings about it — so mid-swing the top of the leg rotates out of its socket.

**Where:** `src/gameplay/JimothyRig.js` `_mount`, `src/gameplay/JimothyLegs.js` `_updateReal`
**Depends on:** JIM-10 — **now fixed (2026-08-07)**, and the leg sockets are capped, so the join no longer shows an open hole. Needs Chris to re-judge how much apparent gap is left before any further work; the remaining candidate is the hip pivot sitting at the top of the leg's bounding box, which rotates the leg top out of its socket mid-swing.

---

### JIM-12 — "Slightly see-through" body: original report

**Status:** cannot-reproduce as stated → superseded by **JIM-10** · **Reported:** 2026-08-06 (Chris)

Kept for the record because the investigation ruled out the obvious causes, and a future session should not re-run it.

Ruled out by measurement, not inspection:

- The GLB declares **one opaque material**, no `alphaMode`, and three JPEG textures — no alpha channel can exist anywhere in the asset.
- It loads with `depthWrite: true`. The common three.js trap (`GLTFLoader` forcing `depthWrite: false` for `alphaMode: BLEND`) does not apply here.
- A framebuffer probe with a magenta backdrop behind him, sampled at the belly's own projected centre, read solid raccoon brown — byte-identical with `transparent` forced on and off, versus pure magenta with the pieces hidden.

The probe sampled the belly centre, which is solid, and therefore missed the seams. Chris's screenshot located the real fault at the joins → JIM-10.

Separately: the only *deliberate* translucency in the build is the hide fade (`opacity 0.5` in a bush) and the bushes themselves (`0.75`). With ~50 bushes on a 68 m grid, walking through one is easy to hit and easy to misread as a bug — worth keeping in mind if the symptom is ever reported away from the joins.

---

### JIM-03 — Four specs failing at city scale

**Status:** open · **Severity:** medium · **Carried from:** roadmap ⚠️ #3 (2026-07-23), **list corrected 2026-08-06**

The previously recorded list was wrong. Measured on 2026-08-06 (`--workers=1`, so not worker contention), the actual failing set is:

- `tests/gameplay.spec.js::score and combo`
- `tests/heat.spec.js::heat rises with chaos but not with eating`
- `tests/heat.spec.js::tier-2 camera flash stuns jimothy` — times out in `advUntil`, i.e. the condition is never reached inside the 20 s sim budget
- `tests/fatness.spec.js::interrupted feast resets progress`

`waddles slower` and `cannot fit in bushes` — both named in the old list — now pass.

**Confirmed pre-existing, not caused by milestone 08.** Verified by materialising the pre-session staged state as a throwaway git worktree (`git write-tree` → `commit-tree` → `worktree add`, which mutates nothing) and running the same four specs there: identical failures, identical shapes. Milestone 08's destruction changes were the obvious suspect, since three of the four are heat-related and heat accrues from demolition — ruled out.

Three of the four are can-tipping/heat-accrual specs that walk Jimothy across a 500 m city, so the leading hypothesis remains harness plumbing (seek/warp budgets at city scale) rather than a gameplay break. **Feast eating is still unverified end-to-end** — treat as unknown, not working.

**Separately, the suite is flaky under parallelism.** `tests/heat.spec.js::animal control nets jimothy and ends the run` failed in a 4-worker run and then passed twice in a row at `--workers=1`. `playwright.config.js` already warns about this: the physics specs are CPU-heavy and parallel workers hit the wall-clock timeout long before any assertion fails. **Before blaming a code change for a heat/fatness failure, re-run it with `--workers=1`.** The four genuine failures above all reproduce serially; that is what distinguishes them.

**Where:** `tests/helpers.mjs` (`seek`, `warpNear`, `advUntil` budgets), `tests/heat.spec.js`, `tests/gameplay.spec.js`, `tests/fatness.spec.js`

---

### JIM-01 — Map size capped by eager ground allocation

**Status:** open · **Severity:** high (blocks the map Chris wants) · **Carried from:** roadmap ⚠️ #1

5×-per-side measured at 19 s boot / 1007 draw calls / 3.5 GB heap; currently shipped at 5× *area* instead. Fixed by roadmap Phase 1.1 (streaming/virtual ground). Also blocks finer voxels, underground areas, and house interiors — all three multiply voxel count.

---

### JIM-02 — No structural integrity

**Status:** open · **Severity:** medium · **Carried from:** roadmap ⚠️ #2

Blast a wall's base and the roof floats. The gap between "voxels" and "Teardown". Roadmap Phase 1.2.

---

### JIM-04 — Den is an empty shell

**Status:** open · **Severity:** low · **Carried from:** roadmap ⚠️ #4

15 lore props researched in `docs/lore.md`, none placed. Roadmap Phase 3.

---

### JIM-05 — Heat tiers 4–5 unreachable

**Status:** open · **Severity:** medium · **Carried from:** roadmap ⚠️ #5

Police and the ARMY/tanks exist only in the gameplan, so the escalation payoff is missing. Roadmap Phase 2; blocked on ragdoll.

---

### JIM-06 — No audio at all

**Status:** open · **Severity:** medium · **Carried from:** roadmap ⚠️ #6

`moss-sfx` MCP is connected and unused. Cheapest large jump in perceived quality. Roadmap Phase 3.

---

### JIM-07 — Buildings are hollow shells

**Status:** open · **Severity:** medium · **Carried from:** roadmap ⚠️ #7

Windows and doors are decorative; blocks "enter houses". Roadmap Phase 4.

---

### JIM-08 — Pedestrians are sliding capsules

**Status:** open · **Severity:** medium · **Carried from:** roadmap ⚠️ #8

No ragdoll, no injury states; blocks the goat-sim comedy register. Roadmap Phase 2.

---

### JIM-09 — No deploy pipeline

**Status:** open · **Severity:** low · **Carried from:** roadmap ⚠️ #9

GitHub Pages workflow unwritten; `base: './'` is already set in `vite.config.js`. Roadmap Phase 6.

---

### JIM-13 — City reads as a commune

**Status:** open · **Severity:** medium · **Reported:** 2026-08-06 (Chris)

Identical craftsman houses in regular rows. Needs a real Seattle reference, a road hierarchy rather than a uniform grid, several building types, and randomised interior furnishings. Full breakdown in `docs/backlog.md` ("World variety") — logged here because it's a quality defect in what already ships, not only a future feature.

---

## Fixed

### JIM-26 — Roll pivot fed itself stale matrices and buried the belly

**Status:** fixed 2026-08-07 (milestone 10) · **Test:** `tests/rig.spec.js::roll tumbles about his middle, not his toes`

Same symptom as JIM-20, different cause, and only on the skinned path. `_pivot` must be the belly's height above his feet; on the skinned path the belly is a bone inside one mesh rather than a child of the body slot, so the old slot arithmetic resolved to his feet.

Reading the belly's real height via `worldToLocal` fixed that only once the matrices were refreshed first. The value **feeds** `group.position`, so a stale read is a feedback loop rather than a one-frame lag — traced mid-roll past π it diverged 0.21 → 2.21 → 0.39 and put the belly at `y -0.34`, under the road. `updateMatrixWorld(true)` before the read; the height then holds at 1.056 for the whole tumble.

### JIM-25 — A fat Jimothy's feet walked out past his nose and under the road

**Status:** fixed 2026-08-07 (milestone 10) · **Test:** `tests/rig.spec.js::the belly carries head, tail and legs outward as it grows`

Found by instrumenting, not by eye — it needed `widthScale` near the ceiling to be obvious, and nothing was reporting bone positions until this session.

Scaling `body` multiplies every direct child's local position by the same factor. The counter-scale from `4a5cd67` fixed each child's *size* and nothing undid the drag on its *position*. At `widthScale` 1.70 the front feet reached `z 1.25` with the nose at `1.04`, and sat at `y -0.20` — under the road.

For the head the drag is correct: it rides forward on a bigger animal. `JimothyRig.splayLeg` now lets the legs ride only along the body bone's lateral axis (the bow-legged waddle) and returns the spine and drop axes to rest. The axis identification is in the milestone. `tail` needs no fix — its bind position is the body bone's own origin.

### JIM-14 — Roll spun sideways instead of tumbling forward

**Status:** fixed 2026-08-06 (milestone 08) · **Test:** `tests/rig.spec.js::roll tumbles forward, not sideways`

`group.rotation.x` drove the tumble while `rotation.y` held the yaw, but the group used three.js's default `'XYZ'` Euler order, which applies x in the *parent* frame — so he tumbled about the world axis at every heading. Set `rotation.order = 'YXZ'`. The headbutt's body lean had the same bug and was fixed by the same line.

### JIM-15 — Head, tail and legs drifted off the body as he fattened

**Status:** fixed 2026-08-06 (milestone 08); **made impossible** 2026-08-07 (milestone 10) · **Test:** `tests/rig.spec.js::the belly carries head, tail and legs outward as it grows`

The belly scales about its slot's origin; the anchors were scaled about the *group* origin (`base * fatWidth`), i.e. about his feet. Different pivots, so the surfaces diverged as he grew. Anchors now scale about `bodyBase`. Note this defect **cannot reproduce under `__SKIP_RIG__`** — see the note in `docs/STATE.md`. Residual baseline separation is JIM-11.

The skinned rig retires the whole class: detached pieces cannot drift off a body they are part of, so the anchoring code was deleted rather than ported. The spec that guarded it was restated around what a continuous mesh actually promises, and found JIM-25 while being restated.

### JIM-16 — Headbutt and roll ploughed the terrain

**Status:** fixed 2026-08-06 (milestone 08) · **Tests:** `tests/voxel.spec.js::headbutt spares the ground`, `::roll scrapes instead of trenching`

`damageSphere` gained a `minVoxelY` floor. Terrain is voxel y < 0 and structures start at 0, so passing 0 means "smash the house, spare the road". Both moves set `DIGS_TERRAIN: false`; deliberate digging returns with the aimable headbutt.

### JIM-17 — Roll carved like a tunnel-boring machine

**Status:** fixed 2026-08-06 (milestone 08) · **Test:** `tests/voxel.spec.js::roll removes far less than a headbutt`

Recorded the design split in `MOVES`: headbutt is the demolition tool (100 % of the fatness blast bonus), roll is the mobility tool (30 %, and `RADIUS_SCALE` 0.8 → 0.55).
