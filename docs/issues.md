# Issue register — Jimothy's Big Day Out

> The project's tracked defect and blocker list. `docs/backlog.md` holds *deferred ideas*; this file holds *things that are wrong*. Every issue has an ID, a status, evidence, and where it lives in the code.
>
> Issue IDs are stable and never reused. `docs/roadmap.md` references them by ID.
>
> **Status values:** `open` · `in-progress` · `fixed` (with the session that fixed it) · `wontfix` (with a reason) · `cannot-reproduce`
>
> ⚠️ **Not yet mirrored to GitHub.** The repo has a remote (`denzmilk/jimothys-big-day-out`) but the `gh` CLI on this machine is an x86 binary and won't run on Apple Silicon (`bad CPU type in executable`). Fix `gh` (`brew install gh`) and these can be filed as real GitHub issues; until then this file is the register.

## Current interior and food reports — 2026-10-02

### JIM-66 — Food models do not resemble their pickup names
**Status:** implemented, awaiting playtest · Milestone 37. `TrashCans` previously rendered spheres/discs and selected the name only when eaten. Sixteen prepared food models now retain matching identities, use actual floor support and preserve the existing economy. Asset, pickup, restart, build and rendered smoke checks pass; native lineup/spill inspected. Pushed as `8362b9e`.

### JIM-67 — Buildings are empty shells with no residents
**Status:** implemented, awaiting playtest · Milestone 38 / ADR-0006. `VoxelCity` previously had one floor and no furnished rooms; outdoor pedestrians excluded building footprints. Seeded rooms/floors/stairs now share a plan with bounded indoor furniture and MPFB residents. Furniture breaks and joins rolling collection; people use floor-aware grounding, connected routes and shared ragdolls. Door entry, stairs, hallway passing, streaming, destruction, reset and unchanged draw-budget checks pass. See milestone 38 for final native timing, visual evidence and limits.


## Open

### JIM-72 — Water reactions ignore body size and submerged contact

**Status:** implemented, awaiting Chris’s playtest · **Reported:** 2026-10-03 (Chris) · Milestone 31 refinement.

Jimothy uses one fixed point ripple and 12 identical droplets at all sizes. Dynamic props report speed without footprint or entry state, so a bin and car splash alike and fully submerged motion can disturb the surface. The 48 m ripple window is narrower than Absurd Jimothy. Add size/speed-sensitive entry splashes, spreading surface ripples/foam and movement wakes for Jimothy and all dynamic body families, with bounded buffers and clean restart. Locations: `WaterSystem`, `WaterField`, `PhysicsSystem`, `WATER` tuning.

**Repair:** adaptive spacing keeps the wave grid at 64×64 cells while covering giant footprints. Entry speed/size drive displaced water, bounded foam rings and variable spray; moving bodies leave trailing wakes. Dynamic physics reports rotated support extents and latched contact, preventing underwater and repeated self-triggered splashes. All 58 unit checks, 31 adjacent gameplay cases and 11 final water cases pass, plus build/rendered smoke. Loaded native size and car-entry captures are console-clean. See STATE and milestone 31 for evidence; visual feel awaits Chris.

### JIM-69 — Giant form loses Jimothy's original model and visible jiggle

**Status:** implemented, awaiting Chris’s playtest · **Reported:** 2026-10-03 (Chris) · Milestone 23 refinement.

The spherical GiantCoat hides the original torso; fixed-size extremities disappear at Block/Absurd size. The wobble only scales the hidden placeholder. Retain the original continuous mesh, photographic markings and readable head/paws/tail at every size, with a round swollen body and visible jiggle during sustained rolling. This supersedes the old exact-sphere/fixed-extremity giant treatment. Locations: `JimothyRig`, `JimothyController`, `build_jimothy_growth.py`.

**Repair:** the original textured mesh now supplies the whole surface; proportional anatomy growth preserves readable features, and bounded root squash supplies jiggle. Attachments follow posed triangle coordinates, and IK handles minimum folded-leg/sole reach. The identity/jiggle regressions first failed; 25 model/footing/arrival checks pass across final runs, including the unchanged skin-contact checks. Build/rendered smoke and native size/roll views are clean. See the current STATE entry for evidence and the intermediate failures.

### JIM-70 — Giant rolls do not carve continuous ground channels

**Status:** implemented, awaiting Chris’s playtest · **Reported:** 2026-10-03 (Chris) · Milestone 33 refinement.

Roll damage intentionally excludes implicit terrain and repeats separate spheres. Revise giant rolling to carve a continuous, shallow swept channel with bounded work, persistent ground/collision edits and clean reset. Lean rolling remains a light scrape. This explicitly supersedes the giant ground-protection part of JIM-16/JIM-61. Locations: `Game.onImpact`, `VoxelWorld`, `Constants`.

**Repair:** shallow swept segments carve tapered banks and an actual persistent floor, with the original grade limiting repeat passes. The bounded shared queue preserves travel added at yield boundaries and alternates ground/structure work. Five channel unit checks and 25 unique relevant gameplay cases pass; build/pixel smoke and native views are clean. Block's sampled channel is 1.36–1.66 m deep. Native 100 m Block/Absurd rolls carry 64 objects; median CPU/render submission is 18.4/20.9 ms, with remaining heavy-destruction hitches documented in milestone 33. JIM-48 remains open.

### JIM-71 — Giant headbutts ignore upward aim against military aircraft

**Status:** implemented, awaiting Chris’s playtest · **Reported:** 2026-10-03 (Chris) · Milestone 34 refinement.

Giant headbutt centres offset only x/z, discarding the aim direction's y component; military units only receive a nearby sphere impact. Verify and repair upward aimed reach against low attack passes and ground army units while keeping net-only endings and existing lean controls. Locations: `Game.onImpact`, aiming/reticle, `Military`. Native verification also exposed the extended upward orbit placing the eye 9.34 m beneath terrain; a loaded-model camera regression now guards above-ground clearance and aircraft framing.

**Repair:** the damage sphere follows all three aim axes, with shared reticle reach, a grounded upward lunge and roll interruption/resumption. Jets descend near the target and climb out; the sky camera stays elevated. Eight targeted attack/camera cases pass, including a moving jet interception. Across final runs, 63 unique gameplay checks and all 54 unit checks pass, plus build/pixel smoke. The older treasure fixture was corrected after tracing its heat change to a tank shell; the actual pickup still changes no score, fatness or heat. Loaded Block/Absurd native captures are error-free. Evidence and remaining performance limits are in STATE.

### JIM-68 — Lean Jimothy charges through people and cars without resistance

**Status:** implemented, awaiting Chris's playtest · **Reported:** 2026-10-03 (Chris)

At zero fatness, scurrying/rolling through a person or car should cost momentum; cars should hold their position, and deliberate lean headbutts should give modest human knockdowns. Before the repair, `StreetLife.update/loosen` assigned the same velocity to a car and a small prop above 1.3 m/s, independent of mass. Kinematic player movement had no standing-human/car contact resolution, and `HumanRagdolls` gave every roll full launch speed. Repair the controlled contact path, mass-dependent shove/collection eligibility and lean knockdown strength while preserving giant rolling, glass, destruction and recovery. Relevant code: `JimothyController`, `PhysicsSystem`, `StreetLife`, `HumanRagdolls`, `RollCollector`, `Constants`.

**Repair:** swept standing-person/car contact clips inward controlled motion before physics, preserves sideways/escape movement and ends a blocked charge. Effective player mass grows with fatness; intact 1,100 kg cars resist weak shoves and collection. Cars have lower lift/spin, lean headbutts give reduced human launch with recoil, and lean rolls leave standing people upright. No new physics bodies. The four original resistance reproductions and a separate lunge-recoil reproduction failed before their fixes (`contact-weight-red.log`, `contact-headbutt-red.log`). Six weight checks now pass, including grown knockdowns and giant car collection. The 35-case regression passed 34; its older lean-roll knockdown expectation was superseded by Chris's requested size progression, documented in milestone 29, and the fixture now uses fatness 8 with unchanged recovery/capacity assertions. All seven final ragdoll/glass checks pass, giving 39 unique passing behaviour checks across these runs; three final keyboard/gamepad/bin checks also pass (42 total). All 49 unit checks, build and production pixel smoke pass without console errors. Native full-rig car/person captures show stopped lean contact; the car remains fixed with 0.035 m collider clearance. Evidence under `output/iterate/contact-weight-*`; visible feel remains unapproved.

### JIM-65 — Stone structures show a narrow gap above smoothed ground

**Status:** implemented, awaiting playtest · **Found:** 2026-10-02 during underwater visual review

A rigid wall's lowest side face was culled against an adjacent terrain voxel even when that neighbour's rendered surface had been lowered inside the cell. This exposed a thin blue strip at the feet of underwater pillars. `tests/structure-ground-contact.test.mjs` reproduces the missing face with a horizontal ray between the actual ground and the voxel ceiling (`structure-ground-red.log`). The mesher now retains only that exposed strip; normal buried faces remain hidden. All 39 unit checks and 17 terrain/physics/beach cases pass, along with build and production rendered smoke. The native temple capture now shows closed bases and no errors (`structure-ground-native.log`, `ocean-temple.png`). These checks include the in-progress underwater feature.

### JIM-64 — First explosion recompiles the lit world and freezes a frame

**Status:** implemented, awaiting playtest · **Found:** 2026-10-02 during native military profiling

