# Milestone 43: Pick up and use food-powered tools

## Status

Implemented, awaiting Chris’s playtest — 2026-10-03.

## Objective

Give Jimothy a physical equipped-tool lifecycle with a first set of eight usable gadgets. This supplies the shared pickup, aiming, energy, owner interruption and effects budgets needed for the full 24-tool arsenal.

## Scope

- One equipped tool; T/LB picks up or swaps, left mouse/RB uses, G/B drops. F remains the fly-camera control.
- Eating refills a separate energy meter; using a tool does not spend fatness or score.
- Power washer, bubble gun, leaf blower, vacuum, food magnet, fire extinguisher, paint sprayer and confetti cannon.
- Grounded physical pickups, visible held models, feedback, heat for actual mischief, clean release/reset and bounded effects.

## Out of scope

- The remaining 16 tools (44), landmarks (45), food tiers (40), tourists (41), drivers (42).
- Permanent inventory, weapon upgrading and new loss conditions.

## Dependencies

- **Depends on:** existing food, prop physics, human models and rolling collection.
- **Blocks:** 44 and landmark tool caches in 45.

## Acceptance criteria

- [x] Pick up, use, swap and drop real modelled tools through keyboard/mouse and gamepad, with visible equipment and energy feedback — test: `tests/tools.spec.js`.
- [x] Eating refills tool energy without reducing earned fatness; no energy means no effect, and pause/capture/fly/rolling suppress use — test: `tests/tools.spec.js`.
- [x] Water/air move reachable props, suction gathers reachable food, bubbles temporarily lift people, paint marks targets and confetti startles nearby people; walls block targeting — test: `tests/tools-effects.spec.js`.
- [x] Physics/AI ownership resumes after interruption, collection and release, with no duplicated people or bodies — test: `tests/tools-effects.spec.js`.
- [x] Tool models load with editable Blender sources; nearby pickups/effects stay bounded, destruction removes support and restart resets resources — test: `tests/tools.spec.js`.
- [ ] Chris approves held-tool placement, controls and readability — verified by user playtest.

## Exit condition

Chris picks up a power washer → pushes a bin, eats its food to refill energy, swaps to a bubble gun and briefly floats a pursuer before releasing them alive.

## Test plan

Failing browser behaviour checks first. Inspect Blender exports and native loaded-rig held/use/drop views. Run input, collection, food, capture, physics and restart regressions, build and production pixel smoke. Record native timing with tools active.

## Notes

Twenty-four is the implementation roster target, exceeding Chris’s minimum of twenty different tools. Shared effect families must still produce distinct useful behaviours; colour variants do not count. Design reference, exact prompt, Blender recipe/source and model manifest live under `assets/` and `tools/`.

## Implementation evidence

The five initial behaviour checks failed before implementation. Final regression: 23 passing tool/input/food/contact/ragdoll/capture/street/restart checks; all 67 unit checks pass. Build and production pixel smoke pass with no console errors. Original-rig held views and the full 24-model export sheet were inspected. The first eight behaviours are enabled here; the other sixteen exports are prepared for 44.

Native Chrome/Metal, 1280×800, lean stationary washer firing, military disabled: update plus render submission median 8.8 ms, p95 9.8, worst 23.2, 144 draw calls. This is a local microbenchmark, not an FPS or giant-rampage claim. Evidence: `output/iterate/tools-*`, `tool-held-*.png`, `tool-model-gallery.png`. Pickup models use a side mount; anatomical hand gripping and detailed weathering are not claimed.
