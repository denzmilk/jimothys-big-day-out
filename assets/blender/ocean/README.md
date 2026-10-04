# Editable ocean assets

Original Quaternius files and licences are in `assets/sources/ocean`. Runtime exports are in `public/assets/models/ocean`; its attribution file records source links. All dimensions use metres and glTF forward is +Z.

Rebuild from the repository root with Blender 5.2:

```sh
node tools/export_ocean_layouts.mjs
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/prepare_ocean.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_ocean_dressing.py
```

The first recipe retains fish rigs and Swim clips, packs authored colours into one material, and divides ships into original bow/stern/side/sail faces. Runtime seeded damage, burial and tilt make those sections into wrecks. The second recipe authors kelp, seagrass, crab, starfish and collectible vessels.

`ruin-layouts.json` contains the seeded `OceanLayout.ruinPieces` descriptors for the first occurrence of each ruin family. The four ruin Blender files are editable review models of those descriptors. Runtime ruins use .22 m destructible voxels; Blender review geometry is not an additional runtime mesh. Regenerate the JSON if the layout recipe changes.

Native runtime inspections: `output/iterate/ocean-*.png`. These show the exports in game with the loaded Jimothy rig, water, terrain and lighting.

## Swim loop repair (JIM-90)

Rebuild only the small fish with `-- --only fish-silver fish-blue fish-striped` after the `prepare_ocean.py` command. The recipe matches the source curves' first/last values and uses cyclic handles; it retains the original topology, authored vertex colours and skinning. `tests/fish-assets.test.mjs` samples the delivered skinned vertices across loop seams at 30/60/120 Hz. The original CC0 files remain unchanged.
