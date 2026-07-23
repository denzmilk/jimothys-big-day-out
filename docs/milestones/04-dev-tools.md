# Milestone 04: Dev tools — tuning, keybinds, level editing, camera try-out

## Status

in-progress

## Objective

Unblock hands-on tuning: an in-game dev panel that exposes live sliders for every tuned constant, rebindable keys with a live input debug view (Chris reports W/Space not registering on his machine — the debug view makes the cause visible), level tools to spawn/remove/export trash-can layouts and resize the block, and a pointer-lock toggle with a mouse-orbit camera mode so camera controls can be play-tested. Also hardens input to physical key codes (`e.code`) so keyboard layout can't break movement.

## Scope

- InputSystem rework: `e.code`-based, driven by a rebindable `KEYBINDS` map in Constants; ignores keys typed into form fields; tracks mouse deltas under pointer lock; exposes gamepad state for debugging.
- DevTools panel (`src/ui/DevTools.js`, plain DOM): toggled with Backquote or the ⚙ button.
  - **Tune tab**: slider + number input for tunable constants (player, camera, trash cans, scoring, world), mutating the Constants objects live; overrides persist to localStorage; copyable; reset button.
  - **Keys tab**: live input debug (pressed codes, move vector, gamepad, pointer-lock state) + click-a-chip-then-press-a-key rebinding, persisted.
  - **Level tab**: spawn can ahead of Jimothy, remove nearest can, reset layout, export current layout as `POSITIONS`-style JSON (clipboard + textarea); block-bounds slider rebuilds walls live.
- Pointer lock: KeyL (rebindable) toggles; while locked the camera switches to mouse-orbit around Jimothy (yaw + clamped pitch, tunable sensitivity); unlocking hands back to the trailing follow cam without a snap.
- Live-apply hooks for constants that are baked at construction: camera FOV, world gravity, can mass, block bounds.

## Out of scope

