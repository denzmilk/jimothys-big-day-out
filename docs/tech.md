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

### Jimothy footing and idle gestures (milestone 11 / JIM-22)

- `JimothyLegs` uses world-space paw contacts, diagonal stepping and two-bone IK against the voxel ground query. Fast scurrying can overlap transfers before a supporting leg overextends. A bounded visual height adjustment smooths kerbs while following continuous grades; it does not move the physics body.
- The rig has no ankle bones. Four end markers come from the paw sole geometry; placement is corrected against sampled skinned vertices, and snapshots report those visible positions. Sole selection uses character-space height so a load finishing mid-tumble cannot select the side of a paw. The analytic solver in `Grounding.js` works in the hip parent's frame to handle the growing belly's non-uniform scale. Pedestrian gait is unchanged.
- `JIMOTHY_IDLE` controls breathing, looks, tail movements and an occasional face scratch. Input/actions interrupt gestures; the raised paw returns through a step. Roll, airborne and swimming poses release ground contacts, and restart/large teleports clear them.
- `assets/blender/jimothy/jimothy-footing.blend` and `tools/refine_jimothy_weights.py` preserve the editable correction to the original rig. Torso weights no longer follow a scratching leg; paw vertices follow their own shin with a blended ankle transition. Mesh surface, textures and bone count are retained. The README records the original source commit and rebuild command.

### MPFB people (milestone 26)

`tools/build_pedestrians.py` creates twelve MPFB humans with fitted CC0 MakeHuman clothing/hair; packed editable and reduced game sources are in `assets/blender/people/`. The README records sources and rebuild commands. GLBs in `public/assets/models/people/` carry Idle/Walk/Run clips. `Pedestrians` shares geometry/materials, clones skeletons, disposes each removed skeleton, and uses opaque depth-writing materials with alpha-tested hair to avoid MakeSkin BLEND sorting holes. Human stride is capped by each skeleton's measured leg length (`GROUNDING.STRIDE_LEG_RATIO`) so shorter people can run on grades without overreaching.

### Physical street life and grounding (milestone 27)

- Kenney Car Kit 3.1, CC0: original GLBs/texture/licence in `assets/vehicles/kenney-source`; source URL and rebuild steps in `assets/vehicles/README.md`. `tools/prepare_vehicles.py` saves metre-scaled Blender sources and exports six cars with separate glazing.
- `StreetLife` follows the baked road graph and owns street object lifetimes. `PhysicsSystem` owns their cannon bodies through `prop:*` events. Impacts split mesh sections; fragment count/lifetime is bounded.
- `RollCollector` receives `entity:*` registrations for props, bins, food, bushes and people. It suspends the owner's physics/AI while attached to the animated belly's local bounds; stopping releases surviving entities. Uprooted bushes cease to hide the player.
- `Grounding` is a geometry utility: analytic leg IK after animation, pelvis reach correction, planted foot targets and ground normals; vehicles use pitch/bank plus wheel suspension. Spare tyres are excluded from support. JIM-50 replaces abrupt half-clip foot switches with movement-paced swing arcs, trailing-foot selection, bounded ankle travel, and damped pelvis/foot orientation. Landing targets lock late in a step; stopping finishes the current step. Release/teleport clears contacts, and zero-time updates preserve them. Pedestrians turn toward their route before moving along it.
- Building glass is a separate material group in the greedy voxel mesh, so it transmits light while retaining voxel damage. The sky supplies a shared environment map.
- Glass impacts flood connected material-4 cells (bounded at 2,048 cells per pane) and record every removal as a streaming edit. `GlassGeometry` splits imported glazing into connected planar panes once per cached car model; `StreetLife` saves broken pane IDs. Lean car hits break glazing, while a 1.2 m blast radius also breaks the body.
- `CarFragments` caches breakaway panels from the original imported triangles, preserving palette UVs and leaving the intact car's draw calls unchanged. Shared fragment materials expose both sides of detached metal. Car fragments use collision group 2/mask 1, so overlapping fragment boxes do not collide with each other, but still collide with normal props and the voxel ground/wall clamp. The 72-piece street budget recycles old loose rubble and preserves attached pieces; a full pool cannot make the next car indestructible.
- A 3.5 m impact (Chunky/25 headbutt) emits `car:exploded` once. `CarExplosions` owns three fixed instanced particle layers and one unshadowed light. At most four bursts coexist; the fire lasts 0.55 seconds, sparks 0.85, smoke 3.6. `car:exploded` drives effects without recursively issuing another world-damage event. Effect size and fragment impulses are capped; parts expire after 24 active simulation seconds and pause their lifetime while attached. Restart reuses caches and effect buffers.
- `glass:shatter` creates thin triangular prisms through `GlassShards`; `prop:*` keeps body ownership in `PhysicsSystem`. Maximum 72 shards, seven seconds alive, with lifetime paused during rolling collection. Shared geometry/material survive restart; shard meshes, bodies and registry entries do not. Shards use gravity and the voxel ground/wall clamp, excluding contacts with simplified prop boxes: a car collider fills its cabin and would eject newly spawned glass upward.

