# Milestone 30: Living environment and day/night lighting

## Status

Planned — requested by Chris, 2026-10-02.

## Objective

Walk through grass and flowers → foliage bends, nearby wildlife reacts and particles follow the wind; watch daylight pass through dusk, moonlit night and dawn.

## Scope

- Nearby deterministic grass, flowers, shrubs and environmental birds/butterflies; placement excludes roads, buildings and water.
- Shared gusts animate foliage and airborne particles; Jimothy and impacts flatten vegetation and scatter wildlife.
- A continuous day/night clock drives sun/moon direction, sky, exposure, environment brightness and usable night lighting.
- Bounded streaming populations and reusable rendering buffers; restart resets environment state.

## Dependencies

- **Depends on:** milestone 29; ADR-0002.

## Acceptance criteria

- [ ] Nearby deterministic grass, flowers, shrubs and environmental birds/butterflies; placement excludes roads, buildings and water. — tests: `tests/living-environment.spec.js`
- [ ] Shared gusts animate foliage and airborne particles; Jimothy and impacts flatten vegetation and scatter wildlife. — tests: `tests/living-environment.spec.js`
- [ ] A continuous day/night clock drives sun/moon direction, sky, exposure, environment brightness and usable night lighting. — tests: `tests/living-environment.spec.js`
- [ ] Bounded streaming populations and reusable rendering buffers; restart resets environment state. — tests: `tests/living-environment.spec.js`
- [ ] Appearance and feel meet Chris's brief — verified by user playtest.

## Exit condition

Walk through grass and flowers → foliage bends, nearby wildlife reacts and particles follow the wind; watch daylight pass through dusk, moonlit night and dawn.

## Test plan

Write and run failing behaviour checks first. Verify state, deterministic time, console and rendered captures; run adjacent and full regression checks. Commit and push this milestone independently.
