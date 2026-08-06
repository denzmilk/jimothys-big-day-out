# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-07-23 by Claude — end of a long session covering milestones 05/06, the voxel city, and tooling.

## Current phase

development

## Current milestone

Milestone 07 (destructible voxels) implemented and extended well past its original scope into a full city. **`docs/roadmap.md` is now the delivery plan** — read it before picking up work; it orders every requested feature by what unblocks what and carries 9 marked-up issues.

## Last action

Playtest-driven fixes plus a large world expansion:

- **Fixed:** jump "flying away" (ground scan snapped him onto rooftops; held-Space stair-stepped him skyward), double legs (now uses the model's own separated leg meshes), tail floating detached, paparazzi over-aggression, cans self-tipping on spawn, roll not visibly rotating, `applyImpulse` being passed a WORLD point where cannon-es wants a body-relative one (harmless near origin, flung containers into orbit at city coordinates), Jimothy getting stuck in his own craters (bedrock floor + auto-climb).
- **Added:** procedural Seattle street grid (craftsman blocks + downtown towers), deformable voxel ground with walkable craters, 4 container kinds scattered citywide, 26 fleeing pedestrians, headbutt (E/B) and roll (C) moves that damage IN FRONT of him, demolition + scared locals as heat sources, fatness scaling destruction power.
- **Tooling:** Blender installed + `tools/prep_jimothy.py` (39 MB → 4.4 MB, model pre-split into 7 named parts); TRELLIS.2 installed and tested (~2 min/model on the M5 Pro, mushier than Meshy — good for props, not heroes); CC0 asset research (ambientCG + Poly Haven have keyless APIs); `docs/lore.md` with verified Jimothy facts, accuracy guardrails, and 15 den props.

## Next step

Per `docs/roadmap.md`: **Phase 0 (stabilise) then Phase 1.1 (streaming/virtual ground)**. Streaming ground is the measured prerequisite for the map size Chris actually wants.

## Blockers

- **⚠️ 32 files staged and UNCOMMITTED.** Nothing from this session is committed. Chris hasn't approved a commit — ask first (house rule 1).
- **⚠️ 3 tests failing** (heat specs at the new city scale; earlier the same flakiness landed on fatness specs). Feast-eating is NOT verified end-to-end on the current build — treat it as unknown, not working.
- Map size is capped by eager ground allocation — 5×-per-side measured at 19 s boot / 1007 draw calls / 3.5 GB heap. Currently at 5× area (BOUNDS 250, ~7 s boot, 260 draw calls).

## Notes for next session

- **Playtest on the production preview** (`npm run build && npm run preview -- --port 4173`), never the dev server — HMR reloads half-written code mid-session.
- Tests boot with `__MANUAL_TIME__` (no real-time sim) and `__SKIP_RIG__` (skip the 4.4 MB model); only `rig.spec.js` loads it. `tests/helpers.mjs` has `warpNear`/`warpToFeast` because walking across a 500 m city eats the iteration budget.
- **`teleportJimothy` must snap the camera** — controls are camera-relative, so a lagging camera makes the input frame meaningless (this silently broke many specs).
- Chunks are **non-cubic** (64×12×64): draw calls scale with ground area, and cubic chunks waste height on empty sky.
- Bedrock (material 7) is indestructible by design — without a floor, a roll digs through every layer and strands him.
- cannon-es `applyImpulse(impulse, relativePoint)` takes a **body-relative** point. This bit us once; don't reintroduce it.
- Blender scripts headlessly (`blender --background --python <script>`), which is a better agent loop than the Blender MCP for batch asset work. Capture renders by rendering and reading the canvas back **in the same evaluate call** — the WebGL buffer clears between calls.
- `moss-sfx` MCP is connected and unused; audio is Phase 3 and is the cheapest big jump in perceived quality.
- Legal: the Space Needle's *shape* is trademarked and Pike Place's name/sign are City of Seattle marks — use parodies. See `docs/lore.md` for the full accuracy guardrails (real animal, real institutions).
