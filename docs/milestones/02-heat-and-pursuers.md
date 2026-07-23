# Milestone 02: Heat & pursuers

## Status

planned

## Objective

Add the pressure that turns snack collecting into a game: heat tiers 0–3, paparazzi that swarm and flash-stun, the animal-control chaser whose net is the run's only ending, hide spots that drain heat, and the full run lifecycle (start → netted → score screen → restart). After this milestone the game is complete as a loop, just without its top-tier absurdity.

## Scope

- Heat system: points from chaos, tier thresholds (`HEAT` constants), decay while hidden; HUD heat stars go live.
- Paparazzi (tier 1–2): spawn/despawn by tier, follow Jimothy, camera-flash stun (comedy stagger) at tier 2.
- Animal control (tier 3): chaser with net; net contact emits `player:netted` → game over.
- Hide spots: bushes/porch volumes; while hidden and unseen, heat drains.
- Run lifecycle: game-over overlay with score vs. best (localStorage), instant restart via `GameState.reset()` — restart-safe, no leaks.
- Chase intensity groundwork: emit tier-change events audio can hook later.

## Out of scope

- Tiers 4–5 (police, army, tanks) — milestone 03.
- Trees as escape/loot spots — milestone 03.
- Pursuer pathfinding beyond simple steering (no navmesh; the block is open).

## Dependencies

- **Depends on:** milestone 01
- **Blocks:** milestone 03

## Acceptance criteria

- [ ] Tipping cans/eating snacks raises heat points; crossing thresholds raises tier and updates HUD stars — test: `tests/heat.spec.js::heat rises with chaos`
- [ ] Tier 1 spawns paparazzi that move toward Jimothy — test: `tests/heat.spec.js::paparazzi spawn and follow`
- [ ] Tier 2 flash-stun staggers Jimothy briefly (input suppressed, then restored) — test: `tests/heat.spec.js::flash stun`
- [ ] Tier 3 spawns the animal-control chaser; net contact sets `game.netted` and ends the run — test: `tests/heat.spec.js::net ends run`
- [ ] Hiding in a hide spot drains heat over time (via `advanceTime`) — test: `tests/heat.spec.js::hidden heat decay`
- [ ] Game-over shows final + best score; best persists in localStorage — test: `tests/heat.spec.js::best score persists`
- [ ] Restart restores a clean slate: state reset, no duplicate pursuers, no console errors — test: `tests/heat.spec.js::restart safe`
- [ ] Chase pacing feels tense but fair at tier 3 — verified by user playtest

## Exit condition

User rampages until heat hits tier 3 → animal control chases and nets Jimothy → game-over screen shows score vs. best → restart drops them straight into a fresh run.

## Test plan

Failing Playwright specs first (`tests/heat.spec.js`) driven by `render_game_to_text()` + `advanceTime()`; stun/decay timings asserted deterministically. Manual playtest: Chris plays three full runs checking escalation pacing, stun comedy, and restart cleanliness. Regression: `npm run test:smoke && npx playwright test`.

## Notes

- The net is the ONLY run-ender (gameplan rule) — resist adding health/damage.
- Keep pursuer counts/speeds per tier in `Constants.js`; expect heavy tuning.
