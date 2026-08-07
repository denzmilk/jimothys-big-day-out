# Milestone 15: Density and variety — a world worth crossing

## Status

implemented — awaiting Chris's playtest (house rule 4)

## Measured 2026-08-07

**Density**, live trash cans at four corners of the island (was 70 *total* map-wide, i.e. effectively none outside the centre):

| spot | cans live | within 60 m | columns | draw calls |
|---|---|---|---|---|
| spawn | 78 | 17 | 49 | 140 |
| mid (200, 200) | 81 | 15 | 61 | 180 |
| far (600, −400) | 70 | 20 | 49 | 156 |
| corner (900, 900) | 61 | 13 | 49 | 113 |

Density is now a property of a *block*, so it cannot dilute as the map grows, and the live rigid-body count tracks the streaming radius rather than the world.

**Variety**, over 841 blocks: craftsman 638, shop 485, apartment 445, warehouse 252, shed 170, tower 64. Districts: residential 303, commercial 287, downtown 124, park 108, industrial (inner ring added after measuring it at 2%).

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

- [x] Prop count tracks the load radius, not `WORLD.BOUNDS` — assert it is flat as bounds change, the same way boot time now is
- [x] Cans and snacks are findable anywhere on the island, not just near spawn
- [x] At least six building archetypes, all destructible on equal terms
- [x] Walking a straight line across several blocks passes visibly different buildings — asserted from layout as archetype variety within a window, not judged by eye
- [x] Residential blocks subdivide into multiple lots rather than one centred building
- [x] Districts exist and differ measurably in their archetype mix
- [x] **Safety, asserted over thousands of blocks in a unit test:** nothing overlaps a road, nothing overlaps another building, every enclosed structure has a door gap, spawn stays clear
- [x] Still order-independent and seed-deterministic — the milestone-12 assertion, extended to the new fields
- [x] Layout queries stay inside a frame budget as they get richer (the minimap will call them every frame)
- [ ] The city reads as a place rather than a grid — **verified by user playtest**

## Exit condition

User crosses the island and passes through recognisably different neighbourhoods, with something to tip, loot or smash the whole way — and never sees the same street twice.

## Found while building it

**`CITY.DOWNTOWN_RADIUS: 45` was another constant that quietly meant "the middle of the old map"** — the same family as the absolute pursuer spawns and the hardcoded hide-spot grid. At 45 it covered about four blocks of a 2000-unit island, a village green rather than a city centre, and the tower archetype effectively never appeared: the variety spec found five archetypes instead of six. Derived from `WORLD.BOUNDS` now.

That is three constants in two milestones which encoded the old map size. Worth assuming there are more, and worth checking any constant expressed in world units the next time `BOUNDS` moves.

**Streamed bins toppled themselves, and the old code had warned about exactly this.** The eager layout enforced a 3.5 m gap by rejection sampling, with the reason in a comment: *"Overlapping containers get flung apart by the solver and topple on their own — which spills free food and free heat with no player input."* Placing 1–3 bins per block and letting each pick its own kerb put two of them centimetres apart at the corner, and cannon-es resolved the overlap by flinging both over.

It surfaced as five failing eat-related specs, and the diagnosis only came from measuring: the "nearest snack" after tipping a bin was **78 m away** — a different, freshly-streamed bin had toppled by itself and spilled. Now one kerb line per block with a bin per segment, which gets the guarantee by construction rather than by rejection, and `SAFE: containers are never placed close enough to topple each other` holds it there.

**A restart has to leave the world as complete as a boot does.** `resetCans` clears every bin and the streamer refills a frame later — invisible to a player, a race to anything reading state. `reset()` now repopulates immediately, the same thing `installCity` does for voxels.

**Emptied bins have to be remembered.** A streamed can that respawns when the player walks back is infinite food for the price of a stroll. `TrashCans.emptied` keeps the ids of tipped bins so they stay empty for the run, and clears on restart — the same per-run rule as voxel damage.

## Notes

- **The grid alignment is load-bearing and must survive.** Milestone 12 aligned the buildable span to start *after* the road band, which is what makes "no building on a road" true by construction rather than by tuning. Lot subdivision has to subdivide the buildable span, never the block.
- Variety is cheapest in **proportion and material**, not in new geometry code. A craftsman that is tall and narrow with a steep roof reads as a different building from a low wide one.
- The existing builders take explicit footprint and height arguments already, so most archetypes are a new set of rules over the same primitives rather than new machinery.
