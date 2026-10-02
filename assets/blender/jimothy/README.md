# Jimothy footing and idle rig

`jimothy-footing.blend` is the editable Blender 5.2 source for the runtime
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
