# Milestone 09: Mesh repair — stop the asset pipeline shredding Jimothy

## Status

in-progress

## Objective

Close **JIM-10**: Jimothy's shipped model was ~64% open boundary edges, and because his material renders `DoubleSide` every hole showed the dark inside of his own shell. That is the "slightly see-through" and the mottled, speckled rear haunch in Chris's 2026-08-06 screenshot.

**The premise this milestone was created under turned out to be wrong, and that changed the whole approach.** JIM-10 was logged as a source-asset quality problem — a rough Meshy generation we would have to patch up. Measuring the source first showed the opposite: `jimothy.glb` has 597 boundary edges out of 1,198,253 (0.0%) and is essentially watertight. **Our own prep script was destroying it.** So this is not "repair a bad model", it is "stop breaking a good one" — a much better position, because the fix is one-time and every future export benefits.

## Scope

- `tools/prep_jimothy.py` — weld before decimating; cap each piece's cut; recalculate normals.
- `tools/mesh_report.mjs` — new. Watertightness report for any GLB, so this is verifiable rather than a matter of opinion.
- `public/assets/models/jimothy-rig.glb` — regenerated.
- `tests/rig.spec.js` — one threshold that was calibrated to the old geometry.

## Out of scope

- **JIM-11** (legs read as detached at the socket). Expected to be substantially improved by capping the sockets, but it is its own issue and wants its own judgement after Chris sees this.
- Re-opening the headbutt's thrust. It was reduced (JIM-18) to avoid dragging the neck seam into view; now that pieces are closed solids it *could* go back up, but that is a feel change and belongs with a playtest.
- Texture quality, lighting, and how dark he reads. Unrelated to topology.
- Regenerating the model in Meshy. The source we have is good.

## Dependencies

- **Depends on:** milestone 06 (the split pipeline), milestone 08 (which found and measured the defect)
- **Blocks:** JIM-11; and any future animation that moves a piece far from its socket

## Acceptance criteria

- [x] The source model is measured and shown to be watertight, so the fix targets the real culprit — `node tools/mesh_report.mjs public/assets/models/jimothy.glb` → 597 boundary edges of 1,198,253
- [x] The stage that causes the damage is identified by measurement, not inference — decimate, which turns 0 non-manifold edges into 48,237
- [x] Shipped model boundary edges drop by at least an order of magnitude — **56,414 → 940 (98.3%)**; body 63.9% → 1.1% open
- [x] The model still loads as 7 named pieces with no console errors — `tests/rig.spec.js::rig loads and splits`
- [x] Every rig and voxel spec still passes — 18/18
- [x] File size does not regress meaningfully — 4.66 MB → 4.71 MB
- [x] A re-runnable verification tool exists so this cannot silently regress — `tools/mesh_report.mjs`
- [ ] Jimothy reads as one solid animal in motion, with no visible holes at the neck, hips or tail — verified by user playtest

## Exit condition

User runs the game and looks at Jimothy from several angles, including while rolling and headbutting → no holes, no see-through patches, no speckled tearing at the seams → he reads as one solid raccoon.

## Test plan

Watertightness is asserted by `tools/mesh_report.mjs`, which welds vertices by position before counting edges used by exactly one triangle. The welding step is essential and is why the first analysis was misleading: glTF splits vertices per face-corner at UV and normal seams, so raw indices make even a perfect mesh look like loose triangles.

Visual confirmation by rendering Jimothy from four angles and reading the canvas back in the same `evaluate` call (the WebGL buffer clears between calls, which is why plain screenshots of this game come out black), saved under `output/iterate/`.

## Notes

- **Why the earlier pixel probes missed this.** Two probes sampled the belly's projected centre and read solid raccoon brown, which was true — the tearing is distributed but reads worst at the seams, and the middle of a large piece is mostly intact. A probe aimed at the centre of a thing cannot find a defect at its edges. Chris's screenshot is what located it.
- The weld merges duplicate UV corners at seams, so the texture can smear very slightly there. Deliberate trade.
- `WELD_DISTANCE = 1e-5` on a model ~1 unit long only ever fuses vertices glTF duplicated at a seam, never two genuinely distinct features.
- One `rig.spec` threshold changed: the absolute cap on a hip anchor's radial position. That number was a property of the model's proportions, and hole-filling legitimately changed every piece's bounding box (a hip landed at 1.359 against a 1.35 cap). Rather than raise it — which would be loosening a test to make it pass — the assertion now bounds the **lean baseline** and keeps the drift assertion, which is the invariant the test actually exists to protect, untouched.