The explosion flash toggled a PointLight's visibility. That changes the shader light-count defines for every lit material, causing a 4,432.9 ms frame despite a 34.7 ms maximum simulation update. The light now remains registered with zero intensity between flashes. A failing light-layout regression now passes. In the same native 12-second Block battle, worst frame becomes 50.2 ms, p95 18.9 ms, median 16.2 ms; two shots/impacts and one launch occur, then restart returns to zero military objects and kinematic control. No errors. Evidence: `military-native.log`, `military-native-stable-lights.log`, `explosion-light-red.log`, `explosion-light-green.log`; build/rendered smoke pass in `explosion-light-build.log`/`explosion-light-smoke.log`. These checks include the in-progress military feature.

### JIM-63 — Size slider drops physical feet into the ground

**Status:** implemented, awaiting playtest · **Found:** 2026-10-02 during military inspection

Jumping from lean to Block size left the collision centre unchanged and dropped the feet from y=42.044 to y=24.201, activating underground lighting. The size event now raises/lowers the centre by the radius change, preserving feet. The test hook uses that same event instead of writing fatness directly. The actual DevTools number input passes lean → Block → Absurd → lean without moving the feet or entering the underground (`dev-growth-red.log`, `dev-growth-green.log`). Build/rendered smoke pass (`military-build.log`, `military-smoke.log`); these ran with the in-progress military work present.


### JIM-62 — Chunk-boundary damage leaves the adjoining face missing

**Status:** implemented, awaiting world playtest · **Found:** 2026-10-02 while testing staged meshing

Removing a voxel exactly across a chunk seam only dirtied the removed cell's chunk. Its neighbour kept the old hidden face (30 vertices instead of the required 36 for an exposed cube). `tests/voxel-work.test.mjs` reproduces this; `output/iterate/voxel-seam-red.log` records the failure. Boundary edits now invalidate both sides. Six focused voxel checks and 29 adjacent world checks pass, along with build/rendered smoke (`voxel-work-green.log`, `staged-world-green.log`).

### JIM-61 — Giant attacks pass above buildings

**Status:** implemented, awaiting Chris's playtest · **Reported:** 2026-10-02 (Chris)

Flat headbutts at the same wall remove 56 voxels at fatness 0, 538 at 90, and zero at 250/400. All four ordinary E presses fire. At Block size the blast centre is y=55.92 with radius 5.75 over ground y=39.56; the collision body grows upward while blast radius saturates. Roll damage is only a 1.24 m sphere at this size. There is no giant surface-contact demolition path. Fix impact/contact geometry with bounded voxel work; simply enlarging the existing cubic loop would worsen JIM-48. Locations: `JimothyController._updateMoves`, `Game.blastRadius/impactPoint/blastAt`, `VoxelWorld.damageSphere`. Evidence: `output/iterate/giant-headbutt-audit.log`; [audit](giant-audit-2026-10-02.md). Proposed responsive-destruction work is in the backlog; no fix is claimed.

**Repair, 2026-10-02:** giant surface contact uses the physical sphere; headbutts reach farther than rolling. A sparse above-ground occupancy index skips implicit terrain and empty rooms. Work yields at a fixed candidate count/time budget; repeated roll contacts coalesce and restart cancels pending work. The reproduced E failure (zero cells) now removes 22,375 cells at Block size in the native loaded scene, preserving terrain and producing debris/glass with no errors. Three giant and four glazing regressions pass, plus nine voxel-work checks. The 18 adjacent aiming/ordinary-destruction cases passed before the sparse-index refinement. Build/rendered smoke and before/after native captures pass. Evidence: `giant-impact-red.log`, `giant-index-green.log`, `giant-impact-native.log`, `giant-impact-before.png`, `giant-impact-after.png`. Rendering remains JIM-48.

### JIM-60 — Held rolling stops tumbling after 0.9 seconds

**Status:** implemented, awaiting Chris's playtest · **Found:** 2026-10-02 while reproducing Chris's giant/collection report

Given a loaded rig and C held for 1.5 seconds, movement continues but `rollSpin` reaches 2π at 0.9 seconds and stays there. The animation clamps normalized move time to 1; extending the move to held traversal did not extend the tumble. This also stops collected objects revolving with Jimothy. Preserve the lean flop while making giant rotation follow travel continuously. Location: `JimothyController.postUpdate`. Evidence: `output/iterate/giant-audit.log`; [audit](giant-audit-2026-10-02.md). Milestone 23 is reopened.


**Repair, 2026-10-02:** Blender radial growth and a smooth coat keep the giant torso spherical while preserving original head/tail/paw dimensions. Held roll spin follows distance; attachments meet the grown surface. Twenty loaded-rig/footing checks and three final giant checks pass, alongside the 27-case adjacent run. See the latest STATE entry and `output/iterate/giant-street-carry.png`. Performance/destruction remain JIM-48/JIM-61.

### JIM-59 — Shoreline reads as a hard edge instead of a beach

**Status:** implemented, awaiting Chris's playtest · **Reported:** 2026-10-02 (Chris)

Milestone 35 adds five beach regions, blended dry/wet sand, gentler outer shallows and modest dunes. Nearby feet, rolls and impacts compact sand; the visible field and physical support agree, tracks persist through travel, and full digging removes the skin. Dune grass is sparse and the wet band stays clear. Four sand/contact unit checks, fifteen beach/water/terrain cases and three final beach/grounding cases pass. Native captures, build and rendered smoke pass; see `output/iterate/beach-*` and milestone 35. Chris still needs to judge the shore and sand feel.

### JIM-58 — Short pedestrians overreach while running uphill

**Status:** implemented, awaiting Chris's playtest · **Found:** 2026-10-02, pedestrian variety pass

Testing all twelve physiques at 30/60/120 Hz exposes the fixed 1.6 m running stride's assumption about leg length. The new pensioner's 0.692 m legs show 0.132 m p95 planted-sole error on an uphill run at 120 Hz, above the existing 0.12 m limit; their walk and ragdoll contracts pass. Evidence: `output/iterate/pedestrian-variety-all-rates.log`. `FootGrounding` now caps stride using measured leg length and `GROUNDING.STRIDE_LEG_RATIO`; hip/foot speed limits and contact-error assertions are unchanged. The failing automated reproduction is in `pedestrian-stride-red.log`. All twelve people pass at 30/60/120 Hz after the correction; the pensioner's 120 Hz p95 error falls to 0.0338 m (maximum 0.0498 m). All 36 slope/model cases pass too. Final checks: 3 walking and 23 adjacent tests pass (`pedestrian-stride-green.log`, `pedestrian-variety-adjacent.log`), along with build and rendered production smoke.

### JIM-57 — SUV spare tyre floats behind the body

**Status:** implemented, awaiting Chris's playtest · **Reported:** 2026-10-02 (Chris)

The Kenney SUV parents its spare tyre to the body. `tools/prepare_vehicles.py` scaled every mesh locally, so the spare inherited another 1.6× conversion from its parent. Its diameter and mounting offset grew while the road wheels stayed correctly sized. The new regression compares the spare's dimensions and mounting position with the preserved original model, checks slope/heading poses, and requires five breakaway wheels. The baseline fails with a 0.881 m size-vector error (`output/iterate/spare-red.log`). The exporter now flattens original world transforms before the metre conversion. The corrected spare matches the original within one micrometre, has zero local mounting drift across 12 slope/heading poses and remains the fifth breakaway wheel. All nine spare/heading/grounding/destruction checks pass (`spare-green.log`), as do build and rendered production smoke. Inspected runtime capture: `output/iterate/spare-mounted.png`; console errors: none.

### JIM-56 — Shadows and the day–night cycle are not apparent in play

**Status:** implemented, awaiting Chris's playtest · **Reported:** 2026-10-02 (Chris)

Chris reports missing shadows and day/night. A fresh production preview advanced automatically from 17.22 to 18.6879, changed sky and enabled streetlights. Night shadows were absent because only the sun had a shadow map. Trash bins and voxel rubble also lacked shadow participation; rebuilt car fragments dropped the original mesh flags. The Dev time slider stayed at its initial value, and normal play had no clock readout.

`DayNight` now uses the sun or moon above the horizon as the sole active celestial shadow caster. Both reuse their maps; resolution is 2,048² over the existing local area, with the existing five updates per second. Underground disables celestial shadows. Bins/rubble cast and receive shadows, and detached car panels preserve their source flags. The HUD shows time and Dawn/Day/Dusk/Night; `world:time-changed` updates it and the Dev slider once per game minute. Dragging retains control until the slider loses focus. The automatic cycle remains 12 minutes.

Evidence: baseline midnight comparison changed zero shadow pixels (`output/iterate/lighting-red.log`). Final rendered comparisons change 48,415 ground pixels by day and 23,452 at midnight; the bin contributes 2,309 pixels in direct sunlight. A complete clock cycle checks 48 samples, six sky colours, UI synchronisation, midnight wrap and restart. The final scoped run passes 22/23 (`lighting-final-regression.log`); its bin fixture was under an existing building shadow. Placing it on a sunlit road makes the remaining check pass with the same pixel threshold (`lighting-bins-final.log`), without further runtime changes. Traffic, water, environment and car-destruction checks pass after restarting the dev server to clear stale event-module imports. Build and rendered production smoke pass with no console errors. Inspected normal-play captures: `lighting-play-dawn.png`, `lighting-play-day.png`, `lighting-play-dusk.png`, `lighting-play-night.png`; the actual time control was checked in `lighting-night-controls.png`. The rendering budget remains tracked by JIM-48; visual/feel approval is still open.

### JIM-55 — Downhill turns leave a pedestrian's support foot out of reach

**Status:** implemented, awaiting Chris's playtest · **Found:** 2026-10-02 during milestone 32 regression

