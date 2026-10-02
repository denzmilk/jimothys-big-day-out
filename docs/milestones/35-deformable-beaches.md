# Milestone 35: Sand yields along a gradual shoreline

## Status

Implemented, awaiting Chris’s playtest; approved by Chris, 2026-10-02 (“these as well — go for it”).

## Objective

Sand yields along a gradual shoreline. Implement the approved brief in `docs/backlog.md` in issue-sized changes.

## Dependencies

Depends on: 33.

## Acceptance criteria

- [x] Dry/wet sand bands, gentle shallows and dunes soften suitable coasts without erasing rocky cliffs or roads.
- [x] Feet, rolls and impacts deform nearby sand, with bounded settling/grain effects and matching visible/collision surfaces.
- [x] Walking, wading, swimming and returning ashore work without snags; deformations survive streaming and reset predictably.
- [ ] Visual quality and gameplay feel verified by Chris’s playtest.

## Test plan

Failing behavioural regressions before implementation; loaded assets, deterministic time, console checks and rendered pixel inspection. Verify adjacent interaction and restart; record measured limitations in STATE.

## Out of scope

Unrelated backlog features and changing the net-only loss rule.

## Exit condition

Chris plays the acceptance route described in the approved backlog brief and observes the behaviours above without errors or lost world state.

## Implementation and evidence

Five authored beach regions gain dry sand, a blended wet band, modest dunes and longer outer shallows. Roads and hill profiles remain authoritative. Foot/roll compaction uses a sparse .22 m field, .16 m maximum depth, 768 stamp cells and 256 settling cells per update, a 256² nearby texture and a 131,072-cell persistence cap. The upload window moves without deleting tracks; at the cap, new cells are refused rather than removing existing tracks. A 160-grain pool handles kicked sand. Full digging still removes voxels beneath the deformable skin.

Four sand/contact unit checks pass, including rendered triangle versus collision agreement within 1.5 cm and correctly disabling the skin over a dug hole. The loaded-footprint regression and all 14 water/terrain cases pass (`beach-green.log`); walking → swimming → shore is preserved. Native beach/track captures are under `output/iterate/beach-*.png`, with no console errors. Grounding/build/rendered smoke results are recorded in STATE. This is shallow surface compaction and settling, not a granular fluid solver.
