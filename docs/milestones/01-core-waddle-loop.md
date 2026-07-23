# Milestone 01: Core waddle loop

## Status

in-progress — implementation complete and green, awaiting Chris's playtest sign-off

## Objective

Make the moment-to-moment loop playable and fun with placeholder shapes: waddle Jimothy around the block, bonk trash cans over with real physics, eat the spilled snacks, and watch score and combo climb on the HUD. This proves the game before any art, audio, or pursuer AI spend, and it forces the three foundational systems (input, physics, camera) into place first.

## Scope

- `InputSystem` (`src/systems/`): keyboard (WASD + Space hop + Shift scurry) and Gamepad API, merged into one analog interface per the threejs-game input pattern.
- `PhysicsSystem` (`src/systems/`): cannon-es world per ADR-0002 — fixed-step, synced to meshes, driven from `Game.update` and `advanceTime`.
- Kinematic Jimothy controller: arcade-floaty movement + hop, waddle-bob animation, third-person follow camera that keeps him on screen.
- `LevelBuilder` (`src/level/`): flat block with ~10 dynamic-body trash cans and simple boundary walls (placeholder geometry).
- Can tipping: bonking a can knocks it over (rigid-body tumble) and spills 3–5 snack pickups.
- Snacks: pickup on contact, score per snack, combo multiplier with a timeout window, "JIMOTHY ACQUIRES X" popup stinger.
- HUD wiring: live score/combo (heat stars stay static at 0 this milestone).

## Out of scope

- Heat, paparazzi, animal control, net, game-over, restart (milestone 02).
- Trees, climbing, tree loot, police/army tiers, tanks (milestone 03).
- Real models, photo textures, audio, deploy (post-loop milestones).
- Launched/dynamic Jimothy state (no shells yet — kinematic only this milestone).

## Dependencies

- **Depends on:** ADR-0001, ADR-0002 (scaffold complete)
- **Blocks:** milestone 02, milestone 03

## Acceptance criteria

- [x] WASD moves Jimothy on the block; position changes are visible in `render_game_to_text()` — test: `tests/gameplay.spec.js::keyboard moves jimothy`
- [x] Gamepad left stick moves Jimothy (Gamepad API mockable in test) — test: `tests/gameplay.spec.js::gamepad moves jimothy`
- [x] Follow camera tracks Jimothy within configured distance/height bounds — test: `tests/gameplay.spec.js::camera follows jimothy`
- [x] Running into a trash can tips it (can body leaves upright orientation) and spawns snack pickups — test: `tests/gameplay.spec.js::can tips and spills snacks`
- [x] Collecting a snack increments score by `SCORE.SNACK × combo`; combo resets after `COMBO_WINDOW_SECONDS` without a pickup (verified via `advanceTime`) — test: `tests/gameplay.spec.js::score and combo`
- [x] HUD shows live score and combo — test: `tests/gameplay.spec.js::hud shows live score and combo`
- [ ] Movement feel: floaty-arcade waddle with momentum, hop feels punchy — verified by user playtest
- [x] All tuned values live in `Constants.js`; boot smoke test stays green (`npm run test:smoke`)

## Exit condition

User opens `npm run dev`, waddles Jimothy into a trash can → the can tumbles over, snacks spill out, eating them makes the score climb with a combo multiplier and popup text.

## Test plan

Write `tests/gameplay.spec.js` (Playwright, per qa-game) first, asserting the ACs above via `render_game_to_text()` + `advanceTime()`; confirm each fails for the right reason before implementing. Manual playtest: Chris runs `npm run dev`, checks waddle feel, hop, camera, and can-tipping comedy. Regression command before declaring done: `npm run test:smoke && npx playwright test`.

## Notes

- Governed by ADR-0002: Jimothy kinematic under control; cans dynamic. The kinematic→dynamic launch handoff is milestone 03's problem — don't build it early.
- Popup stingers can be plain DOM elements; no UI framework (tech.md out-of-scope deps).
- Implementation notes (2026-07-23):
  - Red-then-green honored: all 6 specs written and failing before implementation.
  - Cans are physics **boxes** with cylinder visuals — boxes tumble stabler/cheaper in cannon-es than convex cylinders.
  - Snacks are non-physics pickups in a deterministic ring (tests can target positions); shared geometry/material, so removal doesn't dispose.
  - First `advanceTime()` call freezes wall-clock updates (`Game.manualTime`) so sim time is fully test-controlled — combo-window tests would be flaky otherwise.
  - One spec assumption fixed during green run: Jimothy can eat spilled snacks during the approach, so the spill assertion counts `remaining + snacksEaten` (new lifetime counter on GameState, also useful for M02 heat-per-snack).
  - Bonk impulse has a per-can cooldown (`BONK_COOLDOWN_SECONDS`) so overlapping frames don't rocket cans.
