# Rifle infantry sources — M61

Kenney Blaster Kit 2.1: https://kenney.nl/assets/blaster-kit — CC0. Official page/archive licence checked 2026-10-04 during M60. The selected original `blaster-e.glb`, its palette and licence are retained here. The longer rifle is scaled to 0.82 m and its origin is moved to the trigger area for a two-handed pose; the original source remains unchanged.

The human is a separate variant of `assets/blender/people/worker-game.blend`, authored with MPFB 2.0.17 and the CC0 MakeHuman system assets documented in `assets/blender/people/README.md`. Only the work-clothing diffuse texture receives an olive treatment. The helmet is original project geometry.

Rebuild:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_infantry.py
python tools/pack_pedestrians.py public/assets/models/people/response/infantry.glb
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/preview_infantry.py
```

The packing command requires NumPy and Pillow. Editable uniform, rifle and helmet files live in `assets/blender/people/infantry`; runtime exports are in `public/assets/models/people/response`. The human retains 16,170 triangles in one skinned draw, with shared textures across four soldiers. The runtime asset is about 2.76 MB.

Validation on 2026-10-05 compares the variant with the shipped worker: identical positions, normals, indices, joint/weight arrays, bind matrices, joint names and Idle/Walk/Run sampler data. No existing civilian asset is rewritten. Evidence is retained under `output/iterate/infantry-asset-invariants.json` and Blender/native captures.
