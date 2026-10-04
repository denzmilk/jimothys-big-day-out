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
- [x] Visible sun/moon shadows continue through night; physical bins/rubble participate, and the HUD/Dev time display follows the cycle — JIM-56, `tests/lighting-visibility.spec.js`.
- [x] Nearby planted foliage casts its wind/trampling shape, and the shadow volume covers all body sizes across graphics presets — JIM-56, `tests/shadow-coverage.spec.js`.
- [ ] Appearance and feel meet Chris's brief — verified by user playtest.

## Exit condition

Walk through grass and flowers → foliage bends, nearby wildlife reacts and particles follow the wind; watch daylight pass through dusk, moonlit night and dawn.

## Test plan

Write and run failing behaviour checks first. Verify state, deterministic time, console and rendered captures; run adjacent and full regression checks. Commit and push this milestone independently.

## Evidence

`environment-final.log`: 9/9 environment, street-life and grounding checks pass. The first run caught wildlife being replaced when the population window shifted; nearby animals now persist and flee. Build and rendered production smoke pass with zero console errors. The smoke harness freezes wall-clock simulation while assets load, then renders explicit deterministic advances; its pixel and error assertions are unchanged. Inspected captures: `environment-day.png`, `environment-dusk.png`, `environment-night.png`, and `wildlife-cat.png`, `wildlife-dog.png`, `wildlife-eagle.png` under `output/iterate/`. Final clock/lamps checks and the combined full regression are recorded in STATE.md.

### Lighting follow-up — JIM-56 — 2026-10-02

Night lacked shadows, bins/rubble were excluded and the time slider did not follow the clock. One active sun/moon shadow pass now follows the cycle; source flags survive car fracture. The HUD shows time and phase, and the slider updates while unfocused. Rendered day/night comparisons and a complete 48-sample clock cycle pass. All 23 applicable checks are covered by `lighting-final-regression.log` (22 pass) and `lighting-bins-final.log` (the remaining fixture moved into direct sunlight; unchanged threshold). Build/rendered smoke and ordinary-play UI inspection pass. Captures: `lighting-play-{dawn,day,dusk,night}.png`. The 12-minute period is unchanged; Chris's visual sign-off remains required.

### Daylight coverage follow-up — 2026-10-04

The missing-daylight-shadow report reproduced on planted foliage and maximum-size body coverage. Foliage now shares wind/trampling deformation with its shadow depth material; sun/moon coverage expands with the physical radius while preserving resolution/cadence. The 45 size/hour/quality cases pass, as do rendered comparisons for all six plant families (260–5,015 changed pixels), the existing clock/day/night/bin checks, graphics distance, living environment and crash-daylight checks: 12 unique cases. Build and production pixel smoke pass with no console errors; the ordinary daytime capture was inspected. Evidence: `output/iterate/shadow-*`, `lighting-day-shadows.png`. Local shadow reach and giant rendering cost remain bounded-budget limitations, with performance tracked in JIM-48. Awaiting Chris's visual playtest.
