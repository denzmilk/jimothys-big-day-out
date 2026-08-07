# Milestone 15: Density and variety — a world worth crossing

## Status

not started

## Objective

Make the streamed island worth exploring: **things to find everywhere, and no two streets the same.**

> Chris, 2026-08-07: *"All good for density - but also variety - don't just have rows and columns of the same destructable house."*
> And earlier: *"like yakuza!"* · *"come up with a safe procedural method for building out different spaces - then we can do a world tour and add in meme-worthy easter eggs everywhere"*

Milestone 12 made the world big. This is the milestone that makes it not empty — and it is the one the gameplan explicitly warns is the difference between a good decision and a bad one: **an empty big map is worse than the full small one it replaced.**

Three problems, one root:

1. **Density collapsed** (JIM-32). `WORLD.BOUNDS` 250 → 1000 multiplied the area by 16 and left `TRASH_CAN.COUNT` at 70. Beyond the central district there is ground and there are buildings and nothing else.
2. **There are exactly two building types**, `buildCraftsman` and `buildTower`, one per block, centred, on a rigid grid. It reads as rows and columns because it *is* rows and columns.
3. **There is one "district" concept** — a downtown radius — so the whole island is one texture.

The root is that `Layout` currently answers a very thin question: one optional building per block cell. Everything here is widening that answer.

## Absorbs

- **JIM-32** — density collapse (the trash-can half of it).
- **"Procedural space authoring"** from `docs/backlog.md` (2026-08-07) — this *is* that safe procedural method, applied to the surface first.

## The shape: districts → blocks → lots

Layout gains two levels it does not have:

- **District** (a coarse cell, many blocks across): residential / commercial / industrial / park / waterfront. Chosen by a positional hash plus distance-to-centre, so downtown still rises in the middle but the rest stops being uniform. A district decides the *mix* of what its blocks contain, not the contents directly.
- **Lot** (a subdivision of a block): a residential block holds 2–4 houses with varied setbacks and gaps rather than one centred box; a commercial block might hold one large footprint; a park block holds none.

Both stay **pure functions of the seed and coordinates**, exactly as `buildingAt` is now — that constraint is what keeps streaming order-independent, keeps the minimap able to draw un-generated land (milestone 13), and keeps the whole thing unit-testable without a browser.

## Archetypes

At least enough that a street does not repeat: craftsman (existing), tower (existing), plus corner shop, apartment block, warehouse/industrial shed, gas station, parking lot, and park/empty. Each with per-instance variation — footprint, height, materials, roof pitch — so two of the same archetype still differ.

**Every archetype must be destructible on the same terms as the others.** A building the player cannot smash is a worse building, not a special one.

## "Safe" — what it has to guarantee

From Chris's original ask. Generation must be validated **when it generates**, not discovered in a playtest:

- Never seal the player in. Any enclosed space needs a door gap, and the spawn area stays clear.
- Nothing floats: every structure meets the ground.
- Nothing overlaps a road, and nothing overlaps another building.
- Nothing is generated off-land once the island lands (milestone 14).

These are cheap to assert because layout is pure: they are properties of a coordinate, checkable over thousands of blocks in a unit test with no world at all.

## Props stream with the world

Trash cans (and later trees, hide spots, pedestrians) spawn **per loaded column from the seed**, exactly as buildings now do, so the count tracks `STREAM.LOAD_RADIUS` rather than map size. Holding the old density by raising `TRASH_CAN.COUNT` would need ~1120 live `cannon-es` bodies; streaming keeps it at the old ~70-ish regardless of how big the island gets.

`Layout.propsIn(box)` alongside `buildingsIntersecting`, and `TrashCans` spawns/despawns against the streamer.

## Out of scope

- **Interiors.** Buildings stay shells (JIM-07). Variety on the outside first.
- **The easter-egg world tour.** This builds the shelf; the eggs go on it afterwards, and keeping them separate stops content blocking the generator.
- Landmarks — the Seattle-landmarks backlog entry carries a **trademark warning**; read it before drawing anything recognisable.
- Textures (JIM-28) — variety of *form* here, variety of *surface* there.
- The island itself (milestone 14), though districts and coastline will want to know about each other.

## Dependencies

- **Depends on:** milestone 12 (layout + streaming). This is entirely an extension of `Layout`.
- **Blocks:** JIM-29 (katamari harvesting is worthless on an empty map), the easter-egg world tour.
- **Relates to:** milestone 14 — a waterfront district only means something once there is water.

## Acceptance criteria

- [ ] Prop count tracks the load radius, not `WORLD.BOUNDS` — assert it is flat as bounds change, the same way boot time now is
- [ ] Cans and snacks are findable anywhere on the island, not just near spawn
- [ ] At least six building archetypes, all destructible on equal terms
- [ ] Walking a straight line across several blocks passes visibly different buildings — asserted from layout as archetype variety within a window, not judged by eye
- [ ] Residential blocks subdivide into multiple lots rather than one centred building
- [ ] Districts exist and differ measurably in their archetype mix
- [ ] **Safety, asserted over thousands of blocks in a unit test:** nothing overlaps a road, nothing overlaps another building, every enclosed structure has a door gap, spawn stays clear
- [ ] Still order-independent and seed-deterministic — the milestone-12 assertion, extended to the new fields
- [ ] Layout queries stay inside a frame budget as they get richer (the minimap will call them every frame)
- [ ] The city reads as a place rather than a grid — **verified by user playtest**

## Exit condition

User crosses the island and passes through recognisably different neighbourhoods, with something to tip, loot or smash the whole way — and never sees the same street twice.

## Notes

- **The grid alignment is load-bearing and must survive.** Milestone 12 aligned the buildable span to start *after* the road band, which is what makes "no building on a road" true by construction rather than by tuning. Lot subdivision has to subdivide the buildable span, never the block.
- Variety is cheapest in **proportion and material**, not in new geometry code. A craftsman that is tall and narrow with a steep roof reads as a different building from a low wide one.
- The existing builders take explicit footprint and height arguments already, so most archetypes are a new set of rules over the same primitives rather than new machinery.
