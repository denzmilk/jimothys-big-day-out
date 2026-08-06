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

### JIM-14 — Roll spun sideways instead of tumbling forward

**Status:** fixed 2026-08-06 (milestone 08) · **Test:** `tests/rig.spec.js::roll tumbles forward, not sideways`

`group.rotation.x` drove the tumble while `rotation.y` held the yaw, but the group used three.js's default `'XYZ'` Euler order, which applies x in the *parent* frame — so he tumbled about the world axis at every heading. Set `rotation.order = 'YXZ'`. The headbutt's body lean had the same bug and was fixed by the same line.

### JIM-15 — Head, tail and legs drifted off the body as he fattened

**Status:** fixed 2026-08-06 (milestone 08) · **Test:** `tests/rig.spec.js::parts stay attached as he fattens`

The belly scales about its slot's origin; the anchors were scaled about the *group* origin (`base * fatWidth`), i.e. about his feet. Different pivots, so the surfaces diverged as he grew. Anchors now scale about `bodyBase`. Note this defect **cannot reproduce under `__SKIP_RIG__`** — see the note in `docs/STATE.md`. Residual baseline separation is JIM-11.

### JIM-16 — Headbutt and roll ploughed the terrain

**Status:** fixed 2026-08-06 (milestone 08) · **Tests:** `tests/voxel.spec.js::headbutt spares the ground`, `::roll scrapes instead of trenching`

`damageSphere` gained a `minVoxelY` floor. Terrain is voxel y < 0 and structures start at 0, so passing 0 means "smash the house, spare the road". Both moves set `DIGS_TERRAIN: false`; deliberate digging returns with the aimable headbutt.

### JIM-17 — Roll carved like a tunnel-boring machine

**Status:** fixed 2026-08-06 (milestone 08) · **Test:** `tests/voxel.spec.js::roll removes far less than a headbutt`

Recorded the design split in `MOVES`: headbutt is the demolition tool (100 % of the fatness blast bonus), roll is the mobility tool (30 %, and `RADIUS_SCALE` 0.8 → 0.55).
