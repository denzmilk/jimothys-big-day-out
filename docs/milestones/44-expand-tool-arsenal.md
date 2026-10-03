# Milestone 44: Wield a 24-tool chaos arsenal

## Status

Implemented, awaiting Chris’s playtest — 2026-10-03.

## Objective

Complete the roster with sixteen additional tools that support crowd control, improvised movement, towing, temporary obstacles and demolition. Each has a distinct model, use and cost.

## Scope

Air horn, disco ray, sick ray, stink sprayer, spring glove, suction grappler, plunger launcher, tow reel, foam cannon, trampoline popper, rocket skates, pogo stick, umbrella glider, bubble shield, jackhammer and firework launcher. The first eight remain milestone 43.

## Out of scope

Crafting, persistent unlock trees, lethal combat, tourist/driver simulation and landmark construction.

## Dependencies

- **Depends on:** 43.
- **Blocks:** full tool-cache placement in 45.

## Acceptance criteria

- [x] All 24 tools have distinct identities, usable models and discoverable world pickup locations — test: `tests/tool-arsenal.spec.js`.
- [x] Crowd tools produce their intended interrupted/animated/fleeing states and recover safely — test: `tests/tool-arsenal.spec.js`.
- [x] Grappling, towing, skates, pogo, glider and trampoline change movement with collision and size limits — test: `tests/tool-arsenal.spec.js`.
- [x] Foam blocks traffic briefly, shield interrupts capture, jackhammer digs locally and fireworks produce delayed impacts — test: `tests/tool-arsenal.spec.js`.
- [x] Energy, heat, interruption, streaming and reset preserve bounded bodies/effects at lean and giant sizes — test: `tests/tool-arsenal.spec.js`.
- [ ] Chris can distinguish the tools and finds them useful during a rampage — verified by user playtest.

## Exit condition

Chris visits tool caches → uses at least twenty different tools with recognisably different results while food keeps the rampage supplied.

## Test plan

Fail each new behaviour check before implementation. Verify actual affected physics/actors and collision results, not just fired-event counters. Inspect every export in a contact sheet and representative tools in the native game. Re-run 43 and adjacent movement/capture/collection checks, build and production pixel smoke.

## Notes

The full roster is in `docs/tool-landmark-roster.md`. Visual and feel approval stays open until Chris plays it.

## Implementation evidence

All ten new behaviour checks failed before implementation. Final combined regression: 35 passing arsenal, first-eight, controller, traffic, net/capture, ragdoll, weight/contact and restart cases. An additional paired traffic run confirms the plunger reduces actual route travel and expires. All 67 units, build and production pixel smoke pass. Native original-rig effect/held views were inspected, with no console errors.

Movement tools use the existing swept collision path and a 3 m body-radius limit. Limits: six temporary devices, eight fireworks, three stink clouds and six interrupted people. Crowd poses restore their previous skeleton and owner on release. The first tow fixture put its target beyond the grapple wall; moving that fixture sideways preserves the occlusion rule. The traffic comparison runs two seconds so the shared initial acceleration does not dominate the travel comparison.

Native Chrome/Metal 1280×800 lean firework firing, military disabled: update plus render submission median 8.3 ms, p95 9.2, worst 36.4, 225 draw calls. Asset baking was paused during this timing sample. This is a microbenchmark, not an FPS/giant-rampage or feel sign-off. Evidence: `output/iterate/arsenal-*`.