The changed street obstacle layout exposes a long recovery step after a downhill turn. In `tests/walking-ik.spec.js`, neighbour `ped-19` near (-3, 22.05, 41.98) leaves a foot anchored more than a metre behind a leg with 0.747 m reach. Maximum planted-sole error is 0.197 m, above the existing 0.15 m limit; hip/frame and foot/frame displacement remain within their limits. Evidence: `output/iterate/traffic-full-suite.log`, `traffic-ik-probe.log`. Location: `FootGrounding.update`. When a turn leaves both feet behind, the grounder now takes a short catch-up step before returning to its normal stride. Foot speed and hip smoothing stay bounded; no assertion limit changed. All three walking checks pass, with maximum planted error reduced to 0.114 m and p95 to 0.0315 m. All 31 adjacent grounding, character, pursuit, ragdoll and traffic checks pass (`traffic-ik-recovery.log`, `traffic-ik-adjacent.log`). Build and rendered smoke pass without console errors. The captured support foot stays 0.018 m above the rendered pavement; raycast surface heights agree with the grounding query within two micrometres (`traffic-ik-skin-probe.log`, `traffic-ik-recovery-313.png`, `traffic-ik-recovery-339.png`). Walking feel still needs Chris's playtest.

### JIM-54 — Some cars drive backwards

**Status:** implemented, awaiting Chris's playtest · **Reported:** 2026-10-02 (Chris)

Chris observes cars travelling backwards. All six preserved Blender exports have their front axle along -Z, while `StreetLife` drives along +Z. The template now normalizes every imported mesh by `STREET.CAR.MODEL_YAW` before centring, preserving glass, wheels and breakaway geometry. The baseline front/rear axle difference was -2.112 m for the sedan; the regression measures the actual front/rear wheels against travel direction. Eight orientation/grounding/destruction checks pass (`output/iterate/traffic-heading-green.log`), build and rendered smoke pass with no console errors, and all six corrected models were inspected in `traffic-car-directions.png`. Milestone 32 now implements curved junction turns, controlled traffic and regular streetlights.

### JIM-53 — Jimothy does not participate in the new world shadows

**Status:** fixed in code, awaiting Chris’s playtest — 2026-10-02 · **Found:** 2026-10-02

The environment and human models cast/receive the new daylight shadows, but the loaded Jimothy mesh retained both flags as false. This left the main character without a ground shadow or building shade. Live production inspection: `output/iterate/jimothy-shadow-before.log` (`Mesh_0`, casts false, receives false). `JimothyController` now enables both flags when the rig loads.

Verification after the full-suite run: production build and rendered smoke pass with no console errors. The same-frame shadow comparison changes 5,684 ground pixels outside the player bounds; both mesh flags are true (`output/iterate/jimothy-shadow-after.log`). Inspected `jimothy-shadow-on.png` confirms the ground shadow. This small follow-up was checked separately from the 170/175 regression run.

### JIM-52 — Restart carries an unfinished attack into the next run

**Status:** fixed in code, awaiting Chris’s playtest — 2026-10-02 · **Reported:** 2026-10-02 (agent live check)

After a short C-key roll, restart resets position and velocity but leaves `JimothyController.move` alive. The new run immediately continues rolling: a capture-camera setup moved from z=25 to z=22.125 before any new input. Repro: `output/iterate/ragdoll-roll-check.log`, `net-capture.log`; location: `JimothyController.reset`. `reset()` now clears the active attack and its cooldown. The failing regression reproduced the retained roll; the corrected test passes and confirms no movement after restart (`restart-move-red.log`, `restart-move-green.log`).

### JIM-51 — Streets blend into the hills without physical footpaths

**Status:** implemented, awaiting Chris's playtest · **Reported:** 2026-10-02 (Chris) · **Milestone:** 28

Chris requested separate footpath blocks with a 3D appearance and less merging of all ground into rolling hills. Reserved 2 m strips now keep building lots off the pavement. Slabs have recessed joints and raised kerbs; short street grades keep level cross-sections, blend into neighbouring plots, and join district grids without cliffs. People use the paved routes. Paving remains voxel terrain with physical debris and persistent damage. The coarse island backdrop is masked over loaded geometry so it cannot cover lowered roads or craters. Locations: `CityPlanner`, `StreetPaving`, `Layout`, `VoxelWorld`, `LevelBuilder`, `Pedestrians`.

Evidence: all five checks in `tests/footpaths.spec.js` pass, covering plot exclusion, height/mesh contact, 776 district joins, tunnel wall preservation, physical debris, streaming/restart, backdrop coverage and people/traffic routing. Build and production rendered smoke pass. The full suite passed 156/164 before three corrections; the final affected rerun passed 65/68 with only existing feast and draw-call failures. Two existing rig failures also remain in the full suite (JIM-03, JIM-48, JIM-49). Captures: `output/iterate/footpaths-production-street.png`, `footpaths-production-slabs.png`, `footpaths-production-broken.png`. Chris's visual and walking sign-off remains open.

### JIM-50 — Pedestrians jump during foot-support changes on slopes

**Status:** implemented, awaiting playtest · **Reported:** 2026-10-02 (Chris) · **Milestone:** 27 grounding refinement

Chris reports walking jitter and people jumping on angles. Reproduced at spawn by sampling six seconds of pedestrian walking at 60 Hz: `ped-21` near `(6, 20.95, 44.70)` moves its hips upward 0.555 m in one frame while the ground rises only 0.012 m. A planted foot trails too far behind; the unsmoothed pelvis correction disappears at the half-cycle support switch. Evidence: `output/iterate/ik-jitter-baseline.log`. Scope: continuous foot transfer, bounded pelvis movement, slope contact, animation/idle/release transitions. Locations: `src/core/Grounding.js`, `Pedestrians`, shared pursuer grounding.

World-space planted contacts now transfer through bounded swing arcs; trailing-foot selection handles reversals, late landing targets lock, and pelvis/foot rotation respond smoothly. Civilian movement slows while turning toward a new route. The same street repro now measures a 0.050 m maximum hip displacement and 0.033 m planted-foot error at the 95th percentile. `tests/walking-ik.spec.js` covers real streets, all six models on three ramp directions, stop/start, walk/run and 30/60/120 Hz; production captures and smoke are in `output/iterate/ik-*`. Visual feel awaits Chris's sign-off.

### JIM-49 — Giant rig proportions and child scales disagree with the intended ball

**Status:** implemented, awaiting Chris's playtest · **Found:** 2026-10-02 during full regression verification

Both failures reproduce unchanged on isolated pre-shatter commit `723c993`: `rig.spec.js::fatness grows the belly and nothing else` reports a non-body bone scale of 0.858 versus a lean 0.849 (tolerance 0.005); `::the belly carries head, tail and legs outward as it grows` reports leg height 0.596 versus 0.647 (tolerance 0.05). Investigate posed bone measurements and growth correction before deciding whether these represent visible model drift or outdated invariant checks. No rig code or assertion tolerance was changed in the glass pass. Evidence: `output/iterate/glass-rig-baseline.log`, `glass-rig-offset-baseline.log`; code: `JimothyRig`, `JimothyController`, `tests/rig.spec.js`.

Chris's 2026-10-02 playtest confirms a visible shape failure. Actual posed mesh bounds at Block size are 33.14 × 15.03 × 50.10 m; the collector's proxy is 40.83 × 28.93 × 62.47 m. `bindAspect()` caches world-space proportions but growth applies them in body-bone axes (Y is the spine); uniform child correction remains inaccurate. The pivot also misses the large longitudinal offset. This requires a visible-body/contact repair, not wider test tolerances. See [the audit](giant-audit-2026-10-02.md), `output/iterate/giant-audit.log` and `giant-before-250.png`. JIM-24 and milestone 23 are reopened.


**Repair, 2026-10-02:** Blender radial growth and a smooth coat keep the giant torso spherical while preserving original head/tail/paw dimensions. Held roll spin follows distance; attachments meet the grown surface. Twenty loaded-rig/footing checks and three final giant checks pass, alongside the 27-case adjacent run. See the latest STATE entry and `output/iterate/giant-street-carry.png`. Performance/destruction remain JIM-48/JIM-61.

### JIM-48 — Populated world exceeds the legacy draw-call budget

**Status:** implemented, awaiting Chris’s playtest · **Found:** 2026-10-02 during milestone 27 glass verification

`tests/voxel.spec.js` has two assertions requiring fewer than 300 renderer calls. A clean isolated copy of pre-shatter commit `723c993` already reports 866 calls, 2,931,262 triangles and 195 voxel meshes at deterministic boot. Separate car panes report 900 calls with the same triangle and voxel mesh counts. The `voxels.drawCalls` field currently reports the whole renderer, including people and props. Evidence: `output/iterate/glass-baseline-comparison.log`, `glass-adjacent.log`. Review scene batching/LOD and the telemetry naming in a separate performance pass; do not raise the limit to conceal it. Locations: `Game.renderToText`, `Pedestrians`, `StreetLife`, `VoxelWorld`, `tests/voxel.spec.js`.

Milestones 30–31 add local sun shadows, vegetation/wildlife and water. The final production smoke records 1,510 whole-renderer calls after two simulated seconds (`output/iterate/water-smoke-final.log`), with 1,249 plants and nine animals. The draw-call budget remains unresolved; bounded populations and passing state tests are not an FPS sign-off.

Milestone 32's final production smoke records 1,720 whole-renderer calls with regular streetlights and signal poles (`output/iterate/traffic-final-smoke.log`). Its full-suite boot assertion reports 1,714 against the unchanged 300-call limit (`traffic-full-suite.log`). Traffic correctness checks pass, but the scene still needs the separate batching/LOD performance pass.

