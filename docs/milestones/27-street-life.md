# Milestone 27: Traffic and physical street objects

## Status

Implemented 2026-10-02, awaiting Chris's playtest. Approved as the final part of the ordered world pass.

## Objective

Address Chris's world review: smaller Teardown-like blocks, recognisable varied houses, nearby moving people and cars, sky and water, and street objects that can be knocked loose and collected by a giant rolling Jimothy.

## Scope

A common physical entity contract for parked/moving cars, poles, hydrants, bins and street furniture; break/knock responses; size-dependent attachment to giant rolling Jimothy and release when rolling stops. Connect existing cans, food and people to the same collection flow where applicable (milestone 24).

## Approved refinement — 2026-10-02

Chris requested free online car models instead of custom geometry, real glass, and ground IK for people/objects. Use Kenney Car Kit CC0 sources through Blender, retain attribution/source files, and verify individual feet and wheels against the visible terrain. Include these checks in this milestone.

## Acceptance criteria

- [x] Imported licensed cars have preserved originals, editable Blender files and glass windows.
- [x] Foot IK and wheel support keep contact on uneven ground.
- [x] Parked cars and moving traffic occupy streets near the player and in distant districts.
- [x] Poles, hydrants and street objects have physical knock/break responses, never decorative indestructible blockers.
- [x] Collection is gated by rolling and Jimothy's size; collected objects follow his rolling body, then release into the world when he stops.
- [x] People survive collection; food remains collectable and props remain physical after release.
- [x] Restart clears attached/dropped objects and restores traffic/props without resource or body growth.
- [ ] Chris judges traffic, destruction, rolling collection, sky/water and the full world pass in play.

### Approved glass shatter refinement — 2026-10-02

Chris confirmed “yes glass with shatter”.

- [x] A small hit shatters the connected building pane, preserving its frame and separate panes; damage survives streaming. `glass.spec.js`: connected pane across a chunk seam.
- [x] Individual imported car windows shatter independently; heavy impacts shatter remaining glazing before breaking the car body. Broken windows survive streaming and restart restores them. `glass.spec.js`: independent panes and lean/heavy hits.
- [x] Glass becomes thin triangular physical shards, with a bounded count and lifetime. Shards settle, can attach to a giant rolling Jimothy, and release; restart removes their bodies and registry entries. `glass.spec.js`: physical shard lifecycle and collection.
- [ ] Chris judges the glass appearance and shatter readability in play (verified by user playtest).

## Dependencies

Depends on: milestones 12, 17, 22; uses the existing in-progress milestone 23 scale work. Delivery order: 25 → 26 → 27. Milestone 27 implements the collection/release portion of milestone 24.

## Out of scope

Vehicle driving/stealing, police/army escalation, structural collapse of whole buildings, new scoring rules, and final katamari stash UI.

## Exit condition

Chris explores several streets and sees the approved world changes, then tries destruction and a giant roll through street life and confirms the result feels right.

## Test plan

Write focused failing acceptance tests first. Verify state through render_game_to_text and advanceTime, inspect pixel-readback captures under output/iterate, run adjacent regression tests and build. Commit/push this milestone independently; report implemented, awaiting playtest until Chris signs off.

## Implementation and evidence

- Six original Kenney Car Kit 3.1 CC0 models, imported through Blender; originals/licence and editable `.blend` sources are preserved. Eight moving and ten parked cars stream around Jimothy. Cars prefer nearby clear road positions, with clearance measured against prop size rather than car spacing.
- Street lamps, hydrants, benches, mailboxes and fine-cell trees break into physical sections. Existing bins, food, bushes, civilians and pursuers share collection/release. The animated belly carries attachments; stopping releases them onto land outside building footprints. Invalid house-overlapping bushes are removed, and the barrel den follows the ground along its length.
- People use two-bone leg IK, reachable planted targets, pelvis correction and foot normals. Steep banks are excluded from civilian routes. Cars use body pitch/bank and individual wheel support; building/car windows use transmissive glass and sky reflections.
- `tests/street-life.spec.js` checks nearby moving/parked traffic, distant streaming, physical breakage, real held-key collection of food and animal control, living release and repeated restart body/registry counts. `tests/grounding.spec.js` checks planted feet, wheel contact and glass.
- Captures: `output/iterate/world-pass-final.png`, `car-glass-final.png`, `pedestrian-foot-ik.png`, `giant-collection-final.png`. These support implementation review; they are not Chris's playtest sign-off.

## Playtest

Open the production preview at `http://127.0.0.1:4174`. Explore at lean size, then use **Dev panel → Jimothy → House** (90) or **Block** (250), hold **C** through a populated street, and release it. Judge house scale/variety, gait, traffic, glass, breakage and where living people/props land. Stash UI, structural collapse, army escalation and the known JIM-03 feast-interruption failure remain separate work.

For glass, aim a lean headbutt at a car window, then try a building window. Check that the pane clears and small shards scatter and land; grow larger to break the car body. Frames or surrounding walls inside the headbutt sphere can also break. Captures: `output/iterate/glass-car-before.png`, `glass-car-shatter.png`, `glass-house-before.png`, `glass-house-shatter.png`. The building capture uses a tiny exact hit to show the preserved frame and neighboring panes.

The focused glass/grounding/street/voxel run passed 17/19 cases. The two draw-call failures reproduce on the previous commit and are tracked as JIM-48. Glass-specific red/green evidence: `glass-red.log`, `glass-refinement-red.log`, `glass-adjacent.log`. The stress test exposed glass overlapping coarse vehicle colliders; the final implementation excludes prop contacts while retaining gravity and voxel collision. This is a deliberate approximation, not mesh-accurate vehicle collision.

## Final checks

Glass refinement: full suite **147/152 passed** in `output/iterate/glass-full-suite.log`. Five pre-existing failures remain: interrupted feast (JIM-03), two rig growth assertions (JIM-49, reproduced exactly on `723c993`), and two renderer-budget assertions (JIM-48, also failing on `723c993`). All four new glass cases, all grounding/street-life/world-detail checks, production build and real rendered smoke pass. Captured car/building shatters produce no console errors. Glass appearance and feel await Chris's playtest.

The broad state run passed 49 adjacent aim/dev-panel/fatness/physics/pursuer/scale checks. All 16 grounding, pedestrian, heat and street-life checks passed on the clean rerun; four world-detail checks also passed. The final suspension refinement passed all six grounding/street-life checks together. Production build and real rendered smoke pass with no console errors. The known JIM-03 interrupted-feast failure was excluded and remains open. Full world sign-off awaits Chris's playtest.
