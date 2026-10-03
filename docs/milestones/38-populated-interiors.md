# 38 — Procedural populated interiors

Status: implemented, awaiting Chris's playtest · Verified 2026-10-03 · Requested and authorised 2026-10-02 · Issue JIM-67
Depends on: 37

Furnish buildings in the existing destructible world. Promote the enterable-houses backlog item; use ADR-0006 for continuous interiors.

## Acceptance

- Seeded house, apartment, shop, office and warehouse layouts produce distinct room purposes, connected doorways, floors and stairs where needed. Keep exits and walking routes clear.
- Metre-scaled sourced furniture is physical, breakable and collectible; nearby furnishings stream with persistent damage. No whole-city rigid-body population.
- Buildings have varied existing MPFB residents/workers with indoor walking/idle routines, floor-aware grounding, reactions to Jimothy, ragdolls and rolling collection/release. Residents use the same shared human assets.
- Interior food retains identity and cannot be collected through a ceiling. Active furniture, food and residents have explicit budgets; travel/unload/restart clean up registrations and bodies.
- Test deterministic generation, route clearance, support, reactions, damage persistence and reset; inspect furnished houses and commercial spaces in native rendered views, run adjacent regressions/build/smoke and measure added cost.
- Status remains implemented, awaiting Chris's playtest until visual/feel sign-off.

## Verification

- Seeded rooms, floor slabs, partitions and stairs are integrated with voxel damage. Usable headroom creates the upper floors that were previously missing below some window rows. Four façade rotations, route connectivity and headroom have unit coverage.
- Prepared 27 Kenney CC0 Furniture Kit models through Blender. Originals/licence, editable `.blend` files, delivery GLBs and `tools/prepare_furniture.py` are retained. Houses/apartments use living, kitchen, bedroom and bathroom arrangements; shops, offices and warehouses have purpose-specific furnishings. Repeated furniture uses shared BatchedMesh pools with per-object main/shadow culling.
- At most four nearby floors, 64 furniture roots, 16 fragments and eight indoor MPFB residents are active. The existing twelve human templates supply variety. Walking/idle routines, fleeing via the entry, stairs, hallway passing, grounded feet, ragdolls and rolling collection are integrated.
- Behaviour checks cover furnished/moving populations, furniture fracture and persistent damage, stairs without floor jumps, shared ragdoll/collection hooks, dropped-object travel persistence, fragment expiry without whole-model respawn, loaded-rig doorway entry and opposing hallway traffic. Missing populations, missing upper floors and hallway deadlock were reproduced before their fixes.
- Final unit suite: **44 passed**. Final six-case native run passes movement, stairs, actual entry, hallway passing and both existing whole-renderer draw-budget assertions. Earlier 22-case native regression passed 20; its two draw-budget failures (including 309 calls after twenty blasts) prompted cross-model furniture batching, and both assertions then passed unchanged. The earlier 22-case software-rendered regression passed 21 and hit one capture-test setup timeout; that capture test subsequently passed in native Chrome. No assertion failure is being treated as a pass.
- Build and production rendered smoke pass, including WebGL pixel readback and no console errors. Native furnished house, apartment, shop and warehouse views were inspected. The Dev Level shortcut and normal keyboard walk through the house were inspected with the loaded Jimothy rig; the 6.48 m hallway walk retains floor height and grounded state.

### Native timing

Chrome / ANGLE Metal / Apple M5 Pro, 1280 × 800, Medium, loaded rig, 100 m straight city route from (-2,-40), no competing test/build process. Military updates are disabled for the matched world-cost route; the enabled military battle remains separately measured in milestone 34.

| Size | Median frame | p95 | Worst |
| --- | ---: | ---: | ---: |
| Lean | 12.9 ms | 15.8 ms | 59.6 ms |
| House | 13.5 ms | 17.4 ms | 72.3 ms |
| Block | 17.9 ms | 35.3 ms | 98.1 ms |

The route ends with 42–43 furniture roots and 4–8 indoor residents. Block carries 64 objects, including interior furniture and a resident, and removes 25,642 voxel cells. Reset clears damage and collection with no pending mesh work or page errors. Large demolition still hitches; these measurements do not establish locked 60 fps or a causal speedup over the prior world pass.

### Evidence and limits

Ignored local evidence is under `output/iterate/`: `interiors-red.log`, `interiors-green.log`, `interiors-paths.log`, `interiors-regression.log`, `interior-native-tests.log`, `interior-batches-green.log`, `interior-passing-red.log`, `interior-headroom-red.log`, `interior-final-paths.log`, `interior-final-units.log`, `interior-build-final.log`, `interior-smoke-final.log`, `interior-profile-final.log`, `interior-follow-final.log`, `interior-follow.png` and `interior-{craftsman,apartment,shop,warehouse}.png`.

Milestone 50 supersedes the original open-passage-only scope with hinged doors, wider circulation and fuller furnishing groups. House-specific lore remains a backlog item. Residents currently walk, idle and flee; sitting/working animations and whole-city household simulation are not included. Furnishings activate near the player, with fixed population budgets. Chris's visual and feel sign-off remains pending.

Preview: http://127.0.0.1:4174. Open Dev → Level → **Visit next building interior** to cycle houses and commercial spaces.
