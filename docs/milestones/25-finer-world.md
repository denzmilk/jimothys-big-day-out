# Milestone 25: Finer buildings and a living island

## Status

Implemented, awaiting Chris's playtest — approved by Chris 2026-10-02 as one ordered world pass; implementation requires his playtest before sign-off.

## Objective

Address Chris's world review: smaller Teardown-like blocks, recognisable varied houses, nearby moving people and cars, sky and water, and street objects that can be knocked loose and collected by a giant rolling Jimothy.

## Scope

Finer destructible cells; building dimensions in metres; distinct residential silhouettes, roofs, windows, porches and trim; material variety; animated sky/water. Preserve terrain, digging, streaming and unrelated in-progress giant growth work.

## Acceptance criteria

- [x] Voxel edge is at most 0.22 m; building dimensions remain human-scale as resolution changes.
- [x] Residential footprints and roof proportions read as houses, with at least three deterministic style variants and readable doors/windows/porches.
- [x] Flat coplanar faces merge; smooth terrain remains continuous; destruction persists after streaming.
- [x] Sky and water animate with deterministic simulation time; rendering has valid pixel readback and no runtime errors.
- [ ] Chris judges house variety, finer destruction, atmosphere and frame rate in play.

## Dependencies

Depends on: milestones 12, 17, 22; uses the existing in-progress milestone 23 scale work. Delivery order: 25 → 26 → 27. Milestone 27 implements the collection/release portion of milestone 24.

## Out of scope

Vehicle driving/stealing, police/army escalation, structural collapse of whole buildings, new scoring rules, and final katamari stash UI.

## Exit condition

Chris explores several streets and sees the approved world changes, then tries destruction and a giant roll through street life and confirms the result feels right.

## Test plan

Write focused failing acceptance tests first. Verify state through render_game_to_text and advanceTime, inspect pixel-readback captures under output/iterate, run adjacent regression tests and build. Commit/push this milestone independently; report implemented, awaiting playtest until Chris signs off.

## Verification, 2026-10-02

`world-detail.spec.js` covers cell size, house styles/dimensions, exact single-cell damage, merged faces and atmosphere time. The 56-test adjacent run passed 54 initially; two old probes needed correcting: the new house layout covers the former bare-ground sample line, and the landing test subtracted collision radius from a render root already located at his feet. Neither tolerance was loosened. Targeted rerun verifies both. Build and smoke pass; pixel readback sky [228,210,181,255], ground [55,57,54,255], console errors none. Visual captures: `output/iterate/world-before.png`, `world-terraces.png`.

Building plots now terrace into the original height field through a cached height override shared by meshing, collision, strata and destruction. Water is an animated surface shader, not fluid simulation. Whole-building structural collapse remains JIM-02.
