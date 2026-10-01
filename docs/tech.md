# Tech stack

## Engine / runtime

- **Engine:** Three.js (latest at scaffold time; pin exact version in package.json)
- **Language(s):** JavaScript (ES modules)
- **Target platforms:** Desktop web browser (Chrome/Firefox/Safari), keyboard + mouse and gamepad input

## Libraries / frameworks

| Library | Version | Purpose |
|---------|---------|---------|
| three | pin at scaffold | 3D rendering, scene graph, GLTFLoader for GLB assets |
| physics (TBD) | — | Can-tipping, ragdoll knockback, and tank-shell launches — cannon-es vs. rapier vs. hand-rolled, decided in ADR-0002 at scaffold |

Deliberately minimal. Audio is raw Web Audio API (no library). UI is HTML/CSS overlay (no framework).

## Tooling

- **Package manager:** npm
- **Build:** Vite (scaffolded via `npm create vite@latest`, then `npm install three`)
- **Testing:** Playwright (gameplay logic + visual baselines, per the qa-game skill)
- **Linting / formatting:** none for v1 (slop game; revisit if the project grows)
- **Asset / binary storage:** GLB models committed under `public/assets/models/`. No Git LFS unless total model size becomes a problem (>~50 MB).

## Asset pipeline

- **Jimothy (the only generated model) — one full static GLB, rigged headlessly in Blender (ADR-0004):** Chris generates ONE complete Jimothy in the Meshy web app (Meshy 5; free tier — no API, and no prompt control for per-piece generation) and drops it in as `public/assets/models/jimothy.glb`. `tools/rig_jimothy.py` runs under `blender --background --python` to weld, decimate, build a 12-bone armature from anatomy landmarks, weight every vertex by distance-to-bone-segment, and export `jimothy-skinned.glb`. The game loads it as a `SkinnedMesh` and drives **bone rotations** where it used to drive slot rotations. Blender's automatic (bone-heat) weights fail silently on this mesh — do not reach for them; see ADR-0004.

  **Superseded, twice, and the history matters.** The original plan was a *runtime* splitter cutting the model into head/body/tail along DevTools-adjustable planes, on the reasoning that "seams are fine: the demi-real slop aesthetic treats action-figure joins as a feature". They were not fine. The split moved to build time (`tools/prep_jimothy.py`, 9× smaller and instant to load), and then the seven rigid solids produced the same defect four times over (JIM-10, JIM-11, JIM-15, JIM-18) because separate solids cannot deform across a joint — each fix was a mitigation that capped how far an animation was allowed to travel, which was capping the comedy the game exists for. `prep_jimothy.py` and the split load path survive as a one-line fallback (`RIG.SKINNED`) until the skinned rig has a playtest behind it.
- **Everything else (non-unique):** open-source/CC0 model libraries via the game-3d-assets skill — houses, trash cans, trees, paparazzi, animal control, police, tanks, props. No generation spend.
- **Textures:** photographic PBR textures from CC0 sources (e.g. Poly Haven and similar) — the photo-texture-on-simple-geometry look is the intended demi-real jank.
- **Audio:** procedural Web Audio via the game-audio skill — no audio files.

## Project layout

Per the threejs-game skill's event-driven modular architecture (scaffolded 2026-07-23; `systems/`, `gameplay/`, `level/`, `ui/` are added as milestones need them):

```
src/
  main.js          # entry — creates Game, exposes test hooks
  core/            # Game.js orchestrator, EventBus, GameState, Constants,
                   # Tunables (DevTools registry), DevOverrides (localStorage)
  systems/         # InputSystem (e.code + rebindable KEYBINDS), PhysicsSystem
                   # (cannon-es, ADR-0002), CameraSystem (follow/orbit),
                   # FlyCamera (free look, milestone 17), Score
  gameplay/        # JimothyController, TrashCans, Pursuers (vision + state
                   #   machine), Pedestrians, Treasures, CrabPeople, Debris
  level/           # islandPlan.js (DATA: coast, districts, hills, water,
                   #   bridges) -> Terrain.js (height field + implicit ground)
                   #   -> CityPlanner.js (bakes the class grid, finds blocks,
                   #   places buildings) -> Layout.js (adapter: joins the two
                   #   and answers "what is at x,z") -> VoxelCity.js (turns a
                   #   footprint into voxels) -> VoxelWorld.js (chunked voxel
                   #   engine, knows nothing about islands)
                   # LevelBuilder (the sea, bushes, bounds), AssetLoader
  ui/              # HUD + stingers, DevTools panel (tuning/keybinds/level)
public/assets/models/    # jimothy.glb (Meshy 5 export) + CC0 GLBs
public/assets/textures/  # CC0 photo PBR textures (note sources in README)
tests/             # boot-smoke.mjs (npm run test:smoke) + *.spec.js (Playwright)
docs/              # this folder
```

