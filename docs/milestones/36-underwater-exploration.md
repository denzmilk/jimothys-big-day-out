# Milestone 36: Swim between scattered underwater places

## Status

Planned; approved by Chris, 2026-10-02 (“these as well — go for it”).

## Objective

Swim between scattered underwater places. Implement the approved brief in `docs/backlog.md` in issue-sized changes.

## Dependencies

Depends on: 33, 35.

## Acceptance criteria

- [ ] Dive/surface movement and underwater camera transitions make the seabed accessible and return to land reliable.
- [ ] At least three wreck hull families and four ruin layout families have seeded damage, burial, orientation and growth variation, with deliberate empty space between sites.
- [ ] Kelp/seagrass, schooling fish, seabed creatures and a larger slow swimmer populate suitable habitats; objects have breakage and collection interfaces.
- [ ] Daylight rays respect cover/depth and fade at night; bubbles respond to swimming and selected environmental sources.
- [ ] Streaming, animation, effects, damage and restart stay within the established budgets; inspect several distinct sites and intervening quiet stretches.
- [ ] Visual quality and gameplay feel verified by Chris’s playtest.

## Test plan

Failing behavioural regressions before implementation; loaded assets, deterministic time, console checks and rendered pixel inspection. Verify adjacent interaction and restart; record measured limitations in STATE.

## Out of scope

Unrelated backlog features and changing the net-only loss rule.

## Exit condition

Chris plays the acceptance route described in the approved backlog brief and observes the behaviours above without errors or lost world state.
