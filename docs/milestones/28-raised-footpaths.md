# Milestone 28: Raised, destructible footpaths

## Status

Implemented, awaiting Chris's playtest — requested by Chris, 2026-10-02. Depends on milestones 25 and 27.

## Scope

Give streets a built cross-section: reserved pedestrian strips, raised kerbs and concrete paving slabs with visible joints and depth. Street grades follow the island's hills through planar runs and level junctions, with gradual joins between district grids. Keep the paving in the voxel world so Jimothy can break it and streaming preserves damage. Pedestrians use the footpaths with the existing smooth IK.

## Acceptance criteria

- [x] Footpaths border streets, have their own surface class and material, and remain free of building footprints.
- [x] Kerbs stand above the carriageway, slab joints have geometric depth, and cross-sections are level rather than inheriting the grass bank. Verify ground queries against rendered geometry.
- [x] Paving breaks into ordinary voxel debris; damage survives streaming and restart restores the surface.
- [x] Pedestrians populate and walk along the footpaths with stable ground contact; cars remain on the carriageway.
- [x] JIM-86 refinement: diagonal road/kerb and district edges follow the authored outlines, uphill grades join smoothly, and fitted surfaces retain matching contact and destructive edits. Checks: six road-surface units, adjacent paving/layout/traffic/walking cases and inspected original-rig views.
- [ ] Chris judges the street shape, paving scale and walking transitions in play (verified by user playtest).

## Verification

Write failing footpath checks first, then run the live state/time/render loop, adjacent grounding/terrain/layout/streaming checks, build and full regression suite. Captures belong in `output/iterate/`. Commit and push when implemented and verified; final visual sign-off belongs to Chris.

## Implementation evidence

- `tests/footpaths.spec.js`: reserved strips and building exclusion, level interior cross-sections, 776 district joins, rendered surface/ground agreement, recessed joint geometry, underground wall preservation, paving debris, streaming/restart, backdrop coverage and pedestrian/traffic routes.
- `PAVING`: 2 m strips, 22 cm kerbs, 1.1 m slabs, 18 mm recessed joints. A 24 m transition joins differing district grades. Five new acceptance checks; the tunnel case was reproduced red before fixing the mesher.
- `output/iterate/footpaths-headbutt.log`: a real E-key headbutt targets paving material 23, removes 104 cells and produces 14 live debris pieces. `footpaths-kerb-crossing.log`: normal movement crosses the kerb and ends grounded.
- Build and production pixel-readback smoke pass without console errors. Before/after captures: `footpaths-production-street.png`, `footpaths-production-slabs.png`, `footpaths-production-broken.png` under `output/iterate/`.
- Regression fixes preserve actual sewer entry/escape through openings in the stairwell lining, and remove the 23 cm grounded hover exposed beside the den. Hopping remains free. The ground-aim test now distinguishes low vehicle panels from terrain.
- Full suite: 156/164 passed before correcting aiming classification, sewer access and grounded settling (`output/iterate/footpaths-full-suite.log`). Final affected rerun: 65/68 passed, including all five footpath checks and those corrections (`footpaths-final-regression.log`). The three remaining failures are the existing interrupted feast and two draw-call budgets; two existing rig failures also remain in the full suite (JIM-03, JIM-48, JIM-49).
- Visual scale and movement feel still require Chris's playtest at `http://127.0.0.1:4174`.

## Smooth road follow-up — JIM-86, 2026-10-04

The two-metre planning grid no longer supplies visible street edges. Exact district frames/polygon borders classify the surface; shared top and kerb vertices fit those outlines. Coarse ground tiles remain away from fitted edges, and the original 22 cm cells still control destruction. Monotone curved grades ease the former eight-metre planar pitch joins, with level junctions and cross-sections. Contact queries use the same continuous surface. Building lot checks and landmark approaches respect it; pedestrian nodes target footpath centres.

All 114 units and 39 unique adjacent browser checks pass across targeted runs; the final layout/paving/traffic/walking batch passes 27/27. New outline/pitch/seam reproductions failed before their repairs. Rendered kerb/contact differences stay below 3 cm, roads still crater, and the original paving streaming/restart checks pass. The denser district-join fixture retains its original <1 cm error bound and >500 comparisons. Build/production pixel smoke and final original-rig views are console-clean. Evidence: `output/iterate/road-*`; inspected views are `road-{diagonal,hill,spawn}-verified.png`.

The final serial 960×600 Medium CPU-update/render-submission sample is 15.5 / 16.8 ms median/p95 on a street and 38.4 / 51.6 ms on a maximum-size roll. This is not presented FPS or a performance improvement claim; JIM-48 and giant visual JIM-69 remain open. JIM-87 separately repairs stale terrain being used to place restart bins. Chris's road appearance and movement-feel approval remains outstanding.
