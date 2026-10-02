# 37 — Recognisable food

Status: implemented, awaiting Chris's playtest · Requested and authorised 2026-10-02 · Issue JIM-66
Depends on: 36

Replace the coloured snack spheres and feast discs with identifiable food. Preserve the scrap/feast economy, collection and stopping-to-eat rules.

## Acceptance
- Every existing food label has a corresponding food model; identity is assigned at spawn and retained through eating and rolling collection/release.
- CC0 source files, licences, editable Blender deliveries and preparation recipe are retained. Inspect all sixteen foods and a real spill in the running renderer.
- Food rests on the actual support surface and cannot be eaten through another floor. Shared geometry/materials and a bounded live pickup pool keep repeated spills affordable.
- Tests cover identity/payout, feast interruption, support/vertical separation and reset; build and rendered smoke pass. Chris signs off visual readability in play.

## Verification
Four asset/batching unit checks pass. Eight economy/identity cases passed initially; the new interruption fixture was corrected to drive velocity rather than assign the read-only speed getter, then both food cases and restart passed. The historical JIM-03 interrupted-feast timing case remains excluded and is not silently marked fixed. Build and production rendered smoke pass. Native sixteen-model lineup and street spill inspected with no browser errors (`output/iterate/food-lineup.png`, `food-spill.png`, `food-native.log`). Source palette conversion corrected after visual inspection. Sources and edits are documented in the recipe; two unavailable leftovers (bone and closed burrito) use explicitly authored closed meshes.
