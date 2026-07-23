# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-07-23 by Claude (milestones 01 + 04 implementation and the input-bug saga)

## Current phase

development (scaffold complete)

## Current milestone

Milestone 02 (heat & pursuers) — implementation complete, 29/29 specs green, staged, awaiting Chris's chase-pacing playtest + commit approval. Ladder after: fatness system (core-fantasy) → 03 trees & the army → slop-rig/splitter (blocked on Chris's jimothy.glb) → civilians → powerups. Backlog holds the detail.

## Last action

Milestone 02 implemented red-then-green (7 new specs in `tests/heat.spec.js`, helpers extracted to `tests/helpers.mjs` with `seedTuning`): HeatSystem (event→constant SOURCES map, tier thresholds, hidden decay), Pursuers (physics-free steering — paparazzi loiter at photo range and flash-stun at tier 2+, animal controller with torus net at tier 3+, round-robin spawns, all freeze while Jimothy hides), hide-spot bushes (Jimothy fades to 50% opacity), stun (input suppression + comedy wobble + screen-flash overlay), full run lifecycle (netted → capture screen "FINAL FATNESS" → R/button restart, orchestrator-ordered reset, best score in localStorage). HUD heat stars live. 29/29 specs + smoke green, build passes, visuals verified (`output/iterate/m02-chase.png`, `m02-gameover.png`). Staged, not committed.

## Next step

Chris playtests the chase on the preview build: tip ~2 cans → paparazzi, ~4 → flashes, ~7 → animal control; check tier-3 pacing (tense but escapable via Shift-scurry and bushes) → tune PAPARAZZI/ANIMAL_CONTROL/HEAT sliders in the dev panel if needed → commit on approval → next milestone: fatness system (body scale from snacksEaten + trade-offs).

## Blockers

- Milestone 01 feel AC + milestone 04 playtest ACs + commit approval need Chris's hands-on session.
- Jimothy GLB: Chris generates in the Meshy web app (Meshy 5) and exports to `public/assets/models/jimothy.glb` — needed by the asset milestone (backlog), not by the current work.

## Notes for next session

- `npx playwright test` now auto-starts the dev server (playwright.config.js webServer, reuses a running one). The backlog item for this is done — tick it when touching backlog.md.
- Headless screenshots composite the WebGL canvas black under SwiftShader — assert/capture via canvas pixel readback (see tests/boot-smoke.mjs and output/iterate capture pattern); don't chase the "black screenshot" as a bug.
- The FIRST `advanceTime()` call switches the game to manual time (RAF renders but stops updating). Deliberate — deterministic tests. A human playtest session never calls it, so live play is unaffected.
- The render loop uses a plain `performance.now()` delta (not `THREE.Clock` — deprecated — and not `THREE.Timer`, removed while chasing a machine-specific frozen-movement bug). Keep it that way.
- Tuning overrides (localStorage `jimothy-dev`) clamp to Tunables ranges on load AND on entry; keybind overrides validate on load (empty/corrupt lists restore defaults). Chris's "W doesn't move" saga: zeroed override + possibly gamepad drift + playtesting against an HMR-reloading dev server mid-implementation. Never remove the clamps/validation; keyboard overrides gamepad axes while direction keys are held.
- For playtests during active dev sessions, use the production preview (`npm run build && npm run preview -- --port 4173`) so HMR can't reload half-written code into the playtest tab.
- **TRUE root cause of "moved once, then never again": cannon-es slept the idle kinematic player body and nothing wakes a kinematic body.** `allowSleep = false` on the player body (milestone 04 notes, fifth round). Any future player-adjacent body (launched-Jimothy dynamic body in M03!) must also be sleep-exempt or explicitly woken.
- Controls are now CAMERA-RELATIVE with a pull-cam follow (yaw from camera→Jimothy line). Test helper `keysToward()` in gameplay.spec.js does the frame conversion — reuse it for any new steering tests.
- Chris wants procedural stretchy-tube legs (backlog) — affects the asset milestone: Meshy export becomes body-only static GLB, no rigging needed.
- GitHub Pages deploy is a later milestone: needs an Actions workflow building `dist/`; `vite.config.js` already uses relative `base: './'` so no path config should be needed.
- House rule: commit/push only on Chris's explicit confirmation.
