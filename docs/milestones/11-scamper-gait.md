# Milestone 11: Scamper gait — sprawled, low, with feet that find the ground

## Status

not started

## Objective

Close **JIM-22**. Jimothy should read as a raccoon *creeping* — sprawled, low-slung, quick — with feet that plant on the actual terrain instead of sliding through it.

> Chris, 2026-08-07: "a bit more scamper-y, so a bit more sprawling and lower to the ground, like he's sort of creeping about — then have the physics aware footing you get with unity/unreal engine."

**Depends on milestone 10 being finished** (bones driving the animation). It is listed separately because the pose work and the footing work are independently testable and independently valuable.

## Scope

- `src/core/Constants.js` — `LEGS` gains sprawl (hip splay, knee outward bend), stance height, and cadence. All tunable during playtest; none of it hardcoded in the animation.
- `src/gameplay/JimothyLegs.js` — apply the sprawl as a **pose offset** on top of the bind pose, and revive the planted-foot gait against real bones.
- Two-bone IK per leg: given a planted foot target, solve hip and knee rotations so the foot reaches it.
- Per-foot terrain sampling via `groundHeightAt`, so feet land on crater lips, rubble and kerbs.

## Out of scope

- Full-body IK (body tilting to match a slope, head counter-rotation). Feet first; judge whether the body needs to respond after seeing it.
- Ragdoll (Phase 2). This shares the joint hierarchy but is a different system.
- Hand weight-painting the mesh. Distance weights are naive near the tail/rump; revisit only if it reads badly.

## Dependencies

- **Depends on:** milestone 10 (skinned rig + animation port). The two-segment legs it needs are already generated.
- **Blocks:** nothing, but it makes every other animation better

## Acceptance criteria

- [ ] Hips splay and the stance sits lower — he reads as creeping, not trotting — with every value tunable in `Constants`
- [ ] Each foot plants at the terrain height under it, not at a fixed y
- [ ] Feet stay planted while the body moves over them, then step when they drift past the threshold (the existing `_updateTubes` behaviour, now on real geometry)
- [ ] A foot on a crater lip or rubble pile stands at that height, not through it — test: walk him across a blasted crater and assert per-foot height tracks `groundHeightAt`
- [ ] Knees bend in a consistent, sane direction — no inverted joints at any heading
- [ ] Gait cadence scales with speed, so a scurry looks frantic and a stand settles
- [ ] He reads as a raccoon scampering about — verified by user playtest

## Exit condition

User walks Jimothy across broken ground — a crater rim, rubble, a kerb — and his feet meet each surface at the right height while he stays low and sprawled, scampering rather than gliding.

## Test plan

Foot placement is measurable: `render_game_to_text`'s `feet` array already reports per-foot positions, and `groundHeightAtWorld` already exists. A spec can blast a crater, walk him over it, and assert each foot's height matches the terrain beneath it within a tolerance — that is a real assertion for something that would otherwise be "looks about right".

Sprawl and cadence are feel, and are explicitly playtest-verified.

## Notes

- **The gait logic already exists.** `JimothyLegs._updateTubes` does planted feet, drift threshold, step timing and foot lift for the fallback tubes, and was orphaned when the real model arrived — `_updateReal` is only a crude swing. Reconnect that logic to bones; do not reinvent it.
- Two-segment legs are already generated (`leg_*` hip→knee, `shin_*` knee→foot, 12 joints). The knee is offset outward on purpose to pre-define the bend direction, since a straight limb is ambiguous to an IK solver.
- Apply sprawl as a **pose offset**, not baked into the bind pose — weights bind against the model's natural stance, and keeping the offset in code means it is tunable without regenerating the GLB.
- Two-bone IK is closed-form (law of cosines); no solver iteration needed for a 2-segment limb.
