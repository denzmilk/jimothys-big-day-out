# Ocean assets

Boats and animated fish/manta/whale: Quaternius, CC0 1.0. Sources: https://quaternius.com/packs/ships.html and https://quaternius.com/packs/animatedfish.html. Originals and publisher licences: `assets/sources/ocean`. Editable Blender deliveries: `assets/blender/ocean`.

`tools/prepare_ocean.py` preserves fish skinning and Swim clips, merges their authored colours into a single material, sets metre scale and separates boat faces into breakable hull/sail sections.

Kelp, seagrass, crab, starfish, urn and barrel are project-authored in `tools/build_ocean_dressing.py`. Four editable ruin scenes use the exact `OceanLayout.ruinPieces` descriptors; runtime ruins are fine destructible voxels. `ruin-layouts.json` records the Blender review recipe.
