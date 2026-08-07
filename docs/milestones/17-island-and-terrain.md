# Milestone 17: The island — a coastline, hills, and ground with depth

## Status

scoped, not started — **kick off in a fresh thread**

## Objective

Replace the flat square of generated grids with **Imaginary Seattle**: an island with a real coastline, eight hills, and terrain deep enough to dig into.

> Chris, 2026-08-07, on the Rev A masterplan: *"It definitely still reads as a grid… This image at the moment doesn't look like anything much just yet - remember it's on an island so factor that in."*
> On Rev B: *"Now we're looking like a place!"*

Supersedes the region-grid half of **milestone 16** and absorbs **milestone 14** (island + water).

## Why the shape works

Real Seattle is an isthmus between Puget Sound and Lake Washington, cut east–west by the Ship Canal and interrupted by Lake Union. **Closing that into an island keeps everything that makes the place legible** — a deep bay at downtown, two peninsulas, an interior lake, a canal halving the city — while being nobody's actual city.

Four gameplay consequences fall out of geography rather than rules:

- **The coast cuts every district's grid** with an edge that was not generated alongside it. That is the texture six rotated lattices never produced (milestone 16's failure).
- **The canal forces north–south travel through five bridges** — chokepoints for free, and the obvious place for a heat-4 police cordon.
- **Two peninsulas are dead ends.** West Squattle has one bridge in; being cornered there with a full katamari stash (JIM-29) is a story.
- **Lake Onion and Grease Lake are landmarks you navigate by**, which is what makes the map screen (milestone 13) worth opening.

## The plan data

`src/level/islandPlan.js` — authored, checked in, hand-editable. Coastline, water bodies, bridges, hills and district polygons. **Names keep the shape of the Seattle originals** so the map reads as a gazetteer rather than a list of jokes; each entry records the `realName` it riffs on.

| district | real | character |
|---|---|---|
| Trashattan | Downtown | core — towers, alleys |
| SoTrash | SoDo | industrial — port, warehouses |
| Compost Hill | Capitol Hill | dense residential + high street |
| Trash Panda Heights | Queen Anne | residential, the steep one |
| Mangy Point | Magnolia | suburb peninsula + big park |
| Bandit Bay | Ballard | mixed, coastal main street |
| Freemunch | Fremont | residential around Grease Lake |
| Chew District | U-District | mixed, students |
| Northgorge | Northgate | retail — strip malls, big-box, car parks |
| Rummage Valley | Rainier | suburb, strip-mall arterials |
| West Squattle | West Seattle | suburb peninsula, one bridge |
| Eastlick | Eastlake | mixed, east shore strip |

Water: **Lake Onion**, **Grease Lake**, the **Chip Canal** (west and east arms), the **Chewamish**. Hills: **Trash Panda Heights** (62 m, the steep one), **Compost Hill**, **Bacon Hill**, **Mangy Point**, **West Squattle**, **Binney Ridge**, **Thirst Hill**, **Nibble Ridge**.

## Terrain

**Hills tuned for fun, not realism.** Long ramps a shopping trolley can build speed down, with a couple of genuinely steep faces. **Trashattan and SoTrash stay flat**, exactly as the real downtown and port are — they are built on fill. That gives the dense area a calm floor and puts the drama in the residential hills.

> Chris: *"enough to be fun, if jimothy rides a shopping cart you want to be able to do a jump."*

## Ground gains depth — and it should cost nothing

> Chris: *"Yes for 20m or more."*

Terrain today is `GROUND_LAYERS: 2` — one diggable layer over bedrock. That is a *surface*, not a volume. Digging into the world needs strata that follow the surface down.

**Do not materialise the depth.** 20 m at `VOXEL.SIZE 0.55` is ~36 layers, an 18× rise in ground voxels if built eagerly — and it would kill the boot-flat result milestone 12 just won. The ground should be **implicit**:

```
solidAt(x, y, z)  =  y < surfaceHeight(x, z)   unless an edit says otherwise
```

Surface height comes from the height field; the material at a depth comes from a strata rule. **Nothing is stored until it is disturbed**, and disturbance already has a home — the edit store built in milestone 12 for blast damage, which persists across unload precisely so a hole stays a hole.

