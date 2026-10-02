# Milestone 34: Military responds to giant destruction

## Status

Implemented, awaiting Chris’s playtest; approved by Chris, 2026-10-02 (“these as well — go for it”).

## Objective

Military responds to giant destruction. Implement the approved brief in `docs/backlog.md` in issue-sized changes.

## Dependencies

Depends on: 33.

## Acceptance criteria

- [x] Heat/size thresholds and cooldowns produce bounded tank and jet escalation, with visible approach and attack warnings.
- [x] Licensed imported vehicle assets have correct headings, world scale, breakage and source/licence records.
- [x] Shells and jet impacts use bounded damage, size-aware knockback and control recovery; only the net ends runs.
- [x] Military state/projectiles/effects reset cleanly, stay within distance/population budgets and are exposed in the snapshot.
- [ ] Visual quality and gameplay feel verified by Chris’s playtest.

## Test plan

Failing behavioural regressions before implementation; loaded assets, deterministic time, console checks and rendered pixel inspection. Verify adjacent interaction and restart; record measured limitations in STATE.

## Out of scope

Unrelated backlog features and changing the net-only loss rule.

## Exit condition

Chris plays the acceptance route described in the approved backlog brief and observes the behaviours above without errors or lost world state.

## Evidence

Six military gameplay cases pass, including tier/size gates, combo reset, dynamic recovery, road contact, barrel aim, wall interception, actual rolling collection and restart (`output/iterate/military-rules-green.log`). Twelve projectile/physics/explosion regressions and the swept sphere unit case pass. Build and production rendered smoke pass, with no console errors. Native Chrome/Metal, M5 Pro, 1280×800, loaded rig, 12-second Block battle: median frame 14 ms, p95 16.8 ms, worst 35.4 ms; two shots/impacts and one recovered launch (`military-native-final.log`). Tank/jet views and battle captures were inspected. Timing is a bounded stationary battle, not a whole-game frame-rate guarantee.
