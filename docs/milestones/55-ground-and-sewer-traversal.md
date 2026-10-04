# Milestone 55: Traverse smooth ground and usable sewer stairs

## Status

In progress after M54 (`52980d0`) in the authorised sequential queue. Intact-slope contact (JIM-93) and connected sewer stairs (JIM-94) are implemented, awaiting playtest. Damaged-ground smoothing (JIM-43) remains active.

## Objective

Jimothy can walk over natural and damaged terrain and enter/leave the sewers without hitching on sharp voxel ledges or unusable steps.

## Scope

Survey reported incline/decline contacts, destruction surfaces and every sewer stair connection. Keep smoothing limited to terrain/appropriate ground materials, preserve crisp building structure and live destruction, and make rendered/physical steps agree.

## Dependencies

**Depends on:** M28 road/paving geometry, M48 sewers, M54 gait evidence, ADR-0002/0003 terrain contact and physics ownership.
**Blocks:** physical rolling/ragdoll recovery, grapple/flight landings and sewer minigame routes.

## Acceptance criteria

- [ ] Record native views and deterministic walking traces that reproduce slope sticking and each unusable sewer entry; distinguish geometry, collision and pose faults.
- [ ] Natural/damaged ground uses continuous traversable surfaces where appropriate, with matching render/contact heights and no invisible step after remeshing. Buildings retain sharp corners and interiors retain ceilings.
- [x] Sewer entrances have recognisable treads/risers or intentionally marked ramps, correct clear headroom and connected top/bottom landings. Walk down and back up every generated entrance class at normal speed.
- [ ] Destruction/travel/restart retain surface continuity and route state. Destroyed stairs release unsupported parts; the player does not get teleported onto a roof or through a ceiling.
- [ ] Original-rig uphill/downhill/entry routes remain console-clean and within recorded work budgets; Chris approves appearance and traversal feel — verified by user playtest.

## Exit condition

Chris crosses a rough slope, walks into the sewer and returns through its stairs → the terrain feels continuous and the steps are visibly and physically usable.

## Verification

Write failing contact/path tests before implementation. Preserve road/destruction/interior/underground checks, add surface seam and stair route coverage, then run build/pixel smoke and native route inspection. Full arbitrary tunnel meshing may require its own architecture decision after the reproduction; do not replace the voxel system speculatively.

## Intact-slope contact checkpoint — 2026-10-04

JIM-93's intact-slope hitch is reproduced and repaired. Near the exposed ground cap, `solidAtWorld` now shares the continuous surface instead of treating storage cells as a square obstruction. Twelve original-rig analytic routes cover uphill/downhill 30/60/120 Hz; the native generated steep street is traversed both ways. Walls, ceiling, excavated air, driving and underground damage checks are retained. All 122 units, build and pixel smoke pass. JIM-48's existing giant-channel support deadline remains failing. Details: JIM-93 and `output/iterate/terrain-contact-*`.

Remaining M55 work: damaged-surface smoothing (JIM-43), broad connected sewer stairs/landings (JIM-94), rendered/destructible route verification, then Chris's playtest. This checkpoint does not check off those acceptance criteria.

## Sewer stair checkpoint — 2026-10-04

JIM-94 replaces the narrow spiral with broad treads, level corners and full-height connections. All 21 layouts and 42 original-rig down/up routes pass; removed stair sections become physical rubble and remain removed after travel, then restore on restart. A destructible street cover reduces the enlarged shaft opening without blocking the upper flights. All 126 units, build, focused browser checks and native inspection pass. Evidence and limits are recorded under JIM-94.

Next: JIM-43 exposed damaged-ground smoothing with matching contact, preserving structural stairs/ceilings and the existing bounded destruction pipeline. Chris's playtest remains required; M55 is not complete.