Done this way, **depth is free**: 20 m and 200 m cost the same, and memory scales with how much has been dug rather than with how deep the world is. This is the single most important engineering decision in the milestone.

Strata (surface-relative, not absolute): topsoil → clay → rock → deep rock → bedrock at the floor. Different dig resistance and colour per layer, so a tunnel reads as going *somewhere*.

## Scope

- `src/level/islandPlan.js` — the authored plan (already written).
- `src/level/CityPlanner.js` — read the island plan: coastline instead of square bounds, water bodies, district polygons instead of generated grid regions.
- `src/level/Terrain.js` (new) — the height field, and the implicit-ground query above.
- `src/level/VoxelWorld.js` — `solidAtWorld` / `groundHeightAt` consult the terrain rather than assuming a flat plane; the edit store becomes the only source of stored ground.
- `src/gameplay/JimothyController.js` — slopes. Walking uphill, and whatever the speed rule is on a gradient.
- A **fly camera** (below), which lands first.

## Fly camera — do this first

> Chris: *"I probably need a fly/superspeed function to see the map in game."*

A free camera with speed control, detached from Jimothy. Small, and **everything after it is judged by eye**, so it pays for itself immediately. `window.debugCamera` already exists as a one-shot; this wants proper WASD/mouse flight with a speed multiplier and a toggle.

**Shipped 2026-08-07** — `src/systems/FlyCamera.js`. **F** toggles; WASD flies in the camera frame, **Space/Z** up and down, **shift** boosts ×5, **ctrl** creeps ×0.15, **−/=** step the multiplier ×2 per press over 0.25×–32×. Mouse look while pointer-locked. Flight begins from the follow camera's own pose, so there is no jump, and landing snaps the follow camera back onto Jimothy — controls are camera-relative, so a camera lerping in from across the city steers him at random.

Two things it had to get right, both asserted:

- **It takes the controls rather than sharing them.** WASD, shift and Space are Jimothy's. `InputSystem.suppressed` blanks the analog interface and drops every queued one-shot, and the fly camera steers off raw key state (`input.held`) instead. Without it, looking at the map hops him off a roof.
- **The world streams around BOTH.** `VoxelWorld.streamAroundPoints` takes a list of centres. Around the camera only pulls the floor out from under the raccoon; around him only leaves the camera over ungenerated void, which is the whole thing the camera exists to avoid.

## Out of scope

- The underground — **milestone 18**. This milestone owes it depth and strata; the sewers, the crab people and the treasure are its own job.
- Streets. The structure lands first, then the network is drawn against a coastline that already exists.
- Water rendering and the fairy godmother (was milestone 14) — the coast is *shape* here, the sea is *surface* there.

## What shipped, and what it cost

**Implemented 2026-08-07. Awaiting Chris's playtest** (house rule 4).

**The implicit-ground result, measured.** Booted at `TERRAIN.DEPTH` 20 m and 200 m:

| | 20 m | 200 m |
|---|---|---|
| stored voxels | 947,634 | **947,634** |
| chunks | 191 | **191** |
| boot | 1237 ms | 1224 ms |

Byte-identical, not merely close — a 10× depth is the same world with a bigger number in it. Boot is *under* milestone 12's 1654 ms baseline despite the island now having a height field, two bakes and hills. `tests/terrain.spec.js` asserts the equality exactly, so a single voxel of drift fails it.

The shape it actually took: ground is implicit for every **query** at any depth, and only a constant `TERRAIN.SKIN` of 4 voxels is **stored**, because that is what the mesher draws. A blast below the skin materialises the faces it exposes (`VoxelWorld._materialiseAround`) and nothing else, so memory tracks how much has been *dug*. On regeneration the holes replay from the edit store and re-expose their own walls — without that, a re-entered crater came back as an invisible void with no sides.

**Five constants that secretly meant "grade".** The docs warned about three of this family from earlier milestones; the height field found five more, and every one was silently wrong rather than loudly broken:

