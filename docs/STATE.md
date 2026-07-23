# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-07-23 by Claude (milestones 01 + 04 implementation and the input-bug saga)

## Current phase

development (scaffold complete)

## Current milestone

Milestones 01 (core waddle loop) and 04 (dev tools + input saga) are DONE — playtest-approved and pushed (`38d7215`). Next up: milestone 02 (heat & pursuers). Ladder after that: fatness system (new, core-fantasy) → 03 trees & the army → slop-rig/splitter (05, blocked on Chris's jimothy.glb) → civilians → powerups. Backlog holds the detail.

## Last action

Milestone 04 (dev tools) implemented red-then-green on top of milestone 01, prompted by Chris reporting W/Space not registering: InputSystem hardened to physical `e.code` with a rebindable `KEYBINDS` map; DevTools panel (Backquote or ⚙) with Tune tab (live sliders for player/camera/can/score/world constants, localStorage persistence, reset), Keys tab (live input debug: pressed codes, move vector, gamepad axes, lock state + click-chip-press-key rebinding), Level tab (spawn can ahead, remove nearest, reset layout, export `POSITIONS` JSON, bounds slider rebuilding walls); KeyL pointer lock toggling a mouse-orbit camera mode (CameraSystem now dual-mode). 13/13 Playwright specs + smoke green, build passes. The W/Space bug did NOT reproduce on the harness (live RAF path verified) — machine-specific; Keys debug tab is the diagnostic. Staged, not committed.

## Next step

Start milestone 02 (heat & pursuers): failing `tests/heat.spec.js` specs first, then heat points/tiers (data-driven sources — see the affected-by note in the milestone doc), paparazzi, flash-stun, animal-control net, hide spots, run lifecycle. Design evolution (2026-07-23, gameplan updated): fat IS the score ("get big and fat without getting captured"), chaos drives heat — fatness milestone follows 02.

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