Chris reported poor frame rate on 2026-10-02 and requested draw-distance controls and less out-of-view work. The latest twelve-model production smoke reports 1,731 whole-renderer calls after two simulated seconds (`output/iterate/pedestrian-variety-smoke.log`). No native-GPU frame-time baseline has been recorded for this report. `EnvironmentLife` disables frustum culling on vegetation batches and particles; `StreetLife` does so for road markings, and `WaterSystem` for local water/splashes. These are investigation points, not a confirmed complete diagnosis. Proposed milestone 33 in `docs/backlog.md` prioritises measurements, per-pass culling/bounds, batching/LOD, quality controls and bounded simulation before more world content.

The giant audit adds a confirmed CPU bottleneck: synchronous `remeshDirty()` calls peak at 475 ms at Block and 1,938 ms at Absurd during 90 rolling updates. Total meshing time is 2.84 / 5.08 seconds respectively. The one-column streaming budget does not bound the expensive chunk rebuilds. Loaded rendering reports up to 3,831 calls after the largest roll. These are headless SwiftShader CPU/draw measurements, not native-GPU FPS; fixed-distance native profiling remains open. `output/iterate/giant-audit.log` and [the audit](giant-audit-2026-10-02.md) record methodology and limitations. Budget meshing/destruction before scaling impact volumes (JIM-61).


**Milestone 33 foundation, 2026-10-02:** generation/meshing now yield within chunks; existing geometry stays visible and damage persists during regeneration. The 240-frame native Block route's worst observed frame falls from 2,041.9 to 123.3 ms, with calls still around 1,617 median. The follow-up overlapped smoke, so final controlled profiling remains required. Rendering, distant work and giant demolition continue; this issue remains open. See the newest STATE entry.

**Rendering checkpoint, 2026-10-02:** compatible street/bush assemblies and voxel geometry are batched; intact ground is simplified within 2.5 cm error; every MPFB person is one skinned draw. The two unchanged <300 renderer-call regressions now pass, along with terrain/paving, crowd/ragdoll, traffic/streaming and car checks. Rendered smoke reports 287 calls with no errors. Native giant travel still has median 30.1 ms frames; CPU optimisation, presets, distant silhouettes and final profiling remain open. See STATE for evidence and limitations.

**Quality/rendering repair, 2026-10-02:** physical .22 m destruction remains intact; work is sliced, rigid props and voxel chunks are batched, and twelve MPFB models use one draw each. Graphics presets change distance/detail/shadows; 1,989 distant building silhouettes match the masterplan and preserve damage. The new quality/LOD checks and 20 adjacent checks pass, plus build/rendered smoke. Native 100 m lean/House/Block median frames are 14.2/14.6/19.3 ms; worst 97.1/77.7/112.1 ms. Occasional hitches remain, so no locked-60 claim. See STATE and `output/iterate/native-distance.log`; visual sign-off remains Chris’s.


### JIM-47 — Feet and wheels need contact with the visible ground

**Status:** implemented, awaiting playtest · **Reported:** 2026-10-02 (Chris) · **Milestone:** 27 refinement

Chris asked for real glass and correct ground IK. Root-height placement alone left some planted pedestrian feet 18–30 cm above sloping pavement. Vehicle bodies needed separate wheel contact and suspension, not only a centre-height sample. `src/core/Grounding.js` supplies terrain-aware two-bone leg IK, pelvis adjustment, foot normals and per-wheel support. Building and imported vehicle glazing use transmission; glass voxels still break. Tests: `tests/grounding.spec.js`.

### JIM-45 — World reads as oversized blocks and blank building shells

**Status:** implemented, awaiting playtest · **Reported:** 2026-10-02 (Chris) · **Milestone:** 25

Original report: voxel edge was 0.55 m. Houses near spawn measured 14–26 m wide with 7–13 m roof rises above only 2.75–4.95 m walls. Windows and doors are counted in voxels, so reducing resolution alone shrinks usable openings. Milestone 25 now uses 0.22 m cells, metre-scaled house details and greedy coplanar faces (JIM-34). See `src/level/VoxelCity.js`, `Layout.js`, `CityPlanner.js`, and `VOXEL` in Constants.

### JIM-46 — Island feels unpopulated

**Status:** implemented, awaiting playtest · **Reported:** 2026-10-02 (Chris) · **Milestones:** 26–27

Original audit: 26 people across the whole island, zero within 60 m of spawn. Pedestrians move without street/building/water checks and use capsule placeholders (JIM-08). No traffic system exists. Implemented six MPFB variants, 36 nearby civilians, MPFB pursuers, six Kenney CC0 vehicle models, moving/parked traffic and physical street furniture. Giant rolling collects and releases living people, food and props. See milestones 26–27 and their verification notes.

### JIM-44 — Bad food: something that gives Jimothy the runs and makes him skinnier

**Status:** open (feature) · **Severity:** medium (it is the first thing that can take fatness *away*) · **Reported:** Chris, 2026-08-09

> *"Can maybe add an issue for 'bad' food that gives Jimothy the runs and makes him skinnier."*

Raised while settling milestone 23's growth curve, and it is the natural counterweight to it: once eating grows him without limit, **nothing in the game currently subtracts.** Fatness is a monotonically rising number, so every food decision is "eat it" and there is no such thing as a bad grab.

Bad food makes the trash worth *reading*. It also cuts both ways at scale, which is what makes it interesting rather than merely annoying:

- **Shrinking is a punishment when you are hoarding** — you lose blast radius, and past milestone 23 you lose the roll's traversal speed with it.
- **…and a tool when you are trapped.** A Jimothy too fat for any bush (`HIDE_SQUEEZE` already guarantees that) has no pressure valve left. Deliberately eating something rotten to fit back into a hedge with animal control on him is a genuinely good decision to offer, and it gives the hide mechanic a second life at high fatness.

**Open questions, none of them decided:**

- **Is it obvious before you eat it?** A visible mouldy sheen makes it a choice; an identical-looking pizza makes it a hazard. The two produce very different games — the first is a resource decision, the second is slapstick.
- **Does it cost score, or only size?** Fatness is the headline number on the capture screen, so losing it is losing score. Losing *size* while keeping the score would be a purely mechanical shrink.
- **The runs.** Chris named the symptom, and it is clearly a comedy set-piece rather than just a stat change — a trail, a noise, probably a heat contribution, and the tone guardrail in `docs/gameplan.md` (cartoon slapstick, never gore) applies.
- **Interaction with JIM-30 (the eat button).** If eating becomes a deliberate press with an animation, spitting something out mid-chomp is a natural companion mechanic.

**Where:** `src/core/Constants.js` (`FOODS`), `src/gameplay/TrashCans.js` (what spills), `src/systems/ScoreSystem.js` (fat is added there, so it is where fat would come off).

**Depends on:** nothing hard. Cheapest *after* milestone 23, because the growth curve decides what "skinnier" is worth.

### JIM-42 — ⚠️ The physics floor is a plane at sea level, so everything dynamic falls through the island

**Status:** fixed 2026-08-08 (milestone 22) · **Tests:** `tests/physics.spec.js`, 6 specs · **Severity:** critical (every dynamic body in the game is affected) · **Found:** 2026-08-08, while investigating Chris's *"digging underground just felt like blocks disappearing"*

`PhysicsSystem` builds its entire static collision world in the constructor:

```js
const ground = new CANNON.Body({ type: STATIC, shape: new CANNON.Plane() });
ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
```

A horizontal plane **at y = 0**, plus four 2 m-tall perimeter walls at y = 2. That is the flat 250 m block the game was built on before milestone 17. The voxel world deliberately has no collision bodies at all (ADR-0003 — Jimothy is kinematic and collides by grid lookup), and **nothing ever replaced the plane when the island arrived.** `y = 0` now means the waterline.

So every dynamic body falls straight through the terrain and lands on an invisible plane at sea level, 35–75 m below the ground you can see.

**Trash cans**, measured at spawn and then over 8 s (height relative to the terrain surface under them):

| t | median | worst | asleep |
|---|---|---|---|
| 0 s | −0.10 m | −0.30 m | 0 / 30 |
| 1 s | −7.99 m | −8.19 m | 0 / 30 |
| 2 s | −22.39 m | −22.64 m | 5 / 30 |
| 4 s | −26.14 m | −46.05 m | 25 / 30 |
| 8 s | −26.14 m | −46.05 m | **30 / 30** |

They spawn in exactly the right place — `_spawnCan` was fixed for hills in milestone 17 — and then sink out of the world and go to sleep at the waterline.

**Blast debris**, the thing Chris actually noticed. On the surface it sprays from y ≈ 41.8 and is at **9.3 m and still falling** two seconds later; in a sewer it is already at **0.3 m** by the first sample. It never lands on anything. You headbutt, fourteen chunks puff out, and they sink through the floor — which underground, with no skyline to give the fall away, reads exactly as *"blocks disappearing"*.

**Why the game still seemed to work.** Jimothy is kinematic and hand-clamped against the grid, so he was never affected. Cans are streamed in around the player, so the ones you walk up to spawned seconds ago and have not sunk far yet — the bug hides behind its own streaming. It is *most* visible underground, where debris has nine metres of open tunnel to fall out of before it clears the floor.

**Fixed** by clamping dynamic bodies against the grid after each physics substep (`PhysicsSystem._groundBodies`). Everything now settles at exactly half a voxel above its floor within ~2 s, above ground and in a sewer, for 0.11 ms per step across 190 bodies. **Four ratchet-shaped bugs and two adjacent ones came out of it — see `docs/milestones/22-things-land-on-the-ground.md`, they are the useful part.**

**Fix direction was:** dynamic bodies need the same treatment Jimothy has — a per-step ground clamp against `voxels.groundHeightAt`, not real chunk collision bodies (ADR-0003 exists because a body per chunk is what made voxel destruction unaffordable). ~180 bodies at the cap, one height query each, and the same query already runs for every pedestrian every frame. The perimeter walls at y = 2 want the same look: they are the old block's edge, and the island's coast is not a square.

