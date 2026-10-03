# Underground characters and maintenance props

Original geometry authored with `tools/build_sewer_assets.py` in Blender 5.2.
Concept reference: `assets/references/sewer/character-and-room-reference.png`;
exact image-generation prompt: `assets/references/sewer/prompt.txt`.
No downloaded third-party model geometry or textures are used.

Worker, scavenger and elder crab people have separate knee/claw/pincer pivots,
foot markers, eye stalks, shell plates and distinguishing equipment. Vertex colour
materials keep each articulated part in one render primitive. Pump, workbench,
locker, caged work light and pipe rack are editable single-mesh props.

Rebuild with Blender `--background --python tools/build_sewer_assets.py`, inspect
`output/iterate/sewer-models/`, then copy approved GLBs to
`public/assets/models/sewer/`. Each `.blend` remains independently editable.
