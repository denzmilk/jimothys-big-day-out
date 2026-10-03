# Chaos tools

24 original project-authored tool models, prepared with Blender 5.2.0 LTS.

- Design reference: `assets/references/tools/arsenal-reference.png`, generated with the built-in image tool. Prompt: `assets/references/tools/prompt.txt`.
- Editable pieces/materials: one `.blend` per tool here.
- Runtime: `public/assets/models/tools/*.glb`.
- Recipe: `tools/build_chaos_tools.py`.
- Manifest: `manifest.json`, including export geometry counts.
- Rebuild: `/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_chaos_tools.py`.

Blender uses metres and Z up; muzzles face -Y, exporting as Three.js +Z. Export joins the pieces into one vertex-coloured material per model, while the saved Blender file retains editable components. The first eight behaviours are milestone 43; the remaining sixteen are milestone 44. Exported models alone do not establish gameplay completion.

The modelling reference was inspected before authoring, and the actual exported 24-model sheet was inspected at `output/iterate/tool-model-gallery.png`. Floating decorative fasteners and the bubble bottle cap were corrected after the first sheet. Models use simplified solid palettes rather than the reference image's detailed surface wear. Final appearance needs Chris's playtest.
