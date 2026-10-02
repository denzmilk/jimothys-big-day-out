# Milestone 34: Military responds to giant destruction

## Status

Planned; approved by Chris, 2026-10-02 (“these as well — go for it”).

## Objective

Military responds to giant destruction. Implement the approved brief in `docs/backlog.md` in issue-sized changes.

## Dependencies

Depends on: 33.

## Acceptance criteria

- [ ] Heat/size thresholds and cooldowns produce bounded tank and jet escalation, with visible approach and attack warnings.
- [ ] Licensed imported vehicle assets have correct headings, world scale, breakage and source/licence records.
- [ ] Shells and jet impacts use bounded damage, size-aware knockback and control recovery; only the net ends runs.
- [ ] Military state/projectiles/effects reset cleanly, stay within distance/population budgets and are exposed in the snapshot.
- [ ] Visual quality and gameplay feel verified by Chris’s playtest.

## Test plan

Failing behavioural regressions before implementation; loaded assets, deterministic time, console checks and rendered pixel inspection. Verify adjacent interaction and restart; record measured limitations in STATE.

## Out of scope

Unrelated backlog features and changing the net-only loss rule.

## Exit condition

Chris plays the acceptance route described in the approved backlog brief and observes the behaviours above without errors or lost world state.
