# Milestone 40: Grow from scraps to edible landmarks

## Status

Planned — Chris approved this order on 2026-10-03, after the giant destruction repair.

## Objective

Make normal play sustain growth from a small raccoon to the largest tier. Food must stay recognisable and worth pursuing as the camera pulls back. Giant lobster and banana attractions begin as world destinations/buildings and become consumable when Jimothy is large enough.

## Scope

- Size tiers for existing snacks/feasts, larger produce crates and market meals, then edible landmark buildings.
- Reserved, reachable landmark sites in the active island plan, with distinct silhouettes and persistent depletion.
- Physical size gates, clear eating feedback and rewards that bridge the existing growth tiers.
- The farm/market proposal supplies larger food locations; retain its different exposure and escape routes.

## Out of scope

- Usable tools, tourist actions and drivers (the latter two follow in milestones 41–42).
- Replacing the net-only ending or granting food rewards for unrelated demolition.

## Dependencies

- **Depends on:** giant destruction/collection repair; milestones 37–38 and 45; existing food economy.
- **Blocks:** 41.

## Acceptance criteria

- [ ] A normal eating route supplies enough distinct, reachable rewards to progress through the growth tiers without dev controls — test: `tests/food-progression.spec.js`.
- [ ] Larger foods remain readable at their intended player size, with explicit eating and size-gate feedback — test: `tests/food-progression.spec.js`; appearance verified by user playtest.
- [ ] Lobster and banana landmarks occupy valid sites, collide/break as world objects and can be consumed only at the required size — test: `tests/edible-landmarks.spec.js`.
- [ ] Rewards are granted once; partial destruction, travel and restart preserve the correct consumption state — test: `tests/edible-landmarks.spec.js`.
- [ ] Assets, actors, food rendering and work remain bounded — test: `tests/food-progression.spec.js`; native route timing recorded.
- [ ] Chris approves food recognition, progression pace and landmark scale — verified by user playtest.

## Exit condition

Chris eats through progressively larger food locations → reaches a giant landmark, sees why it is now edible, consumes it and grows enough to pursue the next large reward.

## Test plan

Write failing economy/size/consumption tests before implementation. Verify the same route in the rendered game with the original rig, then run food, interaction, streaming, destruction and restart regressions, build and production pixel smoke. Preserve licensed sources and editable Blender exports for new models.

## Notes

Source: Chris, 2026-10-03, “tiered foods”, “giant lobsters, bananas”, “even though they're buildings”. Connect to the farm/market and Seattle landmark entries in backlog; implementation is not yet claimed.
