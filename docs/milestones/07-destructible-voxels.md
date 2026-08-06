# Milestone 07: Destructible voxels (one Seattle house)

## Status

in-progress

## Objective

Get **one Seattle craftsman house Jimothy can blow holes in** into the game. Build the chunked architecture from ADR-0003 (it costs the same as the naive one and actually runs), then move on to the city. Deliberately not gated on ceremony — a smoke check on draw calls is enough.

## Scope

- `VoxelWorld` (`src/level/`): chunked 3D byte grid (16³), material ids, world↔voxel coordinate mapping, `damageSphere(center, radius)` marking chunks dirty.
- `ChunkMesher`: greedy-meshed `BufferGeometry` per dirty chunk, single shared material + texture atlas (placeholder colours in the spike; photo textures later).
- Voxel collision for Jimothy by direct grid lookup — no cannon bodies for static structure at all.
- `Debris`: pooled `InstancedMesh` + pooled cannon bodies, hard-capped, batched matrix writes per frame, despawn on settle/timer.
- One authored craftsman house (footprint + rules, ~20×15×20 voxels) and a temporary dev-tools "BOOM" button + key to blast a hole at Jimothy's position.
- `render_game_to_text()` gains a compact destruction summary (voxels removed, live debris, dirty chunks, draw calls) — never a raw voxel dump.
- Perf harness spec that fails the build if budgets regress.

## Out of scope

- The city itself, Seattle landmarks, the Space Needle (milestone 08+, only if this passes).
- Tank shells driving the damage (milestone 03 integration comes after).
- Photo-texture atlas, rubble-as-terrain gameplay, buried feasts, pursuers pathing around rubble.
- Destruction as a heat source (one-line follow-up once budgets are proven).

## Dependencies

- **Depends on:** ADR-0003, milestone 02 (heat/pursuers exist), ADR-0002 (cannon-es)
- **Blocks:** the city build-out; milestone 03's shell/voxel interaction

## Acceptance criteria

- [ ] A voxel house renders and Jimothy collides with its walls — test: `tests/voxel.spec.js::house renders and blocks jimothy`
- [ ] Blasting removes voxels: a hole appears, the chunk re-meshes, and the summary reports the removal — test: `tests/voxel.spec.js::damage removes voxels and remeshes`
- [ ] Jimothy can walk through a hole he made (colliders rebuilt, not just visuals) — test: `tests/voxel.spec.js::holes are walkable`
- [ ] Debris spawns, is capped at `DEBRIS.MAX`, and recycles oldest rather than growing — test: `tests/voxel.spec.js::debris is pooled and capped`
- [ ] Debris despawns after settling; live count returns to zero — test: `tests/voxel.spec.js::debris despawns`
- [ ] Sanity check (not a gate): draw calls stay in the low hundreds after 20 blasts and debris stays capped — test: `tests/voxel.spec.js::stays sane after twenty blasts`
- [ ] Restart fully rebuilds the house (destruction is run-scoped, no leaks) — test: `tests/voxel.spec.js::restart rebuilds`
- [ ] Blowing a hole in a house is *funny* and the debris reads as chunky, not mushy — verified by user playtest

## Exit condition

User presses the blast key next to the house → a chunk of wall bursts into tumbling debris, leaving a ragged hole he can waddle through → frame rate is unchanged and the perf spec passes.

## Test plan

Red-first specs in `tests/voxel.spec.js`, driven by `render_game_to_text()` + `advanceTime()`; perf assertions read `renderer.info` (draw calls) and the physics body count, which are deterministic and don't depend on the flaky wall-clock FPS of headless SwiftShader (per the threejs-perf methodology note). Playtest on the production preview build.

## Notes

- Budgets come from `threejs-perf`: per-voxel meshes measured ~19,365 draw calls / 28.5 ms render CPU p95 versus 2 / 0.5 ms when batched. Chunked meshing is the whole ballgame — never create a mesh or body per voxel.
- Debris must obey the ADR-0002 sleep note: pooled bodies that are re-used need explicit `wakeUp()`, and anything player-adjacent must not be sleep-eligible.
- Keep the level authored as a footprint + rules definition, not baked voxel data, so the dev tools can edit it and git can diff it.
- If budgets fail, the fallback ladder is: bigger voxels → fewer chunks → destruction limited to designated breakable props rather than every surface.
