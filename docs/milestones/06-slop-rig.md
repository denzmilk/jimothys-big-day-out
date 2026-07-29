# Milestone 06: Slop-rig — model import, runtime split, stretchy legs

## Status

in-progress — implementation complete and green (39/39), awaiting Chris's movement playtest

## Objective

Get the real Jimothy on screen and moving: load Chris's Meshy GLB (`jimothy.glb`, one 800k-tri textured mesh), split it at runtime into head/body/tail along two tunable cut planes (no Blender, no rigging — triangle-centroid bucketing), parent the pieces into the animation slots, and give him procedural Adventure-Time stretchy-tube legs with a spring-step trot for waddle/scurry. Chris wants to feel the movement.

## Scope

- `JimothyRig`: async GLB load, normalize scale/ground, runtime split (neck + tail cut fractions, dev-panel tunable, re-split live), pieces into body/head/tail slots; placeholder primitives hide on load.
- Slot refactor in `JimothyController`: bob/roll/fat-distortion animate slots (rig inherits everything, including jiggle); head bob + tail wiggle channels.
- `JimothyLegs`: 4 stretchy tubes, hip anchors as bodySlot children (inherit fat width + wobble), planted feet with step-when-drifted gait in diagonal pairs (trot), speed-scaled step rate, feet stay planted mid-hop (legs stretch — the joke works itself).
- `RIG` + `LEGS` tunable groups.

## Out of scope

- Texture/size optimization of the 40 MB GLB (backlog); Draco/meshopt.
- Head look-at targets; pants cosmetic; other characters' models.

## Acceptance criteria

- [x] Rig loads, splits into three pieces, placeholder hides — test: `tests/rig.spec.js::rig loads and splits`
- [x] Legs exist and feet track the body while waddling (planted-step gait) — test: `tests/rig.spec.js::legs step while waddling`
- [x] Fatness distortion still applies (slot-based) — existing `tests/fatness.spec.js::fatness distorts the body`
- [ ] Movement feel with legs + model: waddle, scurry, hop-stretch, jiggle — verified by user playtest
- [ ] Cut planes land in sensible spots (neck/tail sliders) — verified by user playtest

## Exit condition

User waddles the real Jimothy around the block: tube legs trot under him, stretch during hops, the head/tail are separate pieces that bob/wiggle, and eating still balloons the body.

## Test plan

Red-first specs in `tests/rig.spec.js`; regression `npx playwright test`. Playtest on the preview build.

## Notes

- Gameplay specs boot with `__SKIP_RIG__` — software-rendering 800k tris in headless workers slowed every advanceTime render to a crawl (13 timeouts). Only `rig.spec.js` loads the model (`boot(page, { withRig: true })`).
- The model's own baked stubby legs remain visible under the tube legs — extra slop, Chris's call whether to cut them (raise the split's lower bound or a belly plane later).

- 800k tris renders fine on a real GPU; headless SwiftShader tests avoid extra renders (advanceTime renders once per call).
- Split pieces are re-centered to their centroids; slots move to those centroids so bob/wiggle pivot naturally.
- `RIG.NOSE_POSITIVE_Z` flips the head/tail ends if the export faces backwards — verify visually on first capture.
