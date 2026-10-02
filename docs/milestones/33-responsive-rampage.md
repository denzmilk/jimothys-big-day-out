# Milestone 33: Responsive giant rampages

## Status

Implemented, awaiting Chris’s playtest. Approved by Chris, 2026-10-02 (“these as well — go for it”). See STATE for fixed-distance native timings, scoped regression results and remaining occasional frame hitches.

## Objective

Responsive giant rampages. Implement the approved brief in `docs/backlog.md` in issue-sized changes.

## Dependencies

Depends on: 23–24.

## Acceptance criteria

- [x] Giant headbutts and rolling contacts affect the surfaces they touch; deliberate digging remains controllable.
- [x] Voxel generation, demolition and mesh work are bounded per update; giant travel does not produce the measured synchronous rebuild stalls.
- [x] Quality/draw-distance presets control visible cost; distant silhouettes bridge loaded detail and per-pass culling skips invisible geometry.
- [x] Native graphics route measurements separate CPU and rendering at lean/house/block sizes; sustained travel, damage and restart retain bounded resources.
- [ ] Visual quality and gameplay feel verified by Chris’s playtest.

## Test plan

Failing behavioural regressions before implementation; loaded assets, deterministic time, console checks and rendered pixel inspection. Verify adjacent interaction and restart; record measured limitations in STATE.

## Out of scope

Unrelated backlog features and changing the net-only loss rule.

## Exit condition

Chris plays the acceptance route described in the approved backlog brief and observes the behaviours above without errors or lost world state.

## Foundation verification

Six voxel work checks and 29 adjacent world checks pass. Native Block route: observed maximum frame 2,041.9 → 123.3 ms, p95 439.1 → 60.4 ms; render calls remain over budget. Full profiling and visual sign-off remain open. See STATE for conditions and evidence.
