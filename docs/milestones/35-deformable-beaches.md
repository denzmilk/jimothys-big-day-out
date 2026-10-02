# Milestone 35: Sand yields along a gradual shoreline

## Status

Planned; approved by Chris, 2026-10-02 (“these as well — go for it”).

## Objective

Sand yields along a gradual shoreline. Implement the approved brief in `docs/backlog.md` in issue-sized changes.

## Dependencies

Depends on: 33.

## Acceptance criteria

- [ ] Dry/wet sand bands, gentle shallows and dunes soften suitable coasts without erasing rocky cliffs or roads.
- [ ] Feet, rolls and impacts deform nearby sand, with bounded settling/grain effects and matching visible/collision surfaces.
- [ ] Walking, wading, swimming and returning ashore work without snags; deformations survive streaming and reset predictably.
- [ ] Visual quality and gameplay feel verified by Chris’s playtest.

## Test plan

Failing behavioural regressions before implementation; loaded assets, deterministic time, console checks and rendered pixel inspection. Verify adjacent interaction and restart; record measured limitations in STATE.

## Out of scope

Unrelated backlog features and changing the net-only loss rule.

## Exit condition

Chris plays the acceptance route described in the approved backlog brief and observes the behaviours above without errors or lost world state.
