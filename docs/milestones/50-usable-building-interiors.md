# Milestone 50: Usable building interiors

## Status
Implemented, awaiting Chris’s playtest. Chris requested this repair on 2026-10-03; the optional priority question was unanswered, so the recommended building-first order was used.

## Objective
Make buildings reliably enterable and comfortable to explore. Repair JIM-79's floor/roof jumps before adding the doors and room layout changes requested in JIM-80.

## Scope
- Floor-aware horizontal, step and ceiling collision; local overlap recovery.
- Visible hinged entrance and room doors that open for Jimothy/residents, break loose under impact and lose support with the building.
- Open living areas in small homes, usable room dimensions and connected circulation in larger buildings.
- Purpose-specific furniture arrangements with clear routes and bounded nearby detail.

## Out of scope
Wanted rebalance and the requested staged police/infantry response are recorded in backlog for the next focused pass. City expansion and keepsake priorities retain their earlier proposal.

## Dependencies
- **Depends on:** M38, ADR-0006, shared prop/collection/support systems.
- **Blocks:** building playtest and later city interiors.

## Acceptance criteria
- [x] Ordinary walking along interior walls/doorways and hopping under low ceilings never acquires an upper floor; outdoor stepping and stairs still work — tests: `tests/building-contact.spec.js`.
- [x] All authored orientations expose a front door and connected interior doors; rooms meet minimum usable dimensions or remain open studios — tests: `tests/interior-layout.test.mjs`.
- [x] Jimothy and residents open/pass doors; doors break or fall after impact/support loss, remain absent after travel and reset correctly — tests: `tests/building-doors.spec.js`.
- [x] Closed leaves block sight and camera; nearby pursuers open them, and radar samples invalidate on door changes — tests: `tests/building-doors.spec.js`, `tests/door-occlusion.test.mjs`, adjacent `tests/search-radar.spec.js`.
- [x] Homes have purpose-specific living/kitchen/sleeping arrangements; furnishings avoid reserved door swings/navigation routes and active detail stays bounded — tests: `tests/interior-layout.test.mjs`, `tests/building-doors.spec.js` and `tests/interiors.spec.js`.
- [ ] Inspect the original rig in house/apartment/shop interiors; circulation, furnishing and door motion feel natural — verified by user playtest.

## Exit condition
Chris walks into a house, opens connected room doors, explores furnished rooms and hops by walls → Jimothy stays on the correct floor and the space feels usable.

## Test plan
Record failing collision/layout/door checks first. Run focused browser checks, indoor population/ragdoll/persistence checks and adjacent voxel/sewer/movement cases. Build and native WebGL smoke; capture real-rig interior views under `output/iterate/`. Chris gives final feel sign-off.

## Notes
The user's new door request supersedes ADR-0006's former open-passage-only scope. Keep the same continuous scene, destructible shell and shared layout coordinates. No per-house light or unbounded prop population.

JIM-79 collision checks passed before the layout pass: 30 unique browser cases, 83 existing units, build and production pixel smoke; original-rig indoor capture is console-clean. Checkable ceiling/overlap regressions failed first. The wider-layout pass is now implemented below; visual comfort awaits Chris’s playtest.

## Implementation and evidence — 2026-10-03

`DoorModels.js` is the editable procedural source for paneled wood doors, handles and exterior letter slots. Leaves use bounded animated opening before release into the shared Cannon prop system; they are not free physical hinge constraints. At most 32 doors, 64 other furnishings, 16 fragments and 8 residents remain active across four floors. Existing furniture assets gain supported TVs, computers and books. Destructible jamb trim/skirting use the same voxel shell. The whole-city room audit covers 1,964 buildings and 7,164 rooms; minimum dimension is 3.08 m.

Initial layout/door/dressing/closed-sight checks failed before implementation. Doorway crossing exposed a rug launched by ordinary walking; the corrected check now moves both the original Jimothy rig and a resident through the same hinged doorway. Closed-door sight checks also cover camera pull-in and approaching animal control. Carried leaves preserve template, mass and loose state after unloading. The support regression still removes all 1,854 sampled roof cells and registers the bounded 24 falling structure pieces.

Final verification:

- **25 browser checks:** doors 8, interiors 8, search/radar 6, support loss 3 — `output/iterate/building-final-regressions.log`.
- **86 units**, build and production WebGL pixel smoke, no console errors — `building-final-{units,build,smoke}.log`. Build retains the existing bundle-size warning.
- Native original-rig follow views: `building-{house,apartment,shop}-follow.png`; separate corner inspection cameras hide Jimothy for room visibility in `*-room.png`. All six inspected; no console/page errors. State, timings and capture recipe: `building-interiors-native.json`, `building-interiors-verified.log`, `building-interiors-view.mjs`.
- Warmed 1280×800 Chrome/Metal, 120 sampled update-plus-render submissions per stationary room: house median/p95/worst **11.3/12.6/15.3 ms**, apartment **11.7/13.1/14.2 ms**, shop **10.4/11.4/12.4 ms**. These measure CPU submission, not GPU completion, general frame rate or giant demolition performance.

Playtest at http://127.0.0.1:4174 → gear → **Visit next building interior**. Walk door-to-door and hop alongside partitions. Chris must still judge camera comfort, room dressing and natural movement before this milestone is signed off. Wanted pacing and the expanded enemy roster remain the next requested pass.
