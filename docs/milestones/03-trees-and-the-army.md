# Milestone 03: Trees & the army

## Status

planned

## Objective

Deliver the two signature absurdities: climbable trees full of weird loot that ground pursuers can't reach, and the tier 4–5 escalation where the police cordon arrives and then the army rolls in — tanks whose shells ragdoll-launch Jimothy (out of trees included) but can never end the run. This is the clip-generating milestone.

## Scope

- Climbable trees: climb volume/interaction, Jimothy perches; paparazzi and animal control wait below (cannot climb); heat does not drain in a tree.
- Tree loot: nests, eggs, pants, weird finds — `SCORE.TREE_LOOT` points, "JIMOTHY ACQUIRES PANTS" stingers, loot raises heat.
- Tier 4: police cordon — more/faster pursuers, simple roadblocks.
- Tier 5: army — tank(s) spawn, aim, and fire shells on a cooldown.
- Shell impact: switch Jimothy kinematic → dynamic, apply comedy impulse (can dislodge from trees), drop combo, recover control on landing (ADR-0002 handoff).
- Screen shake + impact feedback for shells (slop-tier juice only; full polish later).

## Out of scope

- Pants as wearable cosmetic (backlog: decide cosmetic vs score-only).
- Destructible environment from shells.
- Any new pursuer types beyond police-as-more-pursuers.

## Dependencies

- **Depends on:** milestone 02
- **Blocks:** none (asset/audio/deploy milestones can follow in any order)

## Acceptance criteria

- [ ] Jimothy can climb a tree and perch; pursuers hold position below and never enter the tree — test: `tests/escalation.spec.js::tree is safe from ground pursuers`
- [ ] Looting a tree find awards `TREE_LOOT × combo` points and raises heat — test: `tests/escalation.spec.js::tree loot scores`
- [ ] Heat does not decay while in a tree — test: `tests/escalation.spec.js::no decay in tree`
- [ ] Tier 4 increases pursuer count/speed per Constants — test: `tests/escalation.spec.js::police cordon`
- [ ] Tier 5 spawns a tank that fires shells on cooldown — test: `tests/escalation.spec.js::tank fires`
- [ ] Shell hit launches Jimothy (kinematic→dynamic→recovered), resets combo, never sets `game.netted` — test: `tests/escalation.spec.js::shells launch but never kill`
- [ ] Shell hit while perched knocks Jimothy out of the tree — test: `tests/escalation.spec.js::shelled out of tree`
- [ ] Getting blasted across the block is funny, not frustrating (launch arc, recovery time) — verified by user playtest

## Exit condition

User survives to tier 5 → a tank shell blasts Jimothy out of a tree and across the block in a ragdoll arc → he lands, recovers, and keeps rampaging — until the net (and only the net) ends the day.

## Test plan

Failing Playwright specs first (`tests/escalation.spec.js`); shell trajectories and launch recovery asserted via `advanceTime` determinism. Manual playtest: Chris chases a max-chaos run to tier 5, judging launch comedy and tree-perch standoffs. Regression: `npm run test:smoke && npx playwright test`.

## Notes

- Raycast-assisted shell hits per ADR-0002 (tunneling mitigation).
- Tank/shell models are placeholder boxes this milestone; real CC0 models arrive with the asset milestone.
- Backlog candidates surfaced by this design: pants cosmetic, tree score-banking, shell knock-over of cans for bonus chaos.
