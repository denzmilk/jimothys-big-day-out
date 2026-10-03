# Milestone 11: Scamper gait — sprawled, low, with feet that find the ground

## Status

Core gait and idle gestures implemented; Chris’s playtest pending. Loose moving prop support remains a follow-up — 2026-10-02.

## Objective

Close **JIM-22**. Jimothy should read as a raccoon *creeping* — sprawled, low-slung, quick — with feet that plant on the actual terrain instead of sliding through it.

> Chris, 2026-08-07: "a bit more scamper-y, so a bit more sprawling and lower to the ground, like he's sort of creeping about — then have the physics aware footing you get with unity/unreal engine."

**Depends on milestone 10 being finished** (bones driving the animation). It is listed separately because the pose work and the footing work are independently testable and independently valuable.

## Scope

- `src/core/Constants.js` — `LEGS` gains sprawl (hip splay, knee outward bend), stance height, and cadence. All tunable during playtest; none of it hardcoded in the animation.
- `src/gameplay/JimothyLegs.js` — apply the sprawl as a **pose offset** on top of the bind pose, and revive the planted-foot gait against real bones.
- Two-bone IK per leg: given a planted foot target, solve hip and knee rotations so the foot reaches it.
- Per-foot terrain sampling via `groundHeightAt`, so feet land on crater lips, rubble and kerbs.
- Idle breathing, head glances, tail flicks and occasional cheek scratching. Idle gestures give way immediately to movement, attacks, hopping and swimming; supporting paws remain planted.
- Reuse the pedestrian IK approach: world contacts, bounded swing arcs, stable knee poles and smooth body-height correction, adapted to four short legs.

## Out of scope

- Full-body IK (body tilting to match a slope, head counter-rotation). Feet first; judge whether the body needs to respond after seeing it.
- Ragdoll (Phase 2). This shares the joint hierarchy but is a different system.
- Hand weight-painting the mesh. A bounded procedural weight correction is included because the scratch exposed torso vertices driven by the leg bones; mesh, textures and armature remain intact.

## Dependencies

- **Depends on:** milestone 10 (skinned rig + animation port). The two-segment legs it needs are already generated.
- **Blocks:** nothing, but it makes every other animation better

## Acceptance criteria

- [ ] Hips splay and the stance sits lower — he reads as creeping, not trotting — with every value tunable in `Constants`
- [x] Each foot plants at the terrain height under it, not at a fixed y
- [x] Feet stay planted while the body moves over them, then step when they drift past the threshold (the existing `_updateTubes` behaviour, now on real geometry)
- [x] A foot on a crater lip or paving stands at that height — tested against a real blast and a kerb fixture.
- [ ] Supporting feet on loose moving rubble/props requires a shared support query beyond voxel ground; retained as follow-up in `docs/backlog.md`.
- [ ] Knees bend in a consistent, sane direction — no inverted joints at any heading
- [ ] Gait cadence scales with speed, so a scurry looks frantic and a stand settles
- [x] Lean walking/scurrying, stop/start and turns at 30/60/120 Hz keep stance paws within 6 cm of the ground for 95% of samples; flat-ground stance drift stays below 2 cm per frame.
- [x] Idle actions occur while stationary, leave supporting paws planted and stop when movement/action starts; restart clears animation state.
- [x] Roll tuck, hopping, swimming, growth movement and pedestrian grounding retain their existing behaviour; the two existing JIM-49 rig growth assertions remain open.
- [x] Loading the rig during a tumble produces the same standing mesh pose as loading upright.
- [ ] He reads as a raccoon scampering about, with natural idle gestures — verified by user playtest

## Exit condition

User walks Jimothy across broken ground — a crater rim, rubble, a kerb — and his feet meet each surface at the right height while he stays low and sprawled, scampering rather than gliding.

## Test plan

`tests/jimothy-footing.spec.js` covers flat/sloped travel at 30/60/120 Hz, turns/stops, idle interruption, cross slopes, kerbs, zero-time stability, growth/action resets, isolated-paw skin deformation and a freshly blasted voxel surface. Rendered captures and Chris’s playtest judge the animation itself.

Foot placement is measurable: `render_game_to_text`'s `feet` array already reports per-foot positions, and `groundHeightAtWorld` already exists. A spec can blast a crater, walk him over it, and assert each foot's height matches the terrain beneath it within a tolerance — that is a real assertion for something that would otherwise be "looks about right".

Sprawl and cadence are feel, and are explicitly playtest-verified.

## Notes

- **The gait logic already exists.** `JimothyLegs._updateTubes` does planted feet, drift threshold, step timing and foot lift for the fallback tubes, and was orphaned when the real model arrived — `_updateReal` is only a crude swing. Reconnect that logic to bones; do not reinvent it.
- Two-segment legs are already generated (`leg_*` hip→knee, `shin_*` knee→foot, 12 joints). The knee is offset outward on purpose to pre-define the bend direction, since a straight limb is ambiguous to an IK solver.
- Apply sprawl as a **pose offset**, not baked into the bind pose — weights bind against the model's natural stance, and keeping the offset in code means it is tunable without regenerating the GLB.
- Two-bone IK is closed-form (law of cosines). Bounded correction passes account for the sampled skin surface around the virtual paw endpoint.

## Verification — 2026-10-02

The full regression passed 176/181 in `output/iterate/jimothy-animation-full-suite.log`; five known failures remain in JIM-03/JIM-48/JIM-49. After the final character-space sole calibration correction, all seven focused tests passed (`output/iterate/jimothy-animation-final.log`), including `tests/rig-load-grounding.spec.js`. Final build and rendered smoke pass without console errors. Captures are recorded in `docs/STATE.md`. Sprawl, cadence and idle character remain subject to Chris’s playtest. The contact checks use voxel terrain/paving; loose moving prop surfaces are not covered by the ground query.

## Slink regression — JIM-76 — 2026-10-03

Chris reported curled, dancing legs replacing the earlier balanced slink. Ground correction now preserves rest-pose paw projection and knee bend direction, with lower steps and non-overlapping diagonal transfers. `tests/slink-gait.spec.js` checks slow/normal walking at 30/60/120 Hz: at least two supporting paws, less than 13 cm actual sole lift, less than 14 cm lateral knee excursion and no tightly folded knee. All eight focused and 24 adjacent checks pass, plus 70 units, build and production pixel smoke. The headbutt recovery test measures the neck independently of whole-rig kerb grounding. Native captures: `output/iterate/gait-final-*` and `slink-world-*`. **Implemented, awaiting Chris’s playtest:** numerical contact checks do not establish a natural slink.