### Controlled street traffic (milestone 32)

- `TrafficRoutes` derives right-hand lanes, junction approaches and regular lamp sites from the same rotated district frames as roads and paving. It samples clearance before accepting a lane or turn and fits signal poles to the baked pavement; a junction gets timed phases only when every approach has a head. Wide arterials provide kerb parking. Vehicle templates normalize the imported -Z nose to the +Z driving axis (JIM-54).
- `TrafficFlow` is a geometry/state helper owned by `StreetLife`. Cars follow distance-sampled junction curves, accelerate and brake, stop behind red/amber lines and reserve a crossing until their rear clears. An occupied or blocked exit prevents entry. Broken signals use a stopped yield with one reservation at a time. Phase durations and driving values are in `TRAFFIC` in Constants.js.
- `traffic:obstacles` collects pedestrian/pursuer positions without importing those systems. StreetLife adds Jimothy and physical street objects. Road probes compare the actual voxel surface with the authored paving grade, so intact steep streets remain drivable while holes and obstructions stop traffic. Physics poses still go through `prop:pose`.
- Regular lamps face inward from pavement; nearby point lights follow the existing night-light budget. Signals use shared active/off materials; active lenses bypass tone mapping so exposure cannot wash their colour out. Both kinds retain the prop fracture, collection and saved-damage lifecycle; broken heads stop emitting. Instanced stop bars and centre dashes follow road grade and disappear over damaged ground.
- Clean traffic leaving the active radius is replaced even while Jimothy stands still; damaged cars keep their saved transforms and glazing state.
- Route geometry and shared materials are reused across restart; reservations, signal damage and time reset. `streetLife` snapshots include junction phases/holders and per-car speed, road and stopping reason.

### Raised footpaths (milestone 28 / JIM-51)

- `CityPlanner` reserves the footpath class before packing building lots. `StreetPaving` derives street grades from each district's road frame: short planar runs, level junctions and level cross-sections. District joins taper back to the shared terrain height so differently angled grids cannot meet in cliffs. Surrounding land meets the back of the pavement, then blends into the plots.
- Paving stays in the destructible voxel ground: materials 22–24, 22 cm kerbs and 1.1 m slabs with recessed geometric joints. `PAVING` owns the dimensions and material IDs. The mesher samples each side of a kerb independently and emits retaining faces; collision queries select the same voxel column. Removed paving uses the existing debris and persistent edit paths.
- Stairwells have a level bottom landing and openings into adjoining sewer bores; continuous lining must not seal the only exit after a grade change. Jimothy only auto-steps while moving horizontally, and descending ground contact settles onto the floor instead of preserving a gap within the contact tolerance. Upward hops remain free.
- Civilian routes use footpath cell centres and remain on paved strips. Released people can rejoin a path. Existing foot IK and vehicle suspension use the revised surface queries.
- The coarse island backdrop uses a reusable column-coverage texture to discard fragments over fully meshed voxel columns. It cannot cover lowered streets or player craters. Streaming and restart update the texture without creating additional materials or meshes.

