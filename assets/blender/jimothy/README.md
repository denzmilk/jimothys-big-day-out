# Jimothy footing and idle rig

`jimothy-footing.blend` is the preserved Blender 5.2 footing source for the runtime
`public/assets/models/jimothy-skinned.glb` used by milestone 11 / JIM-22.
The Meshy mesh, textures and 12-bone armature are preserved. This pass changes
skin weights so a raised paw does not pull the torso and planted toes follow
their own shin. The hip and ankle transitions stay blended.

The previous distance-only weights gave some torso vertices 85% leg influence.
An isolated paw pose displaced upper-body geometry by 10.4 cm. The
regression test measures the actual skinned vertices, not bone markers.

## Rebuild

Start from the original rig export rather than applying the correction twice:

```sh
git show 54f3ebc:public/assets/models/jimothy-skinned.glb > output/iterate/jimothy-skin-before.glb
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/refine_jimothy_weights.py -- output/iterate/jimothy-skin-before.glb public/assets/models/jimothy-skinned.glb assets/blender/jimothy/jimothy-footing.blend
```

The original static Meshy asset remains `public/assets/models/jimothy.glb`;
`tools/rig_jimothy.py` documents the initial armature and distance weighting.
Runtime pose, stride, support and idle values live in `src/core/Constants.js`.

Verification preserves 39,991 triangles, 12 bones and all three embedded texture
hashes. Rest-surface changes are below one micrometre (export rounding). Blender
splits some export vertices at seams: 58,971 becomes 60,453 vertices, with the
same triangles and surface. See `output/iterate/jimothy-asset-integrity.log`.

## Giant growth (milestones 23–24)

`jimothy-growth.blend` preserves the footing basis/armature and adds the
`GiantGrowth` shape key. Rebuild it and the runtime GLB with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build_jimothy_growth.py
```

The key stores outward torso growth on the original 39,991 triangles. Runtime
combines slower proportional anatomy growth with extra girth, preserving the
photographic face, fur, paws and tail. The original static and footing sources,
textures and twelve-bone skeleton remain intact. Positions and normals are
rebuilt only on size changes; animated root squash supplies the visible jiggle.
All runtime growth/jiggle values live in `RIG` in `Constants.js`.

JIM-69 (2026-10-03) removes the earlier `GiantCoat` sphere completely. It had
hidden the animal's original shape. Enlarged head, tail and paws now preserve
their local proportions while growing more slowly than the torso. Collection
samples three skin vertices per attachment so objects follow its actual pose
and wobble. IK accounts for the minimum folded-leg reach and paw size uphill.
