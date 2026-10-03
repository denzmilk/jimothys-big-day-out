# Landmark sources

`tools/build_landmarks.py` builds sixteen original Seattle-inspired parody destinations from separately named editable pieces. `assets/references/landmarks/` preserves the design contact sheet and exact prompt. Tourist-board and parks reference links are in `docs/tool-landmark-roster.md`.

Each `.blend` keeps its separate parts. Each `.json` records the same analytic shapes. The exported GLB merges the far silhouette into one vertex-colour draw; nearby geometry comes from `voxels.bin`, a little-endian Int16 sequence of `[x,z,yStart,yEnd,material]` runs at 0.22 metres. The manifest gives offsets measured in Int16 values. Both versions derive from the same shapes. Runtime damage belongs to the existing voxel edit store; it does not modify source files.

These are stylised authored interpretations, with simplified interiors and facades. The contact sheet guides the silhouette rather than promising all of its illustrative surface detail. Visual approval remains with Chris's in-game playtest.


The locks include submerged gate solids; their basin is authored in `LANDMARKS.BASINS` and supplied to the existing water/ground systems. The ferry is a static pier exhibit, and wheel/monorail ride operation is outside this milestone. Food tiers, edible attraction rewards and visitors use these reserved sites in later milestones.