**Fourteenth member of the family in `docs/STATE.md`** — and the largest. `CANNON.Plane()` at the origin meant "grade" and now means "the waterline", which is the exact sentence written about `damageSphere(minVoxelY: 0)` a session ago.

### JIM-43 — Dug surfaces render as hard cubes; only undisturbed ground is smoothed

**Status:** open · **Severity:** medium (cosmetic, but it is most of what you look at underground) · **Reported:** Chris, 2026-08-08 — *"there was no smoothing still on the cubes."*

Working as currently designed, and the design is what he is objecting to. `VoxelWorld._buildChunk` smooths by displacing the top face of an **undisturbed terrain voxel** onto the continuous height field. The rule is documented as *"smooth is what you found, voxel is what you did to it"*, and it has two hard limits:

1. **Top faces only.** A vertical face is never displaced, so a wall of rock is always a grid of squares however it was made.
2. **Undisturbed only.** A crater floor is not the terrain's top voxel any more, so it drops out of the rule entirely.

Underground, *everything* you can see fails both tests — tunnel walls, a dug shaft, a side passage — so the smoothing that makes the hills work is switched off exactly where Chris was looking.

The height-field trick cannot be extended to cover it: it works because the surface is a **function of (x, z)**, and a tunnel is not — a column underground has a floor *and* a ceiling. Smoothing arbitrary voxel topology is a different algorithm (marching cubes, or surface nets / dual contouring on the same grid), which replaces the face-culled quad mesher rather than extending it.

**Wants its own milestone**, and it interacts with three things already on the register:
- **JIM-34 (no greedy meshing)** — surface nets would replace that mesher, so doing greedy meshing first would be wasted work. These two must be decided together.
- The **debris colours and materials** come off per-voxel material ids, which a smoothed surface still has to carry.
- Whether the *city* should stay hard-edged. Buildings are voxels too, and a smoothed skyscraper would be wrong — so the mesher needs to know which materials smooth and which do not.

### JIM-38 — The headbutt's horizontal aim is his facing, never the camera's

**Status:** fixed 2026-08-08 (milestone 21) · **Test:** `tests/aim.spec.js::looking left and right moves the aim`, `::the headbutt lands where you looked` · **Severity:** high (the aimable headbutt only aims on one axis) · **Reported:** Chris, 2026-08-08 — *"the headbutt 'aim' doesn't really line up with anything."*

Milestone 20 made the aim `CameraSystem.aimPitch` and stopped there. The *yaw* was never wired: `JimothyController._updateMoves` builds its forward vector from `this.yaw`, and `Game.updateReticle` does the same. `this.yaw` only tracks the camera indirectly, and only **while he is walking** — `postUpdate` gates it on `moving = this.speed > 0.3`.

So standing still with the pointer locked, looking left does nothing at all. Measured at spawn after swinging the camera 90°:

| | value |
|---|---|
| `cameraSystem.yaw` | 4.712 |
| `jimothy.yaw` | 3.142 |
| reticle bearing | **followed Jimothy** |

Half the aim is missing, which is most of why it "doesn't line up". **Decision (Chris, 2026-08-08): snap on the swing** — the reticle tracks the camera continuously, and his body whips round to face it at the moment the lunge starts. The walk-around facing feel is untouched.

### JIM-39 — The reticle floats in mid-air; it never touches what you point at

**Status:** fixed 2026-08-08 (milestone 21) · **Test:** `tests/aim.spec.js::the reticle lands ON the wall you point at`, `::the reticle marks a miss` · **Severity:** high (the reticle is the whole aiming UI) · **Reported:** Chris, 2026-08-08 — *"we need the reticle to dynamically move to highlight any item/surface it's on — currently it just changes for the ground but not really in front of you."*

`Game.impactPoint` is a pure projection: `from + dir * dist`, where `dist` is the blast standoff. **It never asks the world what is there.** The reticle is parked at that point, so it hangs in the air at a fixed range whatever you are pointing at.

It appears to work when you aim *down* only because the projection happens to end up near the ground — which is exactly the "it just changes for the ground" symptom. The mesh compounds it: the torus is pinned to `rotation.x = -Math.PI / 2`, so it lies flat regardless of what it is on, and reads as a floating ring rather than a decal on a wall.

Measured at spawn: reticle at `(0, 42.27, -2.31)`, `solidAtWorld` at that point `true` — buried inside geometry, not resting on it.

Fix is a DDA march along the aim (`VoxelWorld.hasLineOfSight` already has the traversal; it needs a sibling that returns the hit and its face normal), plus a `THREE.Raycaster` pass over the container meshes so a bin highlights too. Trees and buildings are voxels, so the march covers them.

### JIM-40 — Underground, a flat headbutt removes nothing: you can only go deeper

**Status:** fixed 2026-08-08 (milestone 21) · **Test:** `tests/underground.spec.js::a flat headbutt digs sideways underground` · **Severity:** high (the underground is unnavigable by digging) · **Reported:** Chris, 2026-08-08 — *"you can't dig in a direction once a hole is made, all you can do is go deeper."*

Two gates compose into a dead end:

1. `Game.digsTerrain` returns `aim >= DIG_ANGLE` — a swing that is not pointed steeply down is not allowed to touch terrain.
2. `VoxelWorld.damageSphere` with `digsTerrain: false` sets the removal floor to that column's `topSolidVoxelY`, then loops `y` from `floor + 1` upward.

Underground every voxel around you is below that floor, so the loop body never runs. Measured standing in a sewer 8.96 m below grade, from the same spot:

| swing | voxels removed |
|---|---|
| flat (aim 0) | **0** |
| aimed down (aim 0.9) | 11 |

The `DIG_ANGLE` gate is right on the surface — it is what keeps a flat swing from cratering the street (playtest 2026-07-23, and `aim.spec.js` guards it). It is simply wrong once he is under the street: there is no road to protect down there. **Terrain becomes a target unconditionally once he is more than `DIG_BELOW` under his own column's surface.**

**And there was a third gate underneath those two, found only after the first fix landed.** With the gate open, a flat swing in a sewer *still* removed nothing — the blast was firing, `digsTerrain` was true, and `damageSphere` called with the same arguments by hand removed a voxel. The difference was 5 mm.

`impactPoint` drops the radius-sized standoff entirely for a digging swing, because milestone 20 measured that at full fatness it buried the sphere and left a lid over the cavern. That reasoning is about pointing **down**: the downward carry is what takes the blast clear of his body. A **horizontal** dig gets no such carry, and without the standoff the sphere centre sat 0.745 m from a tunnel wall it could reach 0.750 m into — every swing a knife-edge miss.

So the standoff now shrinks with the downward carry (`hypot(dir.x, dir.z)`, 1 flat and 0 straight down) instead of switching off with the dig flag. Both cases come out right from one rule, and the measured shaft depths milestone 20 signed off are preserved. **The same family as the eleven constants in `docs/STATE.md`** — a value that was correct for the only direction that existed when it was written.

### JIM-41 — The follow camera has no collision and sits inside the rock underground

**Status:** fixed 2026-08-08 (milestone 21) · **Test:** `tests/underground.spec.js::the follow camera never sits inside the rock`, `::he fades when the camera is forced in close` · **Severity:** high (the underground is barely viewable) · **Found:** 2026-08-08, while diagnosing JIM-40 · **Chris's words:** *"once you're underground the smoothness we had on the outer world goes away and it turns into blocks."*

`CameraSystem` does no occlusion test of any kind. It places the camera `CAMERA.FOLLOW_DISTANCE` (7 m) behind and `FOLLOW_HEIGHT` (3.5 m) above Jimothy and lerps to it. Sewer tunnels are `SEWER.WIDTH` 3.6 m by `SEWER.HEIGHT` 2.9 m — **a 7 m boom cannot fit in one under any heading.**

Measured in a sewer under the middle of the island:

| | |
|---|---|
| Jimothy | `(69, 35.75, -3)`, 8.96 m below grade |
| camera | `(69, 39.25, 4)` |
| `solidAtWorld(camera)` | **true** |
| fraction of the boom inside rock | **40 %** |

So you are viewing the world from inside the geometry. Back faces are culled, so the tunnel you are standing in disappears and what is left is the disconnected far side of other chunks — which is precisely "it turns into blocks". The blocky *shading* of dug rock is by design (`docs/STATE.md`: "smooth is what you found, voxel is what you did to it"); this is not that, and it is what makes the underground read as broken.

Fix: march the boom from the look target outward and stop at the first solid, with a floor on how close it may come. A 7 m boom in a 2.9 m pipe means the underground camera is near-first-person, which is correct — and he has to fade out at that range or you are inside his skull. The material-fade transition already exists for hide spots (`JimothyController.postUpdate`).

### JIM-33 — The WORLD.BOUNDS slider still had the 250-unit map's range

**Status:** fixed 2026-08-07 (milestone 17) · **Severity:** high (silent, and it would shrink the whole world) · **Found:** while adding a TERRAIN group to the tune panel

`Tunables.js` declared `WORLD: { BOUNDS: [10, 38] }`. `BOUNDS` has been **1000** since milestone 12. `DevOverrides.apply()` clamps every stored override to its declared range, so anyone who ever touched that slider — or had a stale value in `localStorage` — would have booted into a **76 m square** island with no warning and no error. Nothing in the suite would have caught it either: every spec boots without overrides.

Fourth member of the family in `docs/STATE.md` ("constants that secretly meant the middle of the old map"), and the first one to live in a *range* rather than a value. **When `WORLD.BOUNDS` moves, check the tunable range too** — the value and its slider are two places, and only one of them gets updated by habit.

Fixed to `[100, 2000]`.

### JIM-34 — A flat chunk of ground emits 4096 quads where one would do

