# ADR-0004: Skinned armature replaces the seven-piece slop-rig

## Status

Accepted — 2026-08-07

## Context

Milestone 06 built Jimothy as **seven rigid solids** (head, body, tail, four legs) parented into slots and rotated independently. It was the right call at the time: it needed no rigging, no weight painting, and no piece exports — one Meshy GLB was the entire external dependency.

It has now produced the same defect four separate times:

- **JIM-10** — splitting opened holes in every piece; `DoubleSide` rendered his own dark interior through them.
- **JIM-18** — the headbutt's head thrust had to be cut from 0.47 to 0.12 because moving the head dragged the neck seam into view.
- **JIM-11** — the legs still read as detached at the socket.
- **JIM-15** — head, tail and hips drifted off the belly as he fattened, because each piece had to be *manually* kept on a surface it was not attached to.

Milestone 09 capped the sockets, so you can no longer see *through* him. But a capped socket sliding past a capped stump is still a visible seam. Chris, 2026-08-07: *"We do need to fix the seams — have the mesh stretch instead of just separate/break."*

**Separate solids cannot deform across a joint.** No further work on the split approach fixes this; every fix is a mitigation, and each one constrains how far an animation is allowed to move a piece. That constraint now actively limits the game's comedy, which is the point of the project.

## Decision

Replace the split with **one continuous mesh bound to an armature**, skinned with smooth per-vertex weights, and drive **bone rotations** where the game currently drives slot rotations.

Bone placement reuses the anatomy landmarks the split already calibrated (`NECK_FRAC`, `TAIL_FRAC`, `LEG_TOP_FRAC`) — they become joint positions instead of cut planes, so that tuning carries over rather than being redone.

**Weights are computed by distance to the bone segment, not by Blender's automatic bone-heat solver.** Bone heat was tried first and failed on this mesh — `Bone Heat Weighting: failed to find solution for one or more bones`, leaving all 18,766 vertices with zero influence. Critically it fails *silently*: it produces an armature that looks correct in the outliner and deforms nothing. Distance weighting is deterministic, cannot fail, is trivially debuggable, and a falloff constant is a far better tuning surface for a deliberately sloppy raccoon than a solver we cannot inspect.

## Consequences

**Good**

- Seams stop existing rather than being mitigated. The surface stretches across every joint.
- Retires JIM-11 and JIM-18's thrust cap; the headbutt can be as punchy as it wants.
- Deletes the fatness anchoring logic entirely (JIM-15). Scaling the `body` bone deforms the belly *and* carries every attached part with it, because the mesh is continuous — the problem that logic existed to solve no longer occurs.
- Smaller file: 3.88 MB vs 4.71 MB, since one mesh needs no duplicated socket caps.
- Lays the joint hierarchy that Phase 2 ragdoll wants anyway.

**Bad / risks**

- `JimothyRig`, `JimothyController` and `JimothyLegs` all change how they address the model. The animation *logic* survives (same rotations, same timings); what changes is what it rotates.
- Skinning costs a little GPU time versus rigid pieces. Irrelevant for one character.
- Distance weights are anatomically naive — a vertex near two bones blends by proximity, not by anatomy. Expect the odd oddity where the tail meets the rump. `FALLOFF` is the dial.
- The old pipeline (`tools/prep_jimothy.py`) stays until the skinned path is playtested, so there are briefly two.

## Alternatives considered

- **Keep splitting, overlap the pieces more.** The original slop-rig plan. Hides a seam at rest; any animation that moves a piece exposes it again. Already tried implicitly via socket caps.
- **Blender automatic weights.** Preferred if it had worked. It did not, and its silent failure mode makes it a bad pipeline dependency even where it does.
- **Buy/generate a pre-rigged model.** Discards the Jimothy likeness we already have, and Meshy's free tier gives no rigging.
- **Shape keys / morph targets for fatness only.** Solves fatness, not seams — the actual complaint.

## References

- JIM-21 (the request), JIM-10, JIM-11, JIM-15, JIM-18 in `docs/issues.md`
- Milestone 06 (the split), milestone 09 (socket caps), milestone 10 (this work)
- `tools/rig_jimothy.py`
