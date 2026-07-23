# Milestone 02: Heat & pursuers

> ℹ️ Affected by the 2026-07-23 design evolution (gameplan updated): heat is explicitly CHAOS-driven, and future sources include scaring wandering locals (backlog: civilians) — build the heat system so sources are data-driven/extensible, but this milestone's scope stays cans + pursuers. Score/fatness stays chaos-independent.

## Status

done

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

- [x] Tipping cans raises heat points and crossing thresholds raises tier + HUD stars; eating snacks does NOT raise heat *(AC amended 2026-07-23 per the fat-is-score/chaos-is-heat gameplan change)* — test: `tests/heat.spec.js::heat rises with chaos but not with eating`
- [x] Tier 1 spawns paparazzi that move toward Jimothy — test: `tests/heat.spec.js::paparazzi spawn at tier 1 and close in`
- [x] Tier 2 flash-stun staggers Jimothy briefly (input suppressed, then restored) — test: `tests/heat.spec.js::tier-2 camera flash stuns jimothy`
- [x] Tier 3 spawns the animal-control chaser; net contact sets `game.netted` and ends the run — test: `tests/heat.spec.js::animal control nets jimothy and ends the run`
- [x] Hiding in a hide spot drains heat over time and sheds pursuers (via `advanceTime`) — test: `tests/heat.spec.js::hiding drains heat and sheds pursuers`
- [x] Game-over shows final + best score; best persists in localStorage — test: `tests/heat.spec.js::best score persists across reload`
- [x] Restart restores a clean slate: state reset, no duplicate pursuers, no console errors, and Jimothy still moves — test: `tests/heat.spec.js::restart restores a clean slate and jimothy still moves`
- [x] Chase pacing feels tense but fair at tier 3 — verified by user playtest *(2026-07-23: Chris — "felt okay"; revisit tuning as content grows)*

## Exit condition

User rampages until heat hits tier 3 → animal control chases and nets Jimothy → game-over screen shows score vs. best → restart drops them straight into a fresh run.

## Test plan

Failing Playwright specs first (`tests/heat.spec.js`) driven by `render_game_to_text()` + `advanceTime()`; stun/decay timings asserted deterministically. Manual playtest: Chris plays three full runs checking escalation pacing, stun comedy, and restart cleanliness. Regression: `npm run test:smoke && npx playwright test`.

## Notes

- The net is the ONLY run-ender (gameplan rule) — resist adding health/damage.
- Keep pursuer counts/speeds per tier in `Constants.js`; expect heavy tuning.
- Implementation notes (2026-07-23):
  - HeatSystem sources are an event→constant map (`SOURCES`) — adding civilian-scare chaos later is one entry + one constant, per the affected-by note.
  - Pursuers have NO physics bodies: direct mesh steering + distance checks — deterministic under `advanceTime` and immune to the body-sleep class of bug. Spawn points round-robin from `PURSUER_SPAWN_POINTS` for the same reason.
  - Hidden = in a bush volume: pursuers freeze, flashes stop, the net can't land, heat drains — hiding is a full pressure valve. Jimothy fades to 50% opacity as the read.
  - Restart order lives in the Game orchestrator (reset state → reset systems → set playing), not in per-system subscribers, to avoid listener-order races.
  - Tier thresholds rebalanced to [0,10,20,35,60,100] with PER_CAN_TIPPED=5 so tier 3 is reachable from cans alone; tiers 4–5 stay out of reach until milestone 03 adds chaos sources. Heat/paparazzi/animal-control all dev-panel tunable.
  - Specs seed tuning through localStorage dev overrides (e.g. one can = tier 3) — fast, deterministic scenario setup via `tests/helpers.mjs::seedTuning`.