**Status:** implemented, awaiting playtest (milestone 25, 2026-10-02) · **Severity:** medium (caps the fly camera; invisible in normal play) · **Found:** 2026-08-07, measuring `STREAM.FLY_LOAD_RADIUS`

Historical diagnosis below. Milestone 25 now greedily merges coplanar faces while preserving terrain samples on slopes.

`VoxelWorld._buildChunk` previously culled hidden faces but did no **greedy meshing** — every exposed voxel face is its own quad. A 64×64 chunk of flat ground is 4096 top faces: 24,576 vertices, ~880 KB of geometry, for a surface a single quad could describe.

Measured while choosing how wide the fly camera should stream (`output/iterate/fly-radius.mjs`):

| fly load radius | view | columns | chunks | heap |
|---|---|---|---|---|
| 3 (gameplay) | 210 m | 49 | 191 | 286 MB |
| 4 | 315 m | 142 | 456 | 793 MB |
| 5 (shipped) | 385 m | 184 | 596 | 842 MB |
| 6 | 455 m | 233 | 759 | 842 MB |

Merging co-planar faces of the same material is the standard fix and would cut ground geometry by orders of magnitude, since ground is overwhelmingly flat and single-material. That is what would let the fly camera show the island rather than a district — and it also lifts the ceiling on `VOXEL.SIZE` getting finer (backlog).

Not urgent: normal play streams a 210 m disc and sits at ~110 draw calls.

### JIM-37 — Draw distance: buildings pop in at 106 m now that the fog is gone

**Status:** implemented, awaiting Chris’s playtest · **Severity:** medium (visible constantly, not game-breaking) · **Reported:** Chris, playtest 2026-08-07 — *"might need to work out draw distance to prevent popin."*

Direct consequence of fixing JIM-36, and expected. Fog used to be 41% opaque at the edge of the loaded voxel world; now it starts at 220 m, so **the streaming boundary is naked**. Voxel columns load at `STREAM.LOAD_RADIUS` (106 m) and unload at 176 m, and the horizon mesh beyond it carries terrain and roads but **no buildings** — so the city's silhouette stops dead at 106 m and whole blocks appear as you walk.

Four ways out, roughly in order of value for effort:

1. **A building LOD ring — the obvious one.** `Layout.buildingsIntersecting` answers "what buildings are in this box" from the baked plan *without generating a single voxel*, anywhere on the island, including places never visited. So the buildings between 106 m and (say) 700 m can be drawn as one `InstancedMesh` of boxes at their real footprint and height. One draw call, no streaming, no memory that scales with distance. The silhouette then continues to the horizon and the pop is reduced to detail appearing on an already-present shape.
2. **Greedy meshing (JIM-34), then a bigger `LOAD_RADIUS`.** A flat ground chunk currently emits 4096 quads where one would do, so radius is far more expensive than it should be. Fixing that makes 176 m or 210 m affordable and pushes the boundary out rather than disguising it.
3. **Fade the boundary.** A short fog band, or per-chunk alpha over the last ring, so columns arrive instead of appearing. Cheapest, and it treats the symptom.
4. **Generate further than you mesh.** Decouple "column exists" from "column is drawn" so distant columns can be meshed at lower detail. Biggest change; only worth it with (2) done.

(1) and (2) are complementary and neither blocks the other. (1) is the one that would be felt immediately.

**Quality/rendering repair, 2026-10-02:** physical .22 m destruction remains intact; work is sliced, rigid props and voxel chunks are batched, and twelve MPFB models use one draw each. Graphics presets change distance/detail/shadows; 1,989 distant building silhouettes match the masterplan and preserve damage. The new quality/LOD checks and 20 adjacent checks pass, plus build/rendered smoke. Native 100 m lean/House/Block median frames are 14.2/14.6/19.3 ms; worst 97.1/77.7/112.1 ms. Occasional hitches remain, so no locked-60 claim. See STATE and `output/iterate/native-distance.log`; visual sign-off remains Chris’s.


### JIM-36 — Fog tuned for a 250 m world, on a 2 km island

**Status:** fixed 2026-08-07 · **Severity:** high (it was most of what you could see) · **Reported:** Chris, playtest — *"the fog makes it hard to see much."*

`scene.fog` was `Fog(COLORS.FOG, 40, 200)`, and `CAMERA.FAR` was 500. Both are from the 250 m block. Milestone 12 raised `WORLD.BOUNDS` to 1000 and milestone 17 made the island 2 km across; nobody revisited either. Measured: **at the edge of the loaded voxel world (106 m) the fog was already 41% opaque**, so the only thing it was fogging was the part you could actually see.

**The fog was not the root cause — it was covering for one.** The voxel world stops at `STREAM.LOAD_RADIUS`, about 106 m, and fog at 40 m was hiding that it simply ends. Pushing the fog out without giving it something to draw would have replaced grey with void.

**My own oversight, from earlier the same session.** Milestone 17's fly camera streams a 176 m radius, and I measured that in columns and heap and never once checked whether you could *see* it. Fog was 85% opaque at that distance: the entire extra load radius was invisible. **Measuring the cost of something is not the same as checking it works.**

Fixed with a **horizon mesh** (`LevelBuilder.buildHorizon`): the whole island, once, at 12 m resolution, built from the same baked height field the voxels come from, so it cannot disagree with them about where a hill is. 55k triangles in **one draw call**, sitting `HORIZON.DROP` below the true surface so the real voxel ground always wins the depth test where it exists. Fog then goes to 220–1500 m and the far plane to 2400.

Adding one more ring of voxel columns to see 35 m further costs far more than this does to see all of it — see JIM-34.

### JIM-35 — One headbutt is a five-star wanted level

**Status:** implemented, awaiting Chris's balance playtest · **Severity:** low · **Found:** 2026-08-07, milestone 19

`HEAT.PER_DEMOLITION` is 0.4 *per voxel destroyed*. A single fat headbutt into open ground removes about **1,075 voxels**, which is **430 heat points** — against a tier-5 threshold of 100. So one swing at maximum fatness takes the run from calm to the army.

It may well be intended ("levelling a house is chaos", and the constant is commented as exactly that). But it was written when a blast was small, and `FATNESS.BLAST_PER_FAT` has been raised since. Worth a decision rather than a discovery: either heat scales sub-linearly with the size of a blast, or the per-voxel rate comes down.

**2026-10-02:** demolition heat now uses destroyed cubic metres. A thousand 0.22 m cells produce 4.2592 points instead of 400; doubling voxel resolution preserves the same heat for the same volume. The deterministic volume test, aiming/destruction regressions and rendered smoke pass. The coefficient still needs playtesting.

Found while writing the pursuer noise spec, which raised the tier to 5 by accident and spawned three paparazzi into the middle of the test.

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

### JIM-24 — Jimothy should be able to get as big as a house — no, bigger than that

**Status:** giant form/rotation implemented, awaiting Chris's playtest (milestone 23, 2026-10-02; JIM-49/JIM-60) · **Severity:** high (it is the core fantasy) · **Reported:** 2026-08-07 (Chris), **escalated 2026-08-08**

> "Speed slow down can be more aggressive, the idea is that Jimothy can get as big as a house if he keeps eating."

> **Chris, 2026-08-08, on seeing the dev panel's fatness dial top out at 200:** *"That upper limit is way too small for ultimate fatness — that's gotta be an issue to change and increase to an actual massive size. Like consume the world size."*

**So the target moved, and it moved past "a house".** The dial made the ceiling legible for the first time and the answer was that the ceiling itself is wrong, not the slider: `DEV.FATNESS_MAX` was picked as "the range where moving the slider still changes something", and that range is small **because the curve flattens**, which is the defect. Measured across the whole dial:

| fatness | factor | body width | blast radius |
|---|---|---|---|
| 0 | 0.000 | ×1.00 | 0.75 m |
| 25 | 0.500 | ×1.45 | 3.50 m |
| 90 | 0.783 | ×1.70 | 5.05 m |
| 200 | 0.889 | ×1.80 | 5.64 m |
| **600** | 0.960 | **×1.86** | 6.03 m |

Eating twenty-four times as much between 25 and 600 buys **28 % more width**. `f = fat/(fat + SOFTCAP)` cannot exceed 1, so width cannot exceed `1 + MAX_WIDTH_GAIN` — **×1.9, ever, for any input.** That is the wall, and it is arithmetic rather than tuning: no value of `SOFTCAP` moves it.

"World size" is roughly **×2000**, against a hard ceiling of ×1.9. The bullet list below was written for "a house" and every item on it gets harder by three orders of magnitude — in particular the city stops being furniture and becomes *terrain texture*, and a blast radius that scales with him would remove a district per swing.

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

**→ Promoted 2026-08-09 to `docs/milestones/23-break-the-fatness-ceiling.md`**, with both open questions decided by Chris:
- **How big: block-sized, ×30–50** — bigger than any building, about one `CITY.BLOCK` across. Island-scale (×100+) was rejected for now, because at 110 m he is wider than the entire loaded world and that is a rendering-strategy change rather than a tuning one.
- **Speed at scale: the roll.** The on-foot penalty stays exactly as signed off; the roll becomes a sustained, size-scaled traversal mode. Chris: *"The roll is supposed to turn into a katamari style roll and collect at this fatness scale — so that's how you move about."* That is JIM-29, split across milestones 23 (it moves you) and 24 (it collects).

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

### JIM-32 — The map got 16× bigger and the contents did not: density collapse

**Status:** **fixed** 2026-08-07 (milestone 15), awaiting playtest · **Severity:** high (it is the difference between "explorable" and "empty") · **Found:** 2026-08-07 (milestone 12) · **Tests:** `tests/layout.spec.js::container density is a property of a block, not of the map`, `::SAFE: containers are never placed close enough to topple each other`

