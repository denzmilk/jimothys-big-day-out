# Milestone 33: Responsive giant rampages

## Status

Planned; approved by Chris, 2026-10-02 (“these as well — go for it”).

## Objective

Responsive giant rampages. Implement the approved brief in `docs/backlog.md` in issue-sized changes.

## Dependencies

Depends on: 23–24.

## Acceptance criteria

- [ ] Giant headbutts and rolling contacts affect the surfaces they touch; deliberate digging remains controllable.
- [ ] Voxel generation, demolition and mesh work are bounded per update; giant travel does not produce the measured synchronous rebuild stalls.
- [ ] Quality/draw-distance presets control visible cost; distant silhouettes bridge loaded detail and per-pass culling skips invisible geometry.
- [ ] Native graphics route measurements separate CPU and rendering at lean/house/block sizes; sustained travel, damage and restart retain bounded resources.
- [ ] Visual quality and gameplay feel verified by Chris’s playtest.

## Test plan

Failing behavioural regressions before implementation; loaded assets, deterministic time, console checks and rendered pixel inspection. Verify adjacent interaction and restart; record measured limitations in STATE.

## Out of scope

Unrelated backlog features and changing the net-only loss rule.

## Exit condition

Chris plays the acceptance route described in the approved backlog brief and observes the behaviours above without errors or lost world state.
