# Milestone 26: Varied animated neighbours

## Status

Implemented, awaiting Chris’s playtest — 2026-10-02.

## Objective

Address Chris's world review: smaller Teardown-like blocks, recognisable varied houses, nearby moving people and cars, sky and water, and street objects that can be knocked loose and collected by a giant rolling Jimothy.

## Scope

Create six clothed MPFB humans in Blender, preserve editable sources and a reproducible recipe, export game rigs, and stream animated pedestrians near the player. People navigate clear land and react to Jimothy.

## Acceptance criteria

- [x] Six visibly varied clothed humans use MPFB geometry, with documented assets and editable Blender source.
- [x] Exported models load in the game with walking animation, ground contact and varied appearance.
- [x] Populated streets near spawn and distant districts contain pedestrians; movement avoids buildings and water.
- [x] Scaring generates heat once per encounter; restart restores population without accumulating objects.
- [ ] Chris judges variety, animation and street activity in play.

## Dependencies

Depends on: milestones 12, 17, 22; uses the existing in-progress milestone 23 scale work. Delivery order: 25 → 26 → 27. Milestone 27 implements the collection/release portion of milestone 24.

## Out of scope

Vehicle driving/stealing, police/army escalation, structural collapse of whole buildings, new scoring rules, and final katamari stash UI.

## Exit condition

Chris explores several streets and sees the approved world changes, then tries destruction and a giant roll through street life and confirms the result feels right.

## Test plan

Write focused failing acceptance tests first. Verify state through render_game_to_text and advanceTime, inspect pixel-readback captures under output/iterate, run adjacent regression tests and build. Commit/push this milestone independently; report implemented, awaiting playtest until Chris signs off.

## Evidence

Six MPFB 2.0.17 humans authored in Blender 5.2, with packed editable sources, game sources, CC0 asset attribution and build scripts in `assets/blender/people/README.md`. Each has Idle, Walk and Run clips. Runtime uses 36 nearby clones and an obstacle-filtered pavement graph. Ten pedestrian/heat tests pass; build and smoke pixel readback pass. Captures: `output/iterate/mpfb-lineup.png`, `pedestrians-in-game.png`, `pedestrians-material-fix.png`. Tests run in manual time now render once per requested step instead of redrawing a frozen scene on every RAF; the first software-WebGL heat run timed out before this change.

## Pedestrian variety refinement — 2026-10-02

Requested by Chris after play: expand the roster from six to twelve authored MPFB adults, preserving the shared bone contract and 36-person population cap. Add distinct clothing, hair/hat silhouettes, age, skin, height and build; keep the existing assets and editable sources.

- [x] Twelve source recipes and runtime models; at least ten outfits, nine skin textures and eight hair/hat choices; each remains below 18,000 triangles and 3 MB.
- [x] Every new rig animates, has two grounded legs, creates all 11 ragdoll bodies and 10 joints, and removes them without leaks.
- [x] All twelve people pass the existing uphill/downhill/cross-slope contact and continuity bounds; streaming, scaring and restart remain stable.
- [ ] Inspect Blender and in-engine lineups plus normal street play. Chris judges the visible variety and walking feel in play.

Acceptance tests: `pedestrian-variety.spec.js`, the expanded `walking-ik.spec.js`, and adjacent `pedestrians.spec.js` / `ragdolls-capture.spec.js`. The initial source-roster test fails at six models (`output/iterate/pedestrian-variety-red.log`).

Refinement evidence: twelve models use twelve outfits and skin textures, nine hair assets and a fitted hat. Maximum asset: 16,991 triangles / 2.68 MB; the new six add 14.23 MB of GLBs. The population stays at 36. Final tests: 3 walking + 23 asset, grounding, pedestrian, ragdoll/capture, collection, traffic and spare-tyre checks pass. All 36 slope/model cases and 36 model/frame-rate cases pass. JIM-58 records the short-leg running-stride correction, with unchanged assertion limits. Build and rendered production smoke pass without console errors. Blender and runtime lineups were inspected (`mpfb-lineup.png`, `pedestrian-variety-game-row-1.png`, `pedestrian-variety-game-row-2.png`); street captures show walker, musician and pensioner in play. Logs and captures are under `output/iterate/`. Chris's visible/feel judgement remains open.
