# Street activity props and poses

`phone.blend` and `coffee.blend` are original metre-scaled models authored in Blender 5.2.0 LTS. The smartphone has a rounded case, glass/chat display and camera; the takeaway cup has a tapered paper body, sleeve, cafe badge, raised lid and sip opening. No downloaded asset or new texture is required.

Rebuild both editable sources and runtime GLBs:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_pedestrian_props.py
```

The recipe runs in an isolated background process. The live Blender MCP was unavailable during this pass; no live scene was modified. Models export to `public/assets/models/people/activities/` with shared source materials per type. Each runtime GLB bakes its flat colours into a vertex palette for one draw; the editable Blender sources retain material slots. Phone: 104,260 bytes; cup: 62,976 bytes.

Routines use the existing twelve MPFB rigs from the parent README. Editable pose targets, timing and weighting are in `PED_ACTIVITIES` in `src/core/Constants.js`; `HumanActivityPose.js` applies two-bone arm/leg targets and root motion after the normal mixer. These are procedural poses, not new baked Blender animation clips. The original Idle/Walk/Run deliveries are unchanged. Additive poses restore their previous bone transforms before walking IK or external ragdoll/tool ownership resumes.

Props follow the right hand during a routine. Interrupted props detach with their world transform into the shared physical/rolling-collection lifecycle, capped at eight loose/attached items; quiet completed routines stow their props. Source files and recipe are original project work; the MPFB humans retain the parent README's CC0 attribution.
