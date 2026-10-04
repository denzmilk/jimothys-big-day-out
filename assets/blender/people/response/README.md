# Photographer camera

Original project-authored Blender prop for M59. No third-party source model or texture was used. The editable source preserves separate material slots; the runtime export uses a single vertex-colour palette material. Runtime forward is +Z, units are metres.

Rebuild from the repository root:

```
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_response_camera.py
```

Outputs: this folder's `camera.blend` and `public/assets/models/people/response/camera.glb`. `LocalResponse` shares the geometry/material across photographers and adds a pooled-lifetime lens flash; `HumanResponsePose` solves both hands onto the grip positions. Visual evidence is saved by `tools/inspect-local-response.mjs` under `output/iterate/local-response-native/`.
