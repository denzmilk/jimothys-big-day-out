# Milestone 31: Water simulation and swimming

## Status

Planned — requested by Chris, 2026-10-02.

## Objective

Enter the sea → Jimothy paddles and follows the same waves that move the visible surface; floating props displace water and create spreading wakes and splashes.

## Scope

- Shared CPU/GPU wave field, textured detail normals, depth colour, reflections and shoreline foam.
- Local simulated ripple field reacts to movement, impacts and floating props, with bounded stable updates.
- Buoyancy and drag on dynamic props; controlled Jimothy transitions between walking, wading and swimming with a paddle animation and shore exit.
- Restart clears disturbances and swimming; water remains consistent with day/night lighting.

## Dependencies

- **Depends on:** milestone 30; ADR-0002.

## Acceptance criteria

- [ ] Shared CPU/GPU wave field, textured detail normals, depth colour, reflections and shoreline foam. — tests: `tests/water-swimming.spec.js`
- [ ] Local simulated ripple field reacts to movement, impacts and floating props, with bounded stable updates. — tests: `tests/water-swimming.spec.js`
- [ ] Buoyancy and drag on dynamic props; controlled Jimothy transitions between walking, wading and swimming with a paddle animation and shore exit. — tests: `tests/water-swimming.spec.js`
- [ ] Restart clears disturbances and swimming; water remains consistent with day/night lighting. — tests: `tests/water-swimming.spec.js`
- [ ] Appearance and feel meet Chris's brief — verified by user playtest.

## Exit condition

Enter the sea → Jimothy paddles and follows the same waves that move the visible surface; floating props displace water and create spreading wakes and splashes.

## Test plan

Write and run failing behaviour checks first. Verify state, deterministic time, console and rendered captures; run adjacent and full regression checks. Commit and push this milestone independently.
