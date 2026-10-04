# M63 — Finite tool supplies and physical empty discard

**Status:** implemented, awaiting Chris's playtest. Authorised sequential playground step 7, following M62 and JIM-101.

Pick up a tool → see its remaining supply → use it until empty → watch Jimothy toss the spent model away while its final effect completes. Food energy and the item's supply are separate resources.

## Scope and acceptance

- [x] All 24 pickups have finite, named supplies and per-use costs in Constants.js. Equipped supply is exposed in GameState, the HUD and the text snapshot.
- [x] Successful use, including a valid miss, spends exactly one defined amount. Cooldown, insufficient energy, suppressed input, invalid movement/anchor/tow/deployment and full effect pools spend nothing and show a brief reason where useful.
- [x] Drop/swap, eating, carrying/releasing and travelling retain the same amount. Empty items cannot be equipped; new runs restore the catalogue's full supplies.
- [x] Exhaustion tosses the actual model once through PhysicsSystem, clears equipment/tow/rope ownership, and preserves the final projectile, status or finite movement impulse. Spent items remain bounded physical objects that can be knocked about or collected.
- [x] Keyboard/gamepad, pause/focus/capture, reset and 30/60/120 Hz supply cadence remain reliable. Pickup, dry-use and empty cues share a bounded tool audio bank, with no stuck voices.
- [x] Focused/adjacent tests, native original-rig/HUD/discard inspection, build and rendered smoke pass. Resources remain bounded.
- [ ] Chris playtests supply pacing, throw readability and the cue mix.

## Boundaries

This delivers item supplies, transaction validation and supply cues. JIM-88's full 24-tool delivery/particle/SFX contracts remain open and follow in coherent tool families. Existing food energy still comes from eating; food cannot replenish ammunition. Fatness-funded skills, hoards/purge and later equipment stay in the recorded queue.

Depends on M43 tools, M53 vehicle/player ownership, M57 ragdolls and M62 human water releases. No asset replacement is needed: keep the existing editable Blender tool models and physical bodies.


## Review evidence — 2026-10-05

All eight focused supply cases and nineteen existing tool/water-release cases pass, along with 168 units, build and production pixel smoke. Tests cover every catalogue profile, HUD/state, rejection versus valid misses, physical discard, last rocket/movement, ownership/refill prevention, three clean restarts, keyboard/gamepad and interruptions. Empty models reuse their original bodies; no growing debris pool is added.

The six-second held washer uses 51/50/50 charges at 30/60/120 Hz, within the one-action sampling boundary. Cue analyser RMS is 0.046 pickup / 0.172 dry / 0.135 empty; peak voices are eight and blur/pause/reset each leave zero. Native original-rig frames and HUD show the amount changing, then the spent launcher tumbling about four metres away while the final rocket continues. Native console and production console are clean; sky/ground pixel readback differs.

The original eight cases failed before implementation. Review corrected two fixture assumptions: radius is a read-only growth result, so the oversize test now uses actual fatness; previously dropped tools were valid tow targets, so the invalid-target fixture moves into empty space. Assertions were not relaxed. No speaker-mix or gameplay-feel sign-off is claimed.

Evidence: `output/iterate/tool-supplies-{red,input-red,first,validation,validation2,final,adjacent,units,build,smoke}.log`, `tool-supplies-native/{discard.mp4,report.json,hud-30.png,hud-50.png}`. Source fixture: `tests/tool-supplies.spec.js`; native inspector: `tools/inspect-tool-supplies.mjs`. Optional empty-tool playtest question is pending.