### Verification

The opt-in `STATE_ONLY_TEST=1` skips repeated software rasterization after the harness renders its first frame; simulation and scene matrices still update. Default `advanceTime` and the smoke test render normally. Use the rendered smoke/pixel-readback and in-game captures for visual evidence. Restart Vite before a test run that imports singleton modules directly: a long-running HMR session can rewrite imports with timestamped URLs and create a second state/event module in test code. Boot waits for all people/car assets, and the real Jimothy rig when requested.

### Human impacts and capture (milestone 29)

`HumanRagdolls` binds eleven torso/head/limb segments to the existing MPFB skeletons. `human:*` suspends AI and IK while down; `ragdoll:*` asks PhysicsSystem to create and remove cannon-es bodies and cone/twist joints. Six people can simulate at once. Bodies collide with props and the voxel clamp; self-collision is excluded to keep overlapping shoulders stable. Recovery blends back into the animation pose, then resumes grounded movement. Entity attachment removes the temporary simulation before RollCollector borrows the mesh.

Animal control uses windup, swing, hold and recovery phases. `GameState.capture` drives the HUD through `capture:changed`. Growth reduces meter fill; loss of reach/sight or a ragdoll interrupts the hold. Only a full meter emits `player:netted`. Existing on-foot speed penalties preserve the lean movement advantage. Joint reference: https://pmndrs.github.io/cannon-es/docs/classes/ConeTwistConstraint.html.

### Living environment and lighting (milestone 30)

`EnvironmentLife` streams deterministic Kenney plant instances and a bounded population of animated Quaternius cats, dogs and eagles. Shared wind uniforms bend foliage near Jimothy; rolling temporarily flattens plants, blasts leave persistent flattened patches, and wildlife flees. Nearby animals survive population-window shifts. Plant geometry/materials and particle buffers are reused; removed animal skeletons and mixer bindings are released. Sources, CC0 licences and editable Blender files are recorded in `assets/wildlife/README.md`; `tools/prepare_wildlife.py` rebuilds the exports.

`DayNight` drives a 12-minute day through sun/moon position, sky, exposure, fog and environment light. The celestial light above the horizon owns the active local shadow pass; sun and moon reuse their 2,048² maps, updating five times per second. Underground disables those shadows. Bins and instanced rubble cast/receive shadows; car fragments retain their source mesh flags. Four nearby intact lamp heads provide night lights. `world:time-changed` publishes the clock and phase once per game minute; the HUD displays it, and the Dev Level slider follows it while unfocused. Tuning is in `ENVIRONMENT` and `DAY_NIGHT` in Constants.js.

### Water and swimming (milestone 31 / ADR-0005)

`WaterSystem` shares the configured gravity waves with CPU sampling and superimposes a 64×64 local damped ripple field. Shallow translucency, detail normals, depth colour, foam and bounded planar reflections show the surface. Body motion, wading, swimming and impacts create ripples; a reused instance buffer holds up to 96 splash droplets. PhysicsSystem queries water via EventBus before each fixed step to apply buoyancy and drag. The former safety plane is below the seabed, so water is no longer a solid floor.

Jimothy uses the same water height, damping and his visible belly centre for flotation; his four legs paddle while swimming. Ground contact handles wading and beach exit, with stationary ground snapping disabled during swimming. Water buffers and reflection resources are reused across restart. The sea is a surface simulation over the original island height field; finite basin drainage and flooding of excavations remain outside this model. The Dev panel’s Level tab includes a beach shortcut for inspection. All water tuning lives in `WATER` in Constants.js. See ADR-0005 for the boundary and rationale.