## Conventions

- **Code naming:** camelCase functions/variables, PascalCase classes, kebab-case filenames.
- **State:** centralized GameState + EventBus (threejs-game skill architecture) — keeps future multiplayer possible without a rewrite.
- **Asset naming:** kebab-case GLB names (`jimothy.glb`, `trash-can.glb`).
- **Testing hook:** expose `render_game_to_text()` and `advanceTime()` for Playwright-driven verification (live-iterate pipeline).
- **Grade is not a constant** (milestone 17). The ground is a height field, so `y = 0` means the **waterline** and nothing else. Anything that needs to know where the floor is asks `voxels.terrainHeightAt(x, z)` — including anything that starts a ground scan, spawns a prop, or decides what a blast may not dig through. Five separate literals meant "just above grade" and every one of them was silently wrong on a hill; see the milestone for the list.

## Deployment

GitHub Pages. Vite `base` must be set to the repo path; deploy via GitHub Actions workflow building `dist/` to Pages. Repo needs `git init` + GitHub remote at scaffold time.

## Out-of-scope dependencies

- **TypeScript** — plain JS keeps slop-game iteration fast; revisit only if the codebase grows past a vertical slice.
- **UI frameworks (React etc.)** — HUD is a plain HTML/CSS overlay.
- **Audio libraries (Howler etc.)** — procedural Web Audio only.
- **Networking (PartyKit etc.)** — single-player v1; see gameplan anti-goals.

## World pass asset pipeline (approved 2026-10-02)

MPFB 2.0.17 in Blender 5.2 creates varied clothed pedestrian rigs. Preserve source `.blend` files and build recipes under `assets/blender/` and `tools/`, ship GLBs under `public/assets/models/`, and document the exact CC0 source assets. Building dimensions are authored in metres and quantized at voxelization. Physical street entities share a declarative catalog and EventBus lifecycle; PhysicsSystem remains the sole owner of cannon-es bodies.

### MPFB people (milestone 26)

`tools/build_pedestrians.py` creates six MPFB humans with fitted CC0 MakeHuman clothing/hair; packed editable and reduced game sources are in `assets/blender/people/`. The README records sources and rebuild commands. GLBs in `public/assets/models/people/` carry Idle/Walk/Run clips. `Pedestrians` shares geometry/materials, clones skeletons, disposes each removed skeleton, and uses opaque depth-writing materials with alpha-tested hair to avoid MakeSkin BLEND sorting holes.

### Physical street life and grounding (milestone 27)

- Kenney Car Kit 3.1, CC0: original GLBs/texture/licence in `assets/vehicles/kenney-source`; source URL and rebuild steps in `assets/vehicles/README.md`. `tools/prepare_vehicles.py` saves metre-scaled Blender sources and exports six cars with separate glazing.
- `StreetLife` follows the baked road graph and owns street object lifetimes. `PhysicsSystem` owns their cannon bodies through `prop:*` events. Impacts split mesh sections; fragment count/lifetime is bounded.
- `RollCollector` receives `entity:*` registrations for props, bins, food, bushes and people. It suspends the owner's physics/AI while attached to the animated belly's local bounds; stopping releases surviving entities. Uprooted bushes cease to hide the player.
- `Grounding` is a geometry utility: analytic leg IK after animation, pelvis reach correction, planted foot targets and ground normals; vehicles use pitch/bank plus wheel suspension. Spare tyres are excluded from support.
- Building glass is a separate material group in the greedy voxel mesh, so it transmits light while retaining voxel damage. The sky supplies a shared environment map.

### Verification

The opt-in `STATE_ONLY_TEST=1` skips repeated software rasterization after the harness renders its first frame; simulation and scene matrices still update. Default `advanceTime` and the smoke test render normally. Use the rendered smoke/pixel-readback and in-game captures for visual evidence. Restart Vite before a test run that imports singleton modules directly: a long-running HMR session can rewrite imports with timestamped URLs and create a second state/event module in test code. Boot waits for all people/car assets, and the real Jimothy rig when requested.
