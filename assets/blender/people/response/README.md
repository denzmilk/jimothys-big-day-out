# Photographer camera

Original project-authored Blender prop for M59. No third-party source model or texture was used. The editable source preserves separate material slots; the runtime export uses a single vertex-colour palette material. Runtime forward is +Z, units are metres.

Rebuild from the repository root:

```
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_response_camera.py
```

Outputs: this folder's `camera.blend` and `public/assets/models/people/response/camera.glb`. `LocalResponse` shares the geometry/material across photographers and adds a pooled-lifetime lens flash; `HumanResponsePose` solves both hands onto the grip positions. Visual evidence is saved by `tools/inspect-local-response.mjs` under `output/iterate/local-response-native/`.

## Police equipment (M60)

`police-gun.blend` is the prepared CC0 Kenney Blaster Kit import; `police-cap.blend` is an original navy cap, visor and badge. Both are rebuilt by `tools/build_police_equipment.py`. Source licences, palette ownership and scale details are in [the police source record](../../../sources/police/README.md). `tools/inspect-police.mjs` captures the fitted props on the original MPFB rig, the occupied patrol and projectile impact/recovery.
