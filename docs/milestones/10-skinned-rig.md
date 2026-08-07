# Milestone 10: Skinned rig — the mesh stretches instead of separating

## Status

**complete** — playtested and signed off by Chris, 2026-08-07: *"Looking much
better now."*

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
- [x] Head bob, tail wiggle, leg swing, roll tuck and headbutt pitch all still animate — `every animated bone actually moves` samples each part's travel in Jimothy's own frame; roll tuck and headbutt pitch keep their existing specs
- [x] Fatness deforms the belly *and* carries head, tail and legs with it, with the anchoring code deleted — head rides forward, legs splay sideways only, tail stays on the rump (see "Legs rode out of the world", below)
- [x] `RIG.SKINNED` defaults to true and `__FORCE_SKINNED__` is gone — the skinned model is what ships
- [x] No seam is visible at the neck, hips or tail in any pose, including mid-roll and mid-headbutt — **verified by user playtest** (Chris, 2026-08-07: *"Looking much better now"*), and it had to be: see "Why there is no automated seam check"

## Exit condition

User rolls and headbutts, then eats until huge → Jimothy deforms as one animal: no seam, no sliding pieces, and the head, tail and legs stay part of the body at every size.

## Test plan

Geometry and skin validity are asserted from the GLB itself (`tools/mesh_report.mjs` for topology; a direct check of `skins`/`JOINTS_0` for the bind). In-game, the existing `rig.spec.js` assertions carry over almost unchanged — they measure *where the pieces are relative to the body*, which is exactly what must keep holding once bones drive them.

The `parts` metric in `render_game_to_text` keeps working, since it measures anchor positions against the belly's bounding box regardless of what moves them.

## Landed 2026-08-07: the port is complete, awaiting playtest

Steps 1–3 below were done earlier the same day. This session finished steps 4
and 5, and finishing them turned up two defects that only became visible once
the skinned path was the one under test.

### Legs rode out of the world as he fattened

Scaling `body` multiplies every direct child's local position by the same
factor, in the body bone's own frame. The counter-scale added earlier fixed
each child's **size**; nothing was undoing the drag on its **position**.

For the head that drag is the point — it rides forward on a bigger animal. For
the legs it was a bug, and a bad one. Measured at the current fatness ceiling
(`widthScale` 1.70): the front feet reached `z 1.25` while the nose was at
`1.04`, so his feet were out in front of his own face, and they sat at
`y -0.20` — a fifth of a metre **under the road**.

The body bone's frame, measured from the four hips' bind positions:

| axis | meaning | how it was identified |
|---|---|---|
| x | lateral | flips sign between the L and R legs |
| y | along the spine | differs between the front and rear pairs; the only non-zero component on `neck` and `head` |
| z | drop from spine to hip | identical on all four legs |

`JimothyRig.splayLeg` now lets only x ride out, which is the bow-legged waddle
of a fat raccoon, and returns y and z to their rest values. `tail` needs no
such fix and gets none: its bind position is exactly `[0,0,0]`, the body bone's
own origin, so the belly grows around it and leaves it on the rump.

### The roll pivot fed itself stale matrices

`_pivot` has to be the belly's height above his feet, and on the skinned path
the belly is a bone deep inside one mesh rather than a child of the body slot —
so the old slot arithmetic resolved to the slot's own origin, his feet, and
JIM-20 came straight back.

Reading the belly's real height through `worldToLocal` fixed that, but only
once the matrices were refreshed first. The value **feeds** `group.position`,
so a stale read is not a one-frame lag, it is a feedback loop: traced mid-roll
past π it diverged 0.21 → 2.21 → 0.39 and threw the belly to `y -0.34`, under
the road. With `updateMatrixWorld` called first the reads agree and the height
holds steady at 1.056.

### Why there is no automated seam check

An attempt at one is worth recording, because it looked convincing and was
wrong. It bucketed every vertex under the bone that dominates it and measured
the gap between adjacent buckets' boxes — zero everywhere would mean nothing
had come apart.

It cannot work, and no threshold rescues it. Triangles straddle the boundary
between two bones, so a joint that **stretches** separates the two vertex sets
exactly as a torn one would. A fat mid-roll Jimothy measured 0.077 world units
at the hip by exact per-vertex skinning, with a provably intact mesh. Stretching
is what this milestone was built to do, so the metric reports success as
failure.

The mesh is one continuous surface; it is topologically incapable of tearing.
What "seam" actually names is a *rendering* judgement, which is why the AC says
playtest and why it still does. `rig.parts` reports each part's position for
diagnosis if Chris does see one.

## How it stopped (2026-08-07) — the five steps, all now done

Kept because step 1 is the trap anyone touching this rig will hit next.

1. **Bone axes — and a trap that will bite you first.** Measured 2026-08-07:

   **Bones carry their bind orientation in `bone.quaternion`. Never zero it.** The old slot code wrote `slot.rotation.x = …` directly; doing the same to a bone destroys its rest pose. Proof — `head` rests pointing `[0, 0.165, -0.833]` and `tail` rests pointing `[0, 0.339, 0.779]` (opposite ends of the animal), but after `rotation.set(0,0,0)` plus `rotation.x = 0.6` **both** read `[0, 0.48, -0.701]`. Identical, because the rest pose was gone. A naive port collapses the skeleton into a T-pose and it will look like the export is broken when it is not.

   So: capture each bone's rest quaternion at load, and compose deltas against it — `bone.quaternion.copy(rest).multiply(delta)` for a rotation in the bone's own frame, or `delta.clone().multiply(rest)` for one in its parent's frame. Then re-measure which local axis is pitch/yaw/roll *with the rest pose intact*, and write the mapping into a comment. The probe used for this reads a bone's local +Y column out of `matrixWorld` (`elements[4..6]`), which is the bone's own length axis and the clearest thing to watch.
2. **Retire the fallback tube legs on the skinned path.** `JimothyLegs.useRealLegs()` bails when `rig.legs` is empty — which it is, since the skinned model has leg *bones*, not leg *objects* — so the tubes stay visible. That is the four dark cylinders in `output/iterate/skin-load.png`, and it is the same "eight legs" bug from the 2026-07-23 playtest. `useRealLegs` should take bones on this path.
3. **Delete the fatness anchoring, do not port it.** The `anchor()` helper and `applyFatness(…, bodyBase)` exist only to keep detached pieces on a surface they were not attached to. Scaling the `body` bone deforms the belly and carries everything with it, because the mesh is continuous.
4. **Flip `RIG.SKINNED` to `true`** once the above is done, and delete the `__FORCE_SKINNED__` opt-in. **Done.**
5. Then re-run `rig.spec.js` with the rig loaded. **Done, and this was the step with the work in it.** The old assertions measured seven detached pieces' distance from the belly, which one continuous mesh cannot reproduce — the failure mode they guarded is now impossible by construction. They were restated around what the new architecture actually promises, and two of them found real bugs while being restated (above).

Only now is it worth reconsidering JIM-18's thrust cap and JIM-11.

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
