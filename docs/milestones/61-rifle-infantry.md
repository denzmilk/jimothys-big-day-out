# Milestone 61: Five-star rifle infantry

## Status
Implemented, awaiting Chris’s playtest — authorised playground sequence, step 4.

## Objective
Five stars add recognisable soldiers firing short automatic bursts. Warnings, cover, dodging and recovery keep the rampage playable while the army adds pressure.

## Scope
- Four soldiers maximum, staggered dispatch, existing Pursuers sight/search/navigation and shared human ragdoll/collection ownership. Carried soldiers occupy slots; far uncarried actors retire.
- Derive a separate olive outfit from the retained editable MPFB worker, preserving skin, rig and clips. Author a fitted helmet in Blender and import a longer CC0 Kenney Blaster Kit weapon. Keep editable sources/licences and bounded packed exports.
- Aim warning → three committed rounds → recovery. Recheck cover/range/ownership between rounds. Share swept projectiles and mass-sensitive player knockback, bounded particles/audio, and net coordination. No wanted credit or new run-ending rule.
- Preserve four-star police, tanks/jets, manual spawn inspection and restart/travel safety.

## Depends on
M57 player ragdolls, M58 pacing, M59 response poses, M60 police projectile/ownership paths.

## Acceptance criteria
- [x] Four stars have no infantry; five stars introduce at most four soldiers over time, on clear grounded land. Carried soldiers retain slots and distant uncarried soldiers retire.
- [x] Soldiers wear a separate fitted uniform/helmet, hold the sourced rifle with two hands and retain readable walking, aiming and ragdoll poses without changing civilian assets.
- [x] At 30/60/120 Hz each burst warns, commits its aim, fires three spaced visible rounds, then recovers. Cover, lost sight, shield, net, riding, ragdoll and collection interrupt pending rounds.
- [x] Actual voxel cover and a sideways dodge avoid shots; hits launch small Jimothy, respect huge-body resistance and allow recovery. No hostile attack earns wanted points; only the net ends a run.
- [x] Perception/radar uses finite observed memory. Effects/projectiles/voices/actors remain bounded during repeated bursts; reset clears them. Combined five-star response still permits capture.
- [x] Units, focused/adjacent gameplay, native original-rig inspection, build and production pixel smoke pass without errors.
- [ ] Chris judges burst readability, pressure, appearance and sound in play.

## Sources
Retained Kenney Blaster Kit 2.1, CC0: https://kenney.nl/assets/blaster-kit (official licence checked in M60, 2026-10-04). MPFB/MakeHuman CC0 system assets: existing worker editable/game files and attribution. Helmet is original project work.

## Exit observation
Reach five stars, see a soldier raise their rifle, dodge a burst or use a wall, knock the soldier into ragdoll and collect them when large enough. Escape their search, then restart with no stranded actors/projectiles/effects. Hands-on sign-off remains required.

## Review evidence — 2026-10-05

Initial policy import and all six gameplay cases were red because infantry was absent. The first integrated pass passed dispatch, dodge/interrupts and search cleanup; three original-rig cases timed out, including two in asset readiness. A separate native run loaded in about ten seconds without errors. An isolated grip rerun then exposed a real 17 cm supporting-hand gap. The held rifle now sits closer to the shoulder, and the unchanged 10 cm criterion passes in the refined run. Asset-readiness diagnostics remain; no root cause is claimed for the initial intermittent timeouts.

Blender previews show separate olive workwear, rounded helmet and the longer sourced firearm. The 16,170-triangle, one-draw skinned export preserves the worker's geometry, skin attributes, hierarchy, bind matrices and Idle/Walk/Run samplers exactly; only its clothing texture differs. Recipes, editable files, original CC0 archive contents and licences are retained.

All 33 infantry/local/military/police cases passed, along with 163 units and build. Final native inspection records three shots, one hit, shared player ragdoll/recovery and no errors; the supporting-hand gap is below 0.001 mm. The close-up exposed a high helmet rim. A posed-skin bounds check reproduced only 2.63 cm overlap. Lowering the seat 6 cm gives 8.63 cm overlap and a crown 1.90 cm above the hair; the unchanged assertions and final rendered fit pass. The bounds fixture first needed a complete scene matrix update to refresh attached-skin inverse transforms; its original doubled world offset was a measurement error, not a character position defect.

Evidence: `output/iterate/infantry-verified.log` (33 cases), `infantry-units-verified.log` (163 units), `infantry-fit-verified.log`, `infantry-build-complete.log`, `infantry-smoke-complete.log` (production pixel readback, console-clean), `infantry-native-complete.log` and `infantry-native/`, `infantry-asset-invariants.json`. Native captures isolate attack/pose behavior; they are not a whole-world performance benchmark. Initial intermittent readiness timeouts did not recur in the final checks; their cause is not established. Audible speaker mix and gameplay pressure still require Chris's playtest.
