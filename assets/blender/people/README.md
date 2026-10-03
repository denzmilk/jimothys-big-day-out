# Jimothy neighbours

Created with Blender 5.2.0 LTS and the installed MPFB 2.0.17 add-on.

- `*-editable.blend`: parametric MPFB human, original clothing fit and rig. Textures are packed.
- `*-game.blend`: baked helper masks, simplified meshes, game rig, Idle/Walk/Run animation. Textures are packed at 512 px maximum; the small fedora uses 256 px maps.
- Runtime GLBs and exact source names: `public/assets/models/people/manifest.json`.
- Build: extract the pack below, then `MPFB_ASSETS=/path/to/assets /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_pedestrians.py`.
- Preview: `Blender --background --python tools/preview_pedestrians.py` writes `output/iterate/mpfb-lineup.png`.

All twelve bodies are created through `HumanService.create_human`, fitted using MPFB's standard game-engine rig and its supplied vertex weights. They vary in age, height, body proportions, face, skin, hair and clothing. The authored animation rotates the rig; the exported people are continuous skinned meshes.

## Sources

MakeHuman Community [system assets](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html), CC0. Author: MakeHuman Community / `makehuman_system`. Pack: <https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip> (downloaded 2026-10-02). This includes skin, clothing, hair, shoes and eyes. MPFB software itself is GPL; its generated character assets and this system asset pack are CC0.

The asset pack is an authoring input, not a game dependency. Its 267 MB ZIP is deliberately not committed. The source blend files and GLBs embed their textures and work without that temporary download. Preserve both editable and game sources when revising a person.

## Expanded roster — 2026-10-02

Six additional recipes are in `tools/build_pedestrians.py`: student (long-sleeve top), walker (padded jacket and braid), musician (striped shirt and fitted fedora), tourist (stockier build and T-shirt), pensioner (older, shorter woman), and artist (long hair and white top). They join commuter, neighbour, runner, worker, retiree and shopper. The twelve use twelve outfit meshes, twelve skin textures, nine hair assets plus a fitted hat; the manifest records each physique and accessory. The MPFB age/height/weight controls shape the actual mesh and skeleton. There are still only 36 civilians active at once.

Rebuild a subset without dropping the other manifest entries:

```sh
MPFB_ONLY=student,walker,musician,tourist,pensioner,artist /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_pedestrians.py
```

Preview the new six with `MPFB_ONLY` set to the same list and `MPFB_PREVIEW=mpfb-new-neighbours.png`; omit the filter for the complete lineup. The system pack's fedora material references an absent optional displacement image. MPFB reports that authoring warning; diffuse and normal maps are packed, and the exported hat uses its modelled silhouette (glTF does not require that image).

Runtime contract: `Idle`, `Walk`, `Run`, standard MPFB game-engine bones, two independently planted feet, and the same 11-body ragdoll. Geometry and materials remain shared between clones; only skeletons and animation state are per person.

Street routines added in M51 reuse these rigs with reversible procedural poses. Editable phone/cup models, exports and rebuild instructions are in [activities/README.md](activities/README.md).

## Delivery packing (M33, 2026-10-02)

After the Blender build, run `python tools/pack_pedestrians.py` in a Python environment with NumPy and Pillow. It combines each person's aligned skin primitives into one skinned draw and packs their existing diffuse/normal maps with periodic gutters. Original vertices, weights, joints, bind matrices and animation streams remain exact. The editable/game Blender files remain the source; regenerate raw GLBs from those before repacking. `--backup /path/to/folder` optionally preserves raw exports.

Every original geometry/skin/animation array was checked for exact equivalence before replacing delivery files (`output/iterate/people-packing-equivalence.log`). The 12-person native comparison uses 13 draws including its floor, versus 98 before packing; 0.0901% of pixels differ by more than 24 summed RGB levels, primarily texture filtering/normal-map quantisation. Captures: `people-packed-before.png`, `people-packed-after.png`. Packed exports remain below 3 MB each; the crowd cap stays 36.
