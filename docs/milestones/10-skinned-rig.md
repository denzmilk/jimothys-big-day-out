# Milestone 10: Skinned rig — the mesh stretches instead of separating

## Status

in-progress

## Objective

Close **JIM-21**. Jimothy is seven rigid solids, so every animation slides one piece past another and the seam shows. Replace that with one continuous mesh on an armature (ADR-0004), so the surface stretches across each joint.

This is the fourth time the split has produced the same defect (JIM-10, JIM-11, JIM-15, JIM-18). Each previous fix was a mitigation that constrained how far an animation was allowed to move a piece — which now actively limits the comedy the game is for.

## Scope

- `tools/rig_jimothy.py` — armature from the existing anatomy landmarks; distance-based skin weights; export with skin. **Done and verified.**
- `src/gameplay/JimothyRig.js` — load the `SkinnedMesh`, expose bones by name.
- `src/gameplay/JimothyController.js` — drive bone rotations where it drives slot rotations; **delete** the fatness anchoring, which skinning makes unnecessary.
- `src/gameplay/JimothyLegs.js` — swing leg bones.
- `public/assets/models/jimothy-rig.glb` — regenerated as a skinned model.

## Out of scope

- Re-opening the headbutt thrust (JIM-18) or retuning the roll. Both become *possible* here, but they are feel changes and belong with a playtest.
- Ragdoll. The bone hierarchy is a prerequisite for it, not a start on it.
- Re-generating or improving the source model.
- Removing `tools/prep_jimothy.py`. It stays until this is playtested, so we can fall back.

## Dependencies

- **Depends on:** ADR-0004; milestone 09 (the weld, which this pipeline reuses)
- **Blocks:** JIM-11; a punchier headbutt; Phase 2 ragdoll

## Acceptance criteria

- [x] Bones are placed from the same landmarks the split used, so calibration carries over — `neck_y -0.481`, `tail_y 0.68`, `leg_z -0.14`, unchanged
- [x] Every vertex is weighted — **18,766 / 18,766**, versus 0 from Blender's bone-heat solver
- [x] The export is a valid skinned glTF — one skin, 8 joints, `JOINTS_0` + `WEIGHTS_0` present
- [x] File size does not regress — 4.71 MB → **3.88 MB**
- [ ] The model loads as a `SkinnedMesh` with all 8 bones resolved, no console errors
- [ ] Head bob, tail wiggle, leg swing, roll tuck and headbutt pitch all still animate
- [ ] Fatness deforms the belly *and* carries head, tail and legs with it, with the anchoring code deleted
- [ ] No seam is visible at the neck, hips or tail in any pose, including mid-roll and mid-headbutt — verified by user playtest

## Exit condition

User rolls and headbutts, then eats until huge → Jimothy deforms as one animal: no seam, no sliding pieces, and the head, tail and legs stay part of the body at every size.

## Test plan

Geometry and skin validity are asserted from the GLB itself (`tools/mesh_report.mjs` for topology; a direct check of `skins`/`JOINTS_0` for the bind). In-game, the existing `rig.spec.js` assertions carry over almost unchanged — they measure *where the pieces are relative to the body*, which is exactly what must keep holding once bones drive them.

The `parts` metric in `render_game_to_text` keeps working, since it measures anchor positions against the belly's bounding box regardless of what moves them.

## Notes

- **Blender's automatic weights fail silently on this mesh** — `Bone Heat Weighting: failed to find solution`, all 18,766 vertices left at zero influence, with an armature that still looks correct. Do not reach for `ARMATURE_AUTO` here. See ADR-0004.
- `obj.data.validate()` before binding: decimation leaves degenerate faces, which is what the exporter's `Mesh is not valid` warning meant.
- `FALLOFF = 3.0` is the tuning dial for how soft the joints are. Lower = stretchier.
- The fatness anchoring logic in `postUpdate` should be **deleted, not ported**. It existed to keep detached pieces on a surface they were not attached to; a continuous mesh makes the problem impossible.