- Full level editor (drag placement, saving multiple layouts) — export-to-JSON is the persistence path into `Constants.js`.
- Gamepad rebinding (buttons are constants; revisit if needed).
- Shipping the panel hidden from players (it's a dev build tool; gating it is a deploy-milestone concern).

## Dependencies

- **Depends on:** milestone 01
- **Blocks:** none (02/03 proceed regardless; tuning benefits everything)

## Acceptance criteria

- [x] Backquote toggles the dev panel — test: `tests/devtools.spec.js::panel toggles`
- [x] Changing SPEED in the Tune tab changes measured movement speed, and the override survives a reload — test: `tests/devtools.spec.js::speed tuning changes movement and persists`
- [x] Rebinding FORWARD via the Keys tab makes the new key move Jimothy and the old key inert — test: `tests/devtools.spec.js::rebind forward key`
- [x] Spawn/remove can buttons add/remove a can near Jimothy — test: `tests/devtools.spec.js::spawn and remove can`
- [x] Export layout produces `POSITIONS`-style JSON for all current cans — test: `tests/devtools.spec.js::export layout`
- [x] KeyL enters pointer lock; camera switches to orbit mode and mouse X orbits it (lock API stubbed in test) — test: `tests/devtools.spec.js::pointer lock orbit`
- [x] Input debug shows currently pressed key codes — test: `tests/devtools.spec.js::input debug`
- [x] Always-on diag strip shows RAF frame counter, received codes, move vector, velocity, position — tests: `tests/diag.spec.js::diag strip shows frames ticking`, `::diag strip shows key codes and movement` *(appended 2026-07-23: W/Up still dead on Chris's machine; strip pinpoints which input layer fails there)*
- [x] Clicks without any key events ever received show a "keyboard not detected" hint; first key clears it — test: `tests/diag.spec.js::keyboard hint appears on click without keys and clears on first key`
- [x] A zeroed/out-of-range tuning override in storage self-heals on load (clamped to the tunable's range) instead of freezing movement — test: `tests/diag.spec.js::movement survives a zeroed speed override in storage` *(appended 2026-07-23: root-cause fix for Chris's mv-ok/vel-0 report)*
- [x] Typed tuning values clamp to the tunable's [min, max] — test: `tests/diag.spec.js::typing an out-of-range tuning value clamps instead of breaking movement`
- [x] Diag strip includes per-frame delta (`dt:`) and live speed constant (`spd:`) — test: `tests/diag.spec.js::diag shows nonzero frame delta and current speed constant`
- [ ] Bounds slider visibly resizes the block walls — verified by user playtest
- [ ] Orbit camera feel + whether W/Space now register on Chris's machine — verified by user playtest

## Exit condition

User presses Backquote → panel opens; drags a speed slider and immediately waddles faster; rebinds a key and it works; spawns cans into a layout they like and copies it as JSON; presses L and orbits the camera around Jimothy with the mouse.

## Test plan

Failing Playwright specs first (`tests/devtools.spec.js`) — pointer lock stubbed via init script since headless Chromium can't truly capture the mouse. Manual playtest: Chris checks the Keys tab debug while pressing W/Space (diagnoses his input issue), tunes movement feel, tries orbit camera. Regression: `npm run test:smoke && npx playwright test`.

## Notes

- Dev-tool mutations go through the EventBus (`dev:*` events) — the panel never reaches into gameplay modules directly.
- Runtime overrides persist in localStorage under `jimothy-dev`; "copy JSON" is the path for baking chosen values back into `Constants.js` permanently. Constants stays the source of truth for defaults.
- Implementation notes (2026-07-23):
  - UX bug caught by the specs: a focused tuning field kept swallowing gameplay keys after closing the panel — `toggle()` now blurs panel focus on close.
  - Rebind capture uses a capture-phase one-shot keydown so the pressed key never leaks into the InputSystem.
  - Values baked at construction get live-apply hooks: camera FOV (reprojection), world gravity, can mass (`updateMassProperties`), block bounds (physics + visual wall rebuild).
  - The W/Space repro attempt on the harness worked (live RAF path verified moving) — the issue is machine/environment-specific; the Keys debug tab is the diagnostic.
  - Second round (W/Up still dead for Chris): added the always-on diag strip (bottom-left) + keyboard-not-detected hint + focus hardening (canvas `tabindex=0`, explicit `window.focus()`/`canvas.focus()` on click into the game) for webview/iframe hosts that only deliver keys to a focused document.
  - Third round — root cause found via the strip (`mv:0.0,-1.0` but `vel:0.0`): input fine, acceleration frozen. Two culprits closed at once: (a) tuning overrides could hold 0/out-of-range values (number boxes bypassed slider min/max) and reapplied from localStorage on every load — overrides now clamp to Tunables ranges on both entry and load, so poisoned storage self-heals; (b) `THREE.Timer` replaced with a plain `performance.now()` delta, eliminating any browser-specific zero-delta behaviour. Diag strip now shows `dt:` and `spd:` so either failure is directly visible.
  - Fourth round ("worked once, not after refresh" — stateful, refresh-surviving): (a) keybind overrides now validate on load — an empty/corrupted stored bind list falls back to defaults instead of leaving a key dead forever (tests: `movement survives corrupted keybind overrides in storage`); (b) keyboard now overrides gamepad axes while any direction key is held — a drifting/stuck stick could exactly cancel W (test: `keyboard overrides a drifting gamepad`); (c) diag strip shows `fw:` (live FORWARD binds). Also part of the story: Chris was playtesting against the dev server during active implementation — HMR was reloading half-written code into his tab. A stable production preview now runs on port 4173 for playtests during dev sessions.
  - **Fifth round — TRUE ROOT CAUSE of "moved once, then never again": cannon-es body sleep.** `world.allowSleep` puts idle bodies to sleep after ~1s; a sleeping KINEMATIC body ignores velocity forever (nothing wakes it — we set velocity directly, and kinematic bodies get no collision wake-ups). Stand still >1s → W dead until reload; press W within 1s of load → "worked once". Every earlier test moved immediately after boot, so the suite never saw it — the camera-relative test (which settles 1.5s before moving) reproduced it deterministically. Fix: `allowSleep = false` on the player body only; cans still sleep for perf. Player-adjacent physics bodies must NEVER be sleep-eligible.
  - Camera-relative controls + pull-cam follow landed here (promoted from backlog after Chris's playtest): W/S/A/D are relative to the camera frame (S walks toward camera), and follow yaw derives from the camera→Jimothy line so walking at the camera backs it up rather than flipping controls (test: `W moves away from camera and S toward it after turning`). `CAMERA.TURN_LERP` removed (dead knob under pull-cam).
