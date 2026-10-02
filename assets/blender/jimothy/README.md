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

The key stores one unit of radial growth; strong head/tail/paw regions share
an attachment direction so they translate without expanding. Runtime growth
bakes the key into positions only when size changes, moves animation sockets,
and rebinds the same twelve-bone skeleton. Lean normalization uses the basis,
not the morph envelope. A growth-dependent coat shader avoids stretching the
original animal's photographic fur over a city block; face/tail/paw details
retain the original texture. All pose, coat and contact parameters are in
`Constants.js`; original static and footing sources remain preserved.

At large sizes, skin influences outside each moving socket transfer smoothly
to the torso. This prevents a tiny limb rotation from dragging a distant patch
of belly. Coat treatment also covers stretched socket triangles; rigid face,
tail and paw detail retains its original texture.

`GiantCoat` is an authored spherical surface, collapsed inside the torso at
lean size. Runtime merges it into the original skinned draw with body weights.
It fills angular fans around sockets at extreme growth; the original continuous
mesh and its small animated details remain. Coat roughness is independent of
the photographic material atlas.
