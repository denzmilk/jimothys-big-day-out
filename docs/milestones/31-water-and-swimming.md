# Milestone 31: Water simulation and swimming

## Status

Implemented, awaiting Chris’s playtest — 2026-10-02.

## Objective

Enter the sea → Jimothy paddles and follows the same waves that move the visible surface; floating props displace water and create spreading wakes and splashes.

## Scope

- Shared CPU/GPU wave field, textured detail normals, depth colour, reflections and shoreline foam.
- Local simulated ripple field reacts to movement, impacts and floating props, with bounded stable updates.
- Buoyancy and drag on dynamic props; controlled Jimothy transitions between walking, wading and swimming with a paddle animation and shore exit.
- Restart clears disturbances and swimming; water remains consistent with day/night lighting.

## Dependencies

- **Depends on:** milestone 30; ADR-0002; ADR-0005.

## Acceptance criteria

- [x] Shared CPU/GPU wave field, textured detail normals, depth colour, reflections and shoreline foam. — tests: `tests/water-swimming.spec.js`
- [x] Local simulated ripple field reacts to movement, impacts and floating props, with bounded stable updates. — tests: `tests/water-swimming.spec.js`
- [x] Buoyancy and drag on dynamic props; controlled Jimothy transitions between walking, wading and swimming with a paddle animation and shore exit. — tests: `tests/water-swimming.spec.js`
- [x] Restart clears disturbances and swimming; water remains consistent with day/night lighting. — tests: `tests/water-swimming.spec.js`
- [ ] Appearance and feel meet Chris's brief — verified by user playtest.

## Exit condition

Enter the sea → Jimothy paddles and follows the same waves that move the visible surface; floating props displace water and create spreading wakes and splashes.

## Test plan

Write and run failing behaviour checks first. Verify state, deterministic time, console and rendered captures; run adjacent and full regression checks. Commit and push this milestone independently.

## Evidence

The first prop fixture did not reach the game after hot reload; it passes on the clean Vite server used for the final direct-import checks. Visual inspection then exposed ground snapping in shallow water and the difference between the collision sphere and visible belly. Flotation now follows the belly, shallow contact disables stationary snapping, and depth separates wading from swimming.

`water-final.log`: 13/13 water, prop physics and ragdoll checks pass. `water-contact-final.log`: all four final water checks pass. Build and rendered smoke (`water-smoke-final.log`) pass with zero console errors. Inspected captures show paddling under translucent water, day/night water and a physically floating imported car. The actual beach button is exercised in `water-beach-ui.log`. The full regression passed 170/175, including the real-rig beach crossing, with only the existing JIM-03, JIM-48 and JIM-49 failures (`living-world-full-suite.log`). Chris's playtest remains open.

## Size-sensitive water contact — Chris, 2026-10-03 (JIM-72)

- [x] Jimothy's entry splashes and moving wakes scale visibly from lean to Absurd, with spreading surface displacement and foam outside his body.
- [x] Falling props, cars, debris and ragdolls use body footprint and entry speed; larger/faster impacts produce broader/stronger reactions.
- [x] Fully submerged movement and dry-land impacts do not create surface splashes; resting bodies do not spam entry effects.
- [x] Ripple/render/physics sampling agree as the local area grows, moves and resets. Effects have fixed capacity, expire and reuse GPU resources.
- [x] Swim/shore exit, underwater interactions, physics and restart remain intact.
- [ ] Chris approves ripple visibility, scale and splash feel (user playtest).

This is the authorised extension of the existing surface simulation. Finite basin drainage remains in the backlog.

Verification: `tests/water-reaction.test.mjs` covers footprint width, speed response, adaptive-buffer reuse, land masks, stability and decay. `tests/water-reaction.spec.js` covers size, actual falling contacts, car/MPFB/rubble entry, submerged suppression, the one-entry latch, moving spray, effect budgets and reset. The final 11 water cases pass; the broader 31-case run covers shore, diving, wreck collision, physics and ragdolls. All 58 unit checks, build and production pixel smoke pass. Native loaded-model lean/Block/Absurd entry/spread and car splash captures were inspected, with no console errors. Exact logs and captures are listed in STATE. The original falling-prop test stopped before contact and was corrected to wait for the crossing; a separate two-burst regression was fixed in the runtime.

The final moving views use faint foam bands that keep their width in world metres as they spread. In the native 1280×800 Medium offshore sample, enabled reactions retain the same lean/Absurd median update-plus-render submission time as disabled reactions (3.6/4.5 ms); water updates are about 0.1 ms p95, and effects add two median draw calls. See STATE for the complete conditions and limits; heavy demolition was not part of this comparison.
