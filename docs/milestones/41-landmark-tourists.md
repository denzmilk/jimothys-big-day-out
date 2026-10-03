# Milestone 41: Tourists visit and photograph landmarks

## Status

Planned — Chris approved the order on 2026-10-03.

## Objective

Give pedestrian movement a visible purpose around points of interest. People travel to the food landmarks, gather with space between them, look at attractions, take selfies and move on. Destruction interrupts their visit.

## Scope

- Bounded visitor population using existing MPFB variety, grounding and ragdolls.
- Routes to valid viewing spots, idle/looking/selfie actions and visit turnover.
- Fleeing and collection interruptions; destroyed attractions stop attracting new visitors.

## Out of scope

- Dialogue, quests, social simulation and vehicle ownership (milestone 42).

## Dependencies

- **Depends on:** 40, 26, 29, 38.
- **Blocks:** 42's destination visits.

## Acceptance criteria

- [ ] Tourists reach a landmark viewing spot, face the attraction, pause/take a selfie and leave — test: `tests/tourist-visits.spec.js`.
- [ ] People avoid occupied spots, walls and water, and retain grounded feet — test: `tests/tourist-visits.spec.js`.
- [ ] Threats, ragdolls and rolling collection interrupt visits and recover cleanly — test: `tests/tourist-visits.spec.js`.
- [ ] Consumed/destroyed landmarks invalidate destinations; travel and restart keep actor counts bounded — test: `tests/tourist-visits.spec.js`.
- [ ] Chris recognises the visiting/selfie behaviour during normal play — verified by user playtest.

## Exit condition

Chris approaches an intact landmark → sees people arriving, posing and taking selfies, then sees them react when he damages it.

## Test plan

Failing behaviour tests first, real-rig visual inspection, pedestrian/footing/ragdoll/food regressions, native timing, build and production pixel smoke.

## Notes

Source: Chris, 2026-10-03, “tourist pedestrians visiting, taking selfies”.