Raising `WORLD.BOUNDS` 250 → 1000 multiplied the world's area by 16 and left every piece of content at its old count. **This is the exact failure Chris and the gameplan both name as the thing to avoid** — an empty big map is worse than the full small one it replaced (*"like yakuza!"*, 2026-08-07).

Three systems were anchored to the old map. Two were fixed in milestone 12 because the game does not function without them; the third is this issue.

| system | anchoring | status |
|---|---|---|
| `PURSUER_SPAWN_POINTS` | absolute ±25 coordinates | **fixed** — now offsets from Jimothy, so pressure is the same wherever he is |
| `HIDE_SPOTS.POSITIONS` | hardcoded grid to ±220 | **fixed** — derived from `WORLD.BOUNDS`, constant density |
| `TRASH_CAN.COUNT` (70) | fixed count over `BOUNDS - 6` | **open — this issue** |

**Why the cans were not simply scaled up with the rest.** 70 cans across the old map becomes ~1120 to hold density on the new one, and each is a live `cannon-es` rigid body. That is a physics budget question, not a constant change, and the right answer is almost certainly to **stream props with the world** — spawn them per loaded column from the seed, exactly as buildings now are, so the count tracks the load radius instead of the map.

`Layout` already makes this straightforward: a `propsIn(box)` query alongside `buildingsIntersecting`, and `TrashCans` spawns and despawns against the streamer. Trees, hide spots and pedestrians all want the same treatment, which is why this is worth doing once, properly, rather than three times.

**Until it lands, the map beyond the central district is effectively empty** — ground and buildings, no cans, no snacks, nothing to do. Streaming made the world big; this is what makes it worth crossing, and it should come before the world-tour easter-egg pass in `docs/backlog.md` (which needs somewhere to put the eggs).

**Density alone is not enough.** Chris, 2026-08-07: *"but also variety - don't just have rows and columns of the same destructable house."* There are exactly two archetypes today, one per block, centred on a rigid grid — it reads as rows and columns because it is. Density and variety are the same milestone: see **milestone 15**.

**Where:** `src/gameplay/TrashCans.js` (`defaultLayout`), `src/level/Layout.js`, `src/gameplay/Pedestrians.js`, `src/core/Constants.js` (`TRASH_CAN.COUNT`, `HIDE_SPOTS`)

---

### JIM-29 — Katamari roll: fat Jimothy becomes a hoarding marble

**Status:** collection contact reopened after playtest, 2026-10-02; final stash UI remains open · **Severity:** high (it resolves the fat-slowness tension AND adds a loop) · **Reported:** 2026-08-07 (Chris)

> "let's do something with the roll katamari style, make it turn into more of an actual 'roll' instead of a set animation where Jimothy becomes a giant wrecking ball."
>
> "Yes on picking things up, make it maybe a little less destructive to buildings, but think of it as a mass food and item hoarding strategy when jimothy is fat, you get into katamari mode to move quick enough to collect things like a marble - then when you stop everything unloads and you can sift through what you picked up - people included. So if you get some paparrazi or animal control, or military in the roll - you'll need to get away from them to do anything with the stash."

**This is a whole loop, not a move.** It resolves the fat-slowness problem the bigger map created (a successful run ends taking **12m 12s** to cross a world built for exploring) by converting the penalty into a *mode*: on foot fat is slow, but rolling it is fast, and rolling is also how you harvest. Fat stops being a tax and becomes a change of gear.

**2026-10-02 reproduction:** Block/Absurd register 64 attachments, but visible contact is wrong. Rays from attached people to the belly first hit the actual skinned surface 3.63–14.25 m away at Block and 8.97–31.19 m at Absurd. Proxy placement uses an approximate bone-owned box, while pickup proximity uses the smaller, offset collider. Counts/parenting tests miss this. JIM-60 also stops rotation after one tumble. See `RollCollector.update`, `JimothyRig.bellyLocalBox`, `output/iterate/giant-contact-audit.log` and [the audit](giant-audit-2026-10-02.md). Milestone 24 remains unaccepted.


**Surface repair, 2026-10-02:** collection now projects onto the grown skin, preserves entity scale and continues revolving during held rolling. Loaded-skin contact and owner release tests pass; native rendered evidence is in `giant-street-final.log` / `giant-street-carry.png`. Awaiting playtest; the broader stash/sifting loop remains open.

### The loop

1. **Get fat.** On foot you slow down — unchanged, and now it has a purpose.
2. **Enter katamari mode.** The roll becomes continuous and quick — the only way a gorged Jimothy covers ground.
3. **Collect by rolling over things.** Food, props, and **people** — paparazzi, animal control, military.
4. **Stop to cash in.** The ball unloads and you sift the stash.
5. **But you collected your pursuers too.** Anything alive in the stash comes back out where you dump it, so you must **break line of sight and get clear before you can cash in**. Rolling through a crowd is both the best harvest and the worst idea.

Step 5 is what makes it a game rather than a vacuum cleaner. The roll doubles as an escape — scooping up the officer chasing you genuinely removes him from the chase — but you are now *carrying* him, and the reward is gated behind losing him. A free "delete the threat" button would break the pursuit; this makes threat-removal a debt.

### Confirmed: the move's character changes with girth

Chris, 2026-08-07: *"Correct read on skinny vs. big fatty."*

**Both playtest verdicts stand.** The `MOVES.ROLL` decisions were taken at *lean* fatness and continue to describe the lean roll:

- `SPEED: 5` — *slower than a WALK (6) on purpose… the joke is a heavy raccoon heaving himself over.* A skinny Jimothy still does the wonky flop Chris signed off.
- `DURATION: 0.9`, `SPINS: 1` — one deliberate flop, not a gymnastics routine.

**Only `SPEED` inverts with fatness.** The demolition split is *reinforced*, not reversed:

- `FAT_BLAST_SHARE: 0.3` and `RADIUS_SCALE: 0.55` should go **lower, or stay**, per *"a little less destructive to buildings"*. The headbutt remains the demolition tool; the roll becomes the **harvesting** tool. That is a cleaner three-way split than before — headbutt destroys, roll collects, walking is for precision.

### What it needs building

- **A continuous roll**, not a fixed-duration clip. Hold to keep rolling, with rotation derived from **distance travelled** so the spin always matches ground speed instead of drifting against it.
- **Momentum.** A marble takes time to get going and resists turning. This is where the feel lives, and it is what stops katamari mode being a strictly better walk.
- **A carried stash** — a real inventory with mass. Probably the first genuinely new system here.
- **Accreted mass should be visible.** A ball of junk, bins and flailing paparazzi is the single best screenshot this game could produce, and it is the whole reason to do it rather than an invisible pickup radius.
- **Live cargo.** Captured pursuers must be *suspended*, not deleted, and restored on unload — position, type, and their place in the heat system. This is the fiddly part.
- The **kinematic sphere** Jimothy already uses is, for once, exactly the right collision shape.

### Open questions

- **Does collected food count when picked up, or only when sifted?** "Sift through what you picked up" implies the payoff lands at unload — which makes the stash a *deferred* reward and creates the real tension: **what happens to the stash if the net catches you while you are still carrying it?** Losing it is the obvious answer and the one that gives the loop teeth.
- **Does the ball grow the collision radius?** It should visually; if it does so physically, a big stash makes you a bigger target, which rhymes with the existing fat trade-off (JIM-24).
- **Is there a capacity limit,** or does mass itself become the limiter (a huge ball is unwieldy)? The latter is more interesting and needs no UI.
- **What does sifting look like?** It is bulk eating, so it may share the eat animation from JIM-30 — worth designing the two together.

### Relationships

- **JIM-24 (as big as a house)** — the same rebalance from the other side. Should probably be one milestone.
- **JIM-30 (eat button)** — sifting is bulk eating; shared animation and shared verb.
- **JIM-23 (lasso)** — the roll now counters the lasso by scooping the catcher. Check that does not defeat it: the exhaustion stat and the carry-your-captor debt should both be pulling the other way.
- **Milestone 14 (island)** — a fat Jimothy rolling into the sea at speed is both the funniest arrival and the one most likely to break a naive shore-return.
- **JIM-32 (density)** — a harvesting mechanic is worthless on an empty map. **This needs density to land first.**

**Where:** `src/core/Constants.js` (`MOVES.ROLL`, `FATNESS`), `src/gameplay/JimothyController.js`, `src/gameplay/TrashCans.js`, `src/gameplay/Pursuers.js`, `src/core/GameState.js` (the stash)

---

### JIM-30 — An eat button, with its own animation, instead of auto-pickup

**Status:** open · **Severity:** medium (it changes the core loop) · **Reported:** 2026-08-07 (Chris)

> "let's make an 'eat' button instead of auto pickup with it's own animation."

Snacks are currently vacuumed up on contact. An explicit button makes eating an **act** rather than a side effect of walking, which is worth doing in a game where eating *is* the scoring verb — right now the central mechanic is the one thing the player never actually does.

Note this partly restores an intent from the very first scoping session that never got built: *"some you gotta stop to eat vs. just kind of scooping as you go"* (2026-07-23). The two-tier food economy already exists — feasts need a stand-still channel, scraps are instant — so **the interesting question is what the button does to that split.** Options: the button replaces instant scraps entirely (every calorie is chosen), or scraps stay automatic and the button is only for feasts (preserving flow while making the big ones deliberate).

**Design consequences worth thinking about before building:**