| where | was | broke |
|---|---|---|
| `damageSphere(minVoxelY)` | absolute `0` | a headbutt on a 50 m hill was told to spare everything below the waterline, and would have cratered the hillside |
| `Game.findWallTarget(probeY)` | absolute `1.0` | on a hill every probe hits solid rock, so it reported the first spot it tried as a wall and never found a standoff |
| `Pedestrians._sync` | scan from `0.5` | the scan started 50 m underground, found nothing, and buried the pedestrian at bedrock |
| `TrashCans.addCan` / snacks | `height / 2`, `0.18` | bins and food spawned 45 m under a hill and stayed there |
| `voxel.spec`'s `sparedGround` | `>= 0` | passes however deep the crater is, as long as the hill is taller than the hole |

Also `Tunables`' `WORLD.BOUNDS` range, still `[10, 38]` from the 250-unit map — **JIM-33**, fixed here: any stored override was being clamped to 38, which would have collapsed the island to a 76 m square.

**Container density regressed and was caught.** Changing the district mix left every alleyless district — most of the island by area — with 5–13 containers per streaming disc against downtown's 38–56. `CONTAINERS.KERB_SHARE_NO_ALLEYS` fixes it the way a city does (no alleys means everyone's bin is out front): now 22–52 everywhere. The spec that should have caught it was measuring `Math.max` over districts, which passes on one good district while eleven are bare — it now asserts the density of **every** district.

**Decisions worth not re-litigating:**

- **Coastal hills are bluffs.** Trash Panda Heights' summit is 34 m from the water; it cannot be both 48 m tall and walkable from the beach. Fading hills in over a long coastal run "fixed" the slope and took the island's landmark climb from 48 m to 8. The hill spec now asserts *a walkable way up exists* (≥ 8 of 24 approaches), which is the property the player cares about, and the coast spec asserts >70% beach with every bluff explained by a hill.
- **`span` in the plan is a crossing LENGTH, not a deck width.** Its numbers say so (70 m at a canal 84 m wide). Read as a width it built 70 m ribbons that filled a third of Lake Onion. Deck width is `TERRAIN.BRIDGE_WIDTH`; the length is measured off the land mask, which is the only way to be sure a deck reaches both shores. The crossing axis is found by probing for land in all four directions and taking the shorter crossing — reading it off the water body's bounding box gets the canals right and a bridge anchored in a lake badly wrong.
- **Bridge decks are raised 7 m with ramped approaches**, so water reads as water underneath.
- **Thirst Hill is gone**, absorbed by downtown's flat plateau — it sits 20 m outside Trashattan and `FLATTEN_RUN` is 120 m. Move it in the plan if it should be a hill.

## Acceptance criteria

- [x] Fly camera with speed control, so the map can be inspected — `tests/flycam.spec.js`, 5 specs
- [x] The island silhouette matches the plan, and walking off the edge means water rather than an invisible wall — asserted against the authored polygons; the sea is a plane at `y = 0` (`LevelBuilder`)
- [x] Hills are walkable and readable from the ground — Trash Panda Heights climbs 40 m from its foot; *readable* is playtest
- [x] Trashattan and SoTrash are flat — under 4 m of relief each, against 40+ in a hill district
- [x] Ground is diggable to at least 20 m, with visible strata changes — dug and then measured, not asserted off a count
- [x] **Boot cost and memory stay flat in terrain depth** — 947,634 stored voxels and 191 chunks at both 20 m and 200 m
- [x] Damage still survives a chunk unload (milestone 12's guarantee, now over a height field) — including 20 m below the stored skin, where the walls are implicit and have to be re-exposed on replay
- [x] Districts are placed per the plan — all twelve present under their own names; *read as distinct* is playtest
- [x] The city is still deterministic and order-independent
- [ ] It reads as a place — **verified by user playtest**

## Exit condition

User flies over the island and recognises it as a city with a coast and hills; then lands, climbs Trash Panda Heights, and digs a hole 20 m into it.

**Note for the playtest:** the fly camera loads a 385 m disc (`STREAM.FLY_LOAD_RADIUS`, tunable in DevTools). Seeing the *whole* island at once is not something this renderer does — a flat ground chunk emits 4096 separate quads where one would do, so each ground chunk costs about a megabyte of geometry. That is the thing to fix if the view needs to go wider, and the island-scale view proper is milestone 13's map screen.
