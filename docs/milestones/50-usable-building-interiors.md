# Milestone 50: Usable building interiors

## Status
In progress. Chris requested this repair on 2026-10-03; building-first order is the recommended default while the optional priority question is open.

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
- [ ] All authored orientations expose a front door and connected interior doors; rooms meet minimum usable dimensions or remain open studios — tests: `tests/interior-layout.test.mjs`.
- [ ] Jimothy and residents open/pass doors; doors break or fall after impact/support loss, remain absent after travel and reset correctly — tests: `tests/building-doors.spec.js`.
- [ ] Homes have readable living/kitchen/sleeping arrangements; furnishings do not occupy door swings or navigation routes and active detail stays bounded — tests: `tests/building-doors.spec.js` and `tests/interiors.spec.js`.
- [ ] Inspect the original rig in house/apartment/shop interiors; circulation, furnishing and door motion feel natural — verified by user playtest.

## Exit condition
Chris walks into a house, opens connected room doors, explores furnished rooms and hops by walls → Jimothy stays on the correct floor and the space feels usable.

## Test plan
Record failing collision/layout/door checks first. Run focused browser checks, indoor population/ragdoll/persistence checks and adjacent voxel/sewer/movement cases. Build and native WebGL smoke; capture real-rig interior views under `output/iterate/`. Chris gives final feel sign-off.

## Notes
The user's new door request supersedes ADR-0006's former open-passage-only scope. Keep the same continuous scene, destructible shell and shared layout coordinates. No per-house light or unbounded prop population.

JIM-79 collision checks passed before the layout pass: 30 unique browser cases, 83 existing units, build and production pixel smoke; original-rig indoor capture is console-clean. Checkable ceiling/overlap regressions failed first. Visual comfort still awaits the wider-layout pass and Chris’s playtest.