- **It adds friction to the scoring verb.** That is the point, but it is also a risk: a combo system (`SCORE.COMBO_WINDOW_SECONDS`) rewards fast chaining, and a per-snack button press may fight it. Pressing to eat while being chased is a real decision; pressing to eat forty times in a quiet street is admin.
- **The animation is the payoff** and is what justifies the friction — a proper chomp on the skinned rig (milestone 10 makes this possible; the head is on a bone now, and the jaw is not a separate bone, so it will be a head/neck performance rather than a mouth one).
- Needs a keybind in `KEYBINDS` and to work on gamepad.

**Where:** `src/gameplay/TrashCans.js` (pickup), `src/gameplay/JimothyController.js` (the animation), `src/core/Constants.js` (`KEYBINDS`, `FOODS`)

---

### JIM-31 — Game over as a holiday photo book of Jimothy's big day

**Status:** open · **Severity:** medium (it is the game's signature screen) · **Reported:** 2026-08-07 (Chris)

> "when you die, get a 'selection' of photos taken by people or paparazzi of 'jimothy's big day' like a holiday book style game over screen"

The current game-over screen is a number. This turns it into the thing people screenshot and post — which, for a game whose whole identity is meme slop, is arguably the most valuable screen in it.

**The mechanical tie-in is already built and unused.** Paparazzi exist as heat tier 1 and their camera flash already fires as a gameplay event (it stuns — JIM-18's era, `tier-2 camera flash stuns jimothy`). **Every flash is a photo being taken.** So the photo book does not need a new system so much as a hook on an existing one: when a flash fires, capture the moment.

**How to capture is the real decision, and it should be made by measurement:**

1. **Render-to-texture at flash time** — a genuine snapshot from the photographer's position, which is exactly what a paparazzo would get. Costs a render pass per photo and some VRAM for the set, and needs a cap on how many are kept. Most authentic, and the framing is automatically comedic because it is from *their* angle, not the player's.
2. **Record the pose and re-stage it at game over** — store position/pose/heat, then rebuild a handful of shots on the end screen. Cheaper at runtime, more work to build, and lets shots be chosen *after* the run.

**What makes it funny is the selection and the captions, not the fidelity.** A holiday-album layout with over-familiar captions ("Jimothy, day 1 — settling in"), a few deliberately terrible shots (blurred, half out of frame, a thumb over the lens), and one genuinely great one. Worth picking photos from *different* heat tiers so the book tells the run's escalation as a story.

**Interacts with:** the "real raccoon facts" credits panel in `docs/backlog.md` — both are end-of-run screens and should be designed together rather than competing.

**Where:** `src/ui/GameOverScreen.js`, `src/gameplay/Pursuers.js` (the flash hook), `src/systems/HeatSystem.js`

---

### JIM-22 — Legs should scamper: sprawled, low, with physics-aware footing

**2026-10-02 playtest:** Chris reported sliding feet and requested pedestrian-style IK, scratching and small idle movements. The loaded-bone path used an open-loop sine swing without planted contacts. Milestone 11 now implements terrain-aware paw contacts, smooth support height and interruptible idle gestures. The full regression passed 176/181, with only the five existing JIM-03/JIM-48/JIM-49 failures. Seven focused checks and build/rendered smoke pass after the final correction for loading the rig mid-tumble. The scratch also exposed torso vertices with up to 85% leg influence: the preserved Blender source/recipe corrects those weights, and an isolated-paw test reduces upper-body displacement from 10.4 cm to zero. Captures and test logs are recorded in `docs/STATE.md`; animation feel awaits Chris's playtest.

**Status:** implemented, awaiting Chris’s playtest — 2026-10-02 · **Severity:** medium (it's the character's whole read) · **Reported:** 2026-08-07 (Chris)

> "What I want with his little legs is to have them be a bit more scamper-y, so a bit more sprawling and lower to the ground, like he's sort of creeping about — then have the physics aware footing you get with unity/unreal engine."

Two separate things:

**(a) Pose — sprawled and low.** Hips splayed wider, knees bent outward, body carried closer to the ground, faster cadence. A creeping raccoon, not a trotting dog. This is tuning, not architecture, and belongs in `Constants` so it can be dialled during playtest.

**(b) Footing — feet plant on real terrain.** What Unity/Unreal give via IK rigs: the foot finds the ground, the limb bends to reach it, and the body responds. On this game's voxel terrain that means sampling `groundHeightAt` per foot, so feet land correctly on crater lips, rubble piles and kerbs instead of sliding through them.

**Most of (b) already exists and was abandoned.** `JimothyLegs._updateTubes` implements a real gait — planted feet, drift threshold, step timing, foot lift — for the fallback stretchy tubes. When the real model loads, `_updateReal` takes over and is only a crude swing. The planting logic is the hard part and it is already written and playtested; it needs reconnecting to actual geometry rather than reinventing.

**Prerequisite, now done:** two-segment legs. `tools/rig_jimothy.py` generates `leg_*` (hip→knee) and `shin_*` (knee→foot) per leg — 12 joints total. A single hip-to-foot bone is a rigid stick and cannot plant a foot on uneven ground. The knee is also deliberately offset outward, which pre-defines the bend direction; a perfectly straight limb is ambiguous to an IK solver.

**Where:** `src/gameplay/JimothyLegs.js` (revive `_updateTubes`' planting against bones), `src/core/Constants.js` (`LEGS` sprawl/cadence), `tools/rig_jimothy.py` (done)

---

### JIM-21 — Seams: the rig separates instead of stretching

**Status:** **fixed** 2026-08-07 (milestone 10), playtested and signed off by Chris — *"Looking much better now"*. The skinned model is what ships (`RIG.SKINNED` defaults true) · **Severity:** high (it caps how far any animation can go) · **Reported:** 2026-08-07 (Chris)

> "We do need to fix the seams — have the mesh stretch instead of just separate/break."

**There is no automated seam check and there cannot be a useful one**, which is why this needed a playtest to close: the mesh is one continuous surface, topologically incapable of tearing, and an attempt to measure gaps between adjacent bones' vertex sets reported 0.077 world units at the hip of a fat mid-roll Jimothy whose mesh was provably intact — because triangles straddle the boundary, so a joint that *stretches* separates them exactly as a torn one would. "Seam" is a rendering judgement. `rig.parts` in `render_game_to_text()` reports every part's position if one ever does show up.

**Original diagnosis, kept:** Jimothy was **seven rigid solids** parented into slots (milestone 06). Any animation that moves a piece slides it past its neighbour, because there is no geometry spanning the joint. Milestone 09 capped the sockets so you no longer see *through* him, but a capped socket sliding past a capped stump is still a visible seam — and it is why the headbutt's head thrust had to be cut to 0.12 (JIM-18) and why the legs still read as detached (JIM-11).

**No amount of work on the split approach fixes this.** Separate solids cannot deform across a joint; that is what skinning is for.

**Fix:** one continuous mesh bound to an armature, with smooth vertex weights across each joint so the surface stretches. Bones can be placed from the same anatomy landmarks the split already computes (`neck_y`, `tail_y`, `leg_z`, plus L/R and front/back), so the hard-won calibration carries over. The game then drives **bone rotations** in exactly the places it currently drives slot rotations — head bob, tail wiggle, leg swing, roll tuck, headbutt pitch — so `JimothyController`'s animation logic survives largely intact.

Retires: the socket-capping half of JIM-10, JIM-11, and the JIM-18 thrust cap. Also lays groundwork for Phase 2 ragdoll, which wants a joint hierarchy anyway.

**Where:** `tools/prep_jimothy.py` (armature + auto-weights, export with skin), `src/gameplay/JimothyRig.js` (SkinnedMesh + bone lookup), `src/gameplay/JimothyController.js` and `JimothyLegs.js` (drive bones, not slots)

**Tooling note:** no Blender MCP server is connected to this session, and none is needed — the pipeline already runs headlessly via `blender --background --python`, which `docs/STATE.md` records as the better loop for batch asset work.

---

### JIM-11 — Legs still read as detached from the body

**Status:** **cause retired** 2026-08-07 (milestone 10) — needs one look to confirm, not more code · **Severity:** medium · **Reported:** 2026-08-06 (Chris, with screenshot)

**Both suspected causes below are gone by construction on the skinned path.** There is no socket and no separate leg piece to rotate out of one: the legs are part of the same continuous surface, and a hip is now a bone the skin stretches across. Chris's milestone-10 sign-off (*"Looking much better now"*) was a verdict on the rig as a whole and did not call this out specifically, so it is parked rather than closed — **look at a walking Jimothy's hips once and close it**, rather than writing any code against it.

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

### JIM-03 — Two specs failing at city scale

**Status:** open, **halved 2026-08-07** · **Severity:** medium · **Carried from:** roadmap ⚠️ #3 (2026-07-23), list corrected 2026-08-06, **narrowed 2026-08-07**

Measured serially (`--workers=1`, so not worker contention). The set is now:

- `tests/gameplay.spec.js::score and combo`
- `tests/fatness.spec.js::interrupted feast resets progress`

**Two of the four fixed themselves as side effects of milestones 12 and 15**, which is worth recording because neither was being worked on:

- ~~`tests/heat.spec.js::tier-2 camera flash stuns jimothy`~~ — fixed by making pursuers spawn on a ring around Jimothy instead of at absolute map coordinates. The paparazzi simply could not reach him to flash him.
- ~~`tests/heat.spec.js::heat rises with chaos but not with eating`~~ — fixed somewhere in the layout/density work; the likeliest cause is bins no longer toppling themselves and generating chaos heat with no player input.

**Both remaining failures are about scoring**, which is now the strongest hint yet at where the real defect is: `score and combo` and `interrupted feast` both assert on score/combo bookkeeping rather than on the world. Feast eating is still unverified end-to-end.

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

Milestones 26–27 replace capsules with animated MPFB people and terrain IK. Ragdolls and injury states remain open; collection releases people alive. Roadmap Phase 2.

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
