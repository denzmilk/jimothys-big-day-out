# Milestone 48 — Underground rework (JIM-77)

**Status:** implemented, awaiting Chris’s playtest — 2026-10-03. **Depends on:** 18, 28, shared entity/physics lifecycle. Gait regression JIM-76 is handled first.

## Outcome

Enter a sewer → explore an arched drain and recognisable pump, overflow or maintenance chamber → encounter readable, animated crab people → follow marked stairs back to the surface. Chris requested a full rework because the underground creatures read as brown blobs.

## Scope and acceptance

- [x] Wider arched main drains, narrower maintenance stretches, continuous walkable floors and a shallow recessed drainage channel. Preserve every connected component's surface exits.
- [x] Three distinct chamber families, seeded around the existing network. Their geometry, pipework and props make the location readable, with lit signs pointing to the surface.
- [x] Three original editable Blender crab-person variants: visible carapace, two stalk eyes, two pincers and articulated walking legs. Grounded scuttle and alarm reactions; released rolling passengers recover alive.
- [x] Nearby physical maintenance props can be knocked loose or collected. Underground structures remain voxel-destructible and damage survives streaming. Fixtures lose their light when detached or unsupported.
- [x] Nearby-only fixtures, bounded local lights/creatures, shared geometry and restart cleanup; no new always-on island simulation.
- [x] Existing underground escape, camera, pursuit and zero-economy treasure checks pass, with focused model/layout/grounding/destruction/reset checks and native runtime captures.
- [ ] Layout variety, creature identity, atmosphere and traversal feel verified by Chris's playtest.

## Limits

Shallow flowing drainage is a visual surface with local ripples, not a pressure/fluid-volume simulation. No new combat faction, currency or run-ending rule. Existing crab-people theme retained unless Chris answers the optional theme question otherwise. City/skyscraper and keepsake proposals remain separate.

## Assets and evidence

Reference: `assets/references/sewer/character-and-room-reference.png`; exact prompt alongside it. Preserve Blender recipes and editable sources. Runtime captures and reports go under `output/iterate/sewer-*`.

## Verification

The four initial rework checks failed before implementation. Separate regressions reproduced release onto the wrong vertical level and disappearance after bringing passengers above ground; both now pass. Thirty-one unique sewer/adjacent browser checks pass across `sewer-final.log` (29) and `sewer-lifecycle-final.log` (seven, five overlapping), alongside 70 unit checks, build and production pixel smoke without console errors. Each chamber family has an actual voxel escape route; a blasted wall remains absent after travel and regeneration.

Traversal verification needed two fixture corrections: the wider network exceeds the former 20,000-cell search budget (centralised at 100,000 with an indexed queue), and cross-district tests must wait for neighbouring columns to finish streaming. The overflow exit was absent at two simulated seconds and reachable after the column loaded (8,279 cells visited). A wrong terrain-adapter field during implementation was caught and corrected before the final runs.

Native original-rig captures inspected: `sewer-crab-gallery.png`, `sewer-v3-room-*`, `sewer-v3-inspect-*`, and final views under `output/iterate/`. Meshes, shaders and console were checked in Chrome/Metal. Source/recipe/provenance: `assets/blender/sewer/README.md`. None of this substitutes for Chris’s judgement of atmosphere or traversal.

**Native cost sample:** Chrome/Metal, 1280×800 Medium, original rig, warmed lean stationary rooms, military disabled. Pump / overflow / maintenance update plus render submission: median 10.6 / 10.5 / 11.7 ms, p95 12.0 / 11.2 / 14.7 ms, worst 13.0 / 22.7 / 17.4 ms, 319 / 323 / 325 draw calls. Each has 12 crabs and zero pending generation/remesh jobs. This is a bounded-room sample, not a giant-rampage FPS or streaming-stall claim. `output/iterate/sewer-performance.json` and final room captures retain the evidence.
