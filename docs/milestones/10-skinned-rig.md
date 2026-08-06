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
- [x] The model loads as a `SkinnedMesh` with all 8 bones resolved, no console errors — verified in-browser; renders as one continuous animal with no seam at neck, hips or tail (`output/iterate/skin-load.png`)
- [ ] Head bob, tail wiggle, leg swing, roll tuck and headbutt pitch all still animate
- [ ] Fatness deforms the belly *and* carries head, tail and legs with it, with the anchoring code deleted
- [ ] No seam is visible at the neck, hips or tail in any pose, including mid-roll and mid-headbutt — verified by user playtest

## Exit condition

User rolls and headbutts, then eats until huge → Jimothy deforms as one animal: no seam, no sliding pieces, and the head, tail and legs stay part of the body at every size.

## Test plan

Geometry and skin validity are asserted from the GLB itself (`tools/mesh_report.mjs` for topology; a direct check of `skins`/`JOINTS_0` for the bind). In-game, the existing `rig.spec.js` assertions carry over almost unchanged — they measure *where the pieces are relative to the body*, which is exactly what must keep holding once bones drive them.

The `parts` metric in `render_game_to_text` keeps working, since it measures anchor positions against the belly's bounding box regardless of what moves them.

## Where this stopped (2026-08-07) and exactly what is left

The pipeline and the load path are done and verified. **What remains is porting the animation from slots to bones**, which is one focused job:

1. **Bone axes — and a trap that will bite you first.** Measured 2026-08-07:

   **Bones carry their bind orientation in `bone.quaternion`. Never zero it.** The old slot code wrote `slot.rotation.x = …` directly; doing the same to a bone destroys its rest pose. Proof — `head` rests pointing `[0, 0.165, -0.833]` and `tail` rests pointing `[0, 0.339, 0.779]` (opposite ends of the animal), but after `rotation.set(0,0,0)` plus `rotation.x = 0.6` **both** read `[0, 0.48, -0.701]`. Identical, because the rest pose was gone. A naive port collapses the skeleton into a T-pose and it will look like the export is broken when it is not.

   So: capture each bone's rest quaternion at load, and compose deltas against it — `bone.quaternion.copy(rest).multiply(delta)` for a rotation in the bone's own frame, or `delta.clone().multiply(rest)` for one in its parent's frame. Then re-measure which local axis is pitch/yaw/roll *with the rest pose intact*, and write the mapping into a comment. The probe used for this reads a bone's local +Y column out of `matrixWorld` (`elements[4..6]`), which is the bone's own length axis and the clearest thing to watch.
2. **Retire the fallback tube legs on the skinned path.** `JimothyLegs.useRealLegs()` bails when `rig.legs` is empty — which it is, since the skinned model has leg *bones*, not leg *objects* — so the tubes stay visible. That is the four dark cylinders in `output/iterate/skin-load.png`, and it is the same "eight legs" bug from the 2026-07-23 playtest. `useRealLegs` should take bones on this path.
3. **Delete the fatness anchoring, do not port it.** The `anchor()` helper and `applyFatness(…, bodyBase)` exist only to keep detached pieces on a surface they were not attached to. Scaling the `body` bone deforms the belly and carries everything with it, because the mesh is continuous.
4. **Flip `RIG.SKINNED` to `true`** once the above is done, and delete the `__FORCE_SKINNED__` opt-in.
5. Then re-run `rig.spec.js` with the rig loaded — its assertions measure where parts sit relative to the body, which is exactly what must still hold.

Only after that is it worth reconsidering JIM-18's thrust cap and JIM-11.

## Resolved: fatness grows the belly only, and the hitbox with it

Chris, 2026-08-07: *"We leave the leg size and the head size and tail size as default, the fatness just grows, with the growth so does the hitbox."*

Implemented as a uniform scale on `body` plus the inverse on each direct child (`neck`, `tail`, the four `leg_*`). Uniform is deliberate — a non-uniform parent scale through a rotated child bone shears the geometry, and every extremity is rotated relative to the spine. `head` and the `shin_*` bones inherit the correction through their parents, so they must NOT be corrected again.

Each child's own vertices return to 1× while its **position** still rides outward on the growing belly. That is precisely what the split path's `anchor()` helper did by hand (JIM-15) — now free, because the mesh is continuous.

The collision radius follows fatness too (`JimothyController.radius`), which makes a fat Jimothy a bigger target — the third fat trade-off alongside speed and hiding, and the thing that will make the lasso (JIM-23) get easier the greedier you have been. Note `cannon-es` keeps shapes in `body.shapes[]`; there is no `body.shape`.

### Superseded discussion

Verified in-browser (`output/iterate/skin-fat.png`): scaling the `body` bone carries head, tail and legs with it seamlessly — which is the milestone working. But the split path deliberately scaled the belly ONLY, on the grounds recorded in the code that "tiny head on an enormous body IS the meme". Skinning blends head vertices onto the body bone, so that intent is lost.

Two options, both cheap — **needs Chris's call**:

1. Counter-scale the `head` bone by the inverse of the belly scale, restoring the tiny-head silhouette.
2. Accept it: he inflates as one animal, which is arguably a better read for a creature that ate too much.

Do not just pick one. It is a deliberate character decision that was written down once already.

## Notes

- **Blender's automatic weights fail silently on this mesh** — `Bone Heat Weighting: failed to find solution`, all 18,766 vertices left at zero influence, with an armature that still looks correct. Do not reach for `ARMATURE_AUTO` here. See ADR-0004.
- `obj.data.validate()` before binding: decimation leaves degenerate faces, which is what the exporter's `Mesh is not valid` warning meant.
- `FALLOFF = 3.0` is the tuning dial for how soft the joints are. Lower = stretchier.
- The fatness anchoring logic in `postUpdate` should be **deleted, not ported**. It existed to keep detached pieces on a surface they were not attached to; a continuous mesh makes the problem impossible.
