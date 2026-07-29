# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-07-23 by Claude (milestones 01 + 04 implementation and the input-bug saga)

## Current phase

development (scaffold complete)

## Current milestone

Milestone 06 (slop-rig) — implemented and green (39/39): Chris's Meshy GLB (40 MB, 800k tris) loads, runtime-splits into head/body/tail (RIG panel sliders re-cut live), placeholder hides, stretchy tube legs trot in diagonal pairs, all fatness/jiggle animation flows through the slots. Milestones 05 + trade-offs also staged and green. All awaiting Chris's movement playtest + commit. Ladder after: 03 trees & the army → civilians → powerups. Backlog: GLB size optimization.

## Last action

Milestone 05 implemented red-then-green (6 specs in `tests/fatness.spec.js`): two-tier FOODS (scraps scoop on the move; feasts channel 1.2s standing still, reset on interrupt, "NOM NOM NOM…" stinger, spinning pizza puck), fatness stat fed by food fat values (combo multiplies points, never fat), asymptotic wide-load body distortion + bite-kicked jiggle spring + speed-scaled jelly wobble (applied as scale on the body slot so the slop-rig inherits it), HUD FAT readout, FATNESS dev-panel group. Test infra hardened: manual time from frame zero (`__MANUAL_TIME__`), bonk-tolerant assertions, 120s timeout / 4 workers — remaining flakes were pure wall-clock timeouts, sim is deterministic; clean idle-machine run 35/35 in 2.1m. Visual verified (`output/iterate/m05-fat-jimothy.png` — widthScale 1.42 at fatness 22). Staged, not committed.

## Next step

Chris playtests THE REAL JIMOTHY on the preview build: waddle/scurry gait feel (LEGS sliders), hop leg-stretch, cut-plane placement (RIG sliders), model facing direction (flip NOSE_POSITIVE_Z to 0 if he walks backwards), fatness jiggle on the real model, plus the M05 food pacing + trade-offs → commit on approval → milestone 03.

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
