# Milestone 30: Living environment and day/night lighting

## Status

Implemented, awaiting Chris’s playtest — 2026-10-02.

## Objective

Walk through grass and flowers → foliage bends, nearby wildlife reacts and particles follow the wind; watch daylight pass through dusk, moonlit night and dawn.

## Scope

- Nearby deterministic grass, flowers, shrubs and environmental cats, dogs and birds; placement excludes roads, buildings and water.
- Shared gusts animate foliage and airborne particles; Jimothy and impacts flatten vegetation and scatter wildlife.
- A continuous day/night clock drives sun/moon direction, sky, exposure, environment brightness and usable night lighting.
- Bounded streaming populations and reusable rendering buffers; restart resets environment state.

## Dependencies

- **Depends on:** milestone 29; ADR-0002.

## Acceptance criteria

- [x] Nearby deterministic grass, flowers, shrubs and environmental cats, dogs and birds; placement excludes roads, buildings and water. — tests: `tests/living-environment.spec.js`
- [x] Shared gusts animate foliage and airborne particles; Jimothy and impacts flatten vegetation and scatter wildlife. — tests: `tests/living-environment.spec.js`
- [x] A continuous day/night clock drives sun/moon direction, sky, exposure, environment brightness and usable night lighting. — tests: `tests/living-environment.spec.js`
- [x] Bounded streaming populations and reusable rendering buffers; restart resets environment state. — tests: `tests/living-environment.spec.js`
- [ ] Appearance and feel meet Chris's brief — verified by user playtest.

## Exit condition

Walk through grass and flowers → foliage bends, nearby wildlife reacts and particles follow the wind; watch daylight pass through dusk, moonlit night and dawn.

## Test plan

Write and run failing behaviour checks first. Verify state, deterministic time, console and rendered captures; run adjacent and full regression checks. Commit and push this milestone independently.

## Evidence

`environment-final.log`: 9/9 environment, street-life and grounding checks pass. The first run caught wildlife being replaced when the population window shifted; nearby animals now persist and flee. Build and rendered production smoke pass with zero console errors. The smoke harness freezes wall-clock simulation while assets load, then renders explicit deterministic advances; its pixel and error assertions are unchanged. Inspected captures: `environment-day.png`, `environment-dusk.png`, `environment-night.png`, and `wildlife-cat.png`, `wildlife-dog.png`, `wildlife-eagle.png` under `output/iterate/`. Final clock/lamps checks and the combined full regression are recorded in STATE.md.
