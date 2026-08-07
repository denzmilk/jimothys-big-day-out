# Milestone 16: The masterplan — a designed city, not a generated grid

## Status

not started

## Objective

Stop inventing the city and start **building a plan**.

> Chris, 2026-08-07, playtesting milestone 15: *"It definitely still reads as a grid… building variety is almost non-existent… We need something to base off where you place things, otherwise it's going to feel nonsensical like this. It's almost like you need a map to populate… whatever process you're using for creation is definitely creating, but it's just different flavours of the same grid."*

## The diagnosis, because milestone 15 got it wrong

Milestone 15 added archetypes, districts, lots and setbacks — and it did not help, because it changed the **texture** of each cell and never touched the **structure**. The grid was never in the data; it was in the generator. `roadAtVoxel` is `vx mod BLOCK_V < ROAD_V`, so every road is straight, every block identical, every junction a crossroads, forever.

And the deeper half: **nothing in the generator knows what anything is for.** A bin sits at a hash-chosen kerb point rather than behind a restaurant. A shop neighbours a warehouse because a hash said so, not because there is a high street. Per-cell rules cannot express *relationships between places*, which is exactly what makes a city legible.

Two failures of method worth recording, because both were mine:

- **The variety spec asserted the proxy, not the property.** It checked "≥6 distinct type strings exist", passed, and the world still read as three or four buildings. Counting archetypes was never the same as looking varied.
- **The safety spec checked buildings and not props.** 586 of 586 bins and 841 of 844 bushes shipped in the middle of the road, past a test named `SAFE: nothing overlaps a road`.

## The shape

Invert the pipeline. Today the generator invents everything. Instead:

**authored plan (data) → rasterised to a class grid → Layout queries it → voxelizer builds it**

- `src/level/masterplan.json` — the plan. Authored, checked in, diffable, hand-editable. **Regions with intent**, not hundreds of hand-listed segments: each region is a polygon plus a character (grid angle, road spacing, road classes, district type). Colliding grids fall out of authoring two regions at different angles.
- `src/level/Masterplan.js` — expands regions into road polylines, rasterises everything once at boot into a coarse class grid (~2 world units per cell), and answers O(1) lookups. Deterministic and order-independent by construction, because it is a fixed array.
- `src/level/Layout.js` — keeps its current public API (`roadAtWorld`, `districtAt`, `buildingsAt`, `propsIn`) so streaming, the minimap and every existing spec keep working. It becomes an adapter over the plan instead of a generator.

**Seattle gives the fix for free.** Its downtown grid is rotated ~32° from the rest of the city, and where the grids collide (Denny Triangle) you get triangular blocks and odd junctions. **Several straight grids at different angles** reads as a real city far more than one lattice, and stays voxel-friendly — a curved or diagonal street means staircased building walls, several straight grids do not.

## Placement becomes semantic

The point of the plan is that things can be placed *for a reason*:

| thing | today | with a plan |
|---|---|---|
| bin | hash-chosen kerb point | in an **alley**, behind a shop — which is where raccoons actually go |
| shop | hash said so | fronting a **high street** |
| tower | inside downtown radius | on a downtown **corner lot** |
| warehouse | hash said so | in the **port district**, near water |
| hide bush | grid offset | in a **park** or a back garden |
| building | axis-aligned on a lattice | on a **frontage**, facing its street, back to the alley |

## Scope

- The plan file, the region expander, the rasteriser, the query layer, the Layout adapter.
- Block detection: blocks are the negative space between roads, found by flood-filling the rasterised grid. Buildings are placed along a block's **perimeter facing its street**, with depth inward.
- Road hierarchy: arterial / street / **alley**, with different widths — alleys are the single biggest change to how the city reads, and the most on-theme.

## Out of scope

- The island coastline (milestone 14) — but the plan is where it will live, so leave a `coast` polygon slot.
- Interiors, textures, landmarks (trademark warning in `docs/backlog.md`).
- The easter-egg world tour — this builds the shelf.

## Acceptance criteria

- [ ] Roads come from the plan, not from modulo arithmetic — deleting `roadAtVoxel`'s modulo is the test
- [ ] At least three grid regions at different angles, and the seams between them produce irregular blocks
- [ ] Alleys exist, are narrower than streets, and run behind blocks
- [ ] Block areas vary — assert the variance, since a uniform lattice has none
- [ ] Junction degree varies (T-junctions, dead ends, crossroads), rather than every junction being a crossroads
- [ ] Buildings sit on frontages facing their street, not on a lattice
- [ ] Bins are in alleys and behind commercial frontages, and **never in the carriageway**
- [ ] Every block is reachable — flood-fill from spawn over non-building cells reaches every district (the "safe" guarantee, now a real graph property)
- [ ] Still order-independent, seed-deterministic, and O(1) per query — streaming and the minimap must not regress
- [ ] Boot cost stays flat in map size; the plan rasterises once
- [ ] **It reads as a place rather than a grid — verified by user playtest.** No proxy metric substitutes for this; see the method failures above.

## Exit condition

User walks out of a downtown of rotated blocks, down an alley behind a row of shops with bins in it, through a park, and into a residential street — and at no point feels like he is walking on a lattice.
