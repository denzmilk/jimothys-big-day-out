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

## Acceptance criteria

- [x] Fly camera with speed control, so the map can be inspected — `tests/flycam.spec.js`, 5 specs
- [ ] The island silhouette matches the plan, and walking off the edge means water rather than an invisible wall
- [ ] Hills are walkable and readable from the ground — Trash Panda Heights should feel like a climb
- [ ] Trashattan and SoTrash are flat
- [ ] Ground is diggable to at least 20 m, with visible strata changes
- [ ] **Boot cost and memory stay flat in terrain depth** — measured at 20 m and at 200 m, and the two match. This is the assertion the implicit-ground design exists for
- [ ] Damage still survives a chunk unload (milestone 12's guarantee, now over a height field)
- [ ] Districts are placed per the plan and read as distinct on the ground
- [ ] The city is still deterministic and order-independent
- [ ] It reads as a place — **verified by user playtest**

## Exit condition

User flies over the island and recognises it as a city with a coast and hills; then lands, climbs Trash Panda Heights, and digs a hole 20 m into it.
