# Milestone 18: The underground — sewers, crab people, and treasure you can't spend

## Status

**implemented 2026-08-07, awaiting playtest.** Landed after 17 and 19, as planned.

## Objective

Make digging worth doing by putting something down there.

> Chris, 2026-08-07: *"Yes for 20m or more - want some underground surprises, like crab people, sewers, treasure that you can't do anything with etc."*

Milestone 17 gives the ground depth and strata. On its own that is a hole. This is the milestone that makes the hole a *place*.

## Why this is a whole second world, cheaply

The island is 2 × 2 km of surface. **Underneath it is the same 2 × 2 km, and it costs almost nothing**, because milestone 17's ground is implicit — nothing is stored until it is disturbed. Carving a sewer network is writing edits, exactly as blasting a wall is. So a second layer of the game is available for the price of authoring it, and it is the natural home for the density the surface can never quite have.

It also solves a real problem: a 2000-unit map takes **3m 19s** to cross at a sprint. Sewers that run under the streets are a *shortcut network* — one that costs you visibility and puts you somewhere unexpected, rather than teleporting, which is why fast travel was cut (milestone 13).

## The three things down there

### Sewers

A tunnel network under the road network, entered through manholes and storm drains at street level. Authored as polylines in `islandPlan.js` alongside the roads, so entrances land *on* streets rather than in someone's living room.

**They should be genuinely useful and genuinely unpleasant**: faster than the surface for crossing districts, unlit, easy to get lost in, and with no idea what is above you when you surface. The map screen (milestone 13) showing only the bits you have walked is the natural companion.

### Crab people

An underground faction with their own territory, going about their business and reacting badly to a raccoon. Not a heat tier — **a separate ecology** that does not care about your wanted level, which is what makes going down there a real change of situation rather than a safer version of the surface.

Tone check: this is meme-slop, and crab people are already a joke that exists. Play it straight and let the absurdity do the work — they should have a *society* (a market, a mayor, signage) rather than being reskinned enemies.

### Treasure you can't do anything with

> *"treasure that you can't do anything with"* — the joke IS the uselessness.

Buried finds: a hubcap, someone's retainer, a Tamagotchi, a cursed Furby, a briefcase that will not open. They score nothing and do nothing. **Do not let anyone gameplay-ify them later** — the moment they buy something they stop being funny.

Where they *do* pay off is the photo book (JIM-31): a game-over spread of everything you dug up on your big day out is worth more than points would be. And they give digging a reason without giving it a reward, which is a nicer economy than it sounds.

## Resolved: pursuers follow you down

> Chris, 2026-08-07: *"Nah they can follow you in - but we need a vision system and some kind of logic to go with them because at the moment they just make a beeline for you and never stop - no AI there at all."*

No special case, no off-switch: the chase continues underground. That avoids the trap that killed fast travel (milestone 13) and invented the fairy godmother for water (milestone 14) — the underground is a different *place*, not a safe one.

**It is only a good decision if milestone 19 lands first.** Today's pursuers steer straight at Jimothy through solid matter, with no vision, memory or search. In a tunnel network that is worse than useless: they would track him through rock and ignore every corner and dead end, making the most atmospheric space in the game the least interesting.

**Vision is what makes tunnels mean anything** — corners to break line of sight behind, darkness that shortens sight range, dead ends that are a gamble. Build milestone 19 first, then this.

## Scope

- Sewer network in `islandPlan.js`; carved into the terrain as edits at bake or on first visit.
- Manhole and storm-drain entrances placed on the street network.
- Underground lighting — the surface's golden-hour directional sun is useless down there.
- Crab-people faction: spawning, territory, behaviour.
- Buried treasure: placement, digging them up, and the collection that feeds the photo book.
- Tuning the pursuit for tunnels: darkness shortening sight range, and how sound carries underground.

## Out of scope

- Building basements and interiors (JIM-07). Related, and a different job.
- Underwater. The sea is milestone 14's surface, not a place you swim.
- Making treasure useful. It is a joke. Guard it.

## Dependencies

- **Depends on:** milestone 17 (depth, strata, implicit ground) and its edit store; **milestone 19** (pursuer AI) — an underground chase against a beeline AI is not worth building.
- **Relates to:** milestone 13 — a map that only shows where you have been is what makes tunnels tense. JIM-31 — the photo book is where treasure pays off.

## What shipped

**Implemented 2026-08-07. Awaiting Chris's playtest** (house rule 4). `tests/underground.spec.js`, 7 specs.

**The network is DERIVED, not authored.** The milestone imagined sewer polylines in `islandPlan.js` alongside the roads. But the roads are themselves expanded from district polygons and grid angles — so hand-drawn lines would be drawn against a network nobody has seen, and would rot the first time a district's angle changed. The sewer runs down the **middle of every arterial**, marked during the same pass that stamps the streets. That gives what the AC actually asks for by construction: a tunnel under the street network, with entrances that land on streets. 11 tunnels, 21 stairwells, 34% of the island's land within 60 m of one.

**Entrances are guaranteed at bake time, not checked afterwards.** A run of centreline shorter than `SEWER.MIN_RUN`, or one with nowhere on a street to put a stairwell, is **not built at all**. So there is no such thing as a sealed pocket in the rock to discover later — the bad case is prevented rather than reported.

**The stairwell is a square shaft with a one-voxel step spiralling down its wall.** One voxel on purpose: walking back up is then the auto-climb doing its ordinary job, where a ladder or a sheer shaft would have needed a special case in the controller. It is the way in *and* the way out, which is what makes the reachability guarantee worth having.

**Written at generation time, not as edits.** Edits are the player's damage and must survive an unload; the sewer is world and re-derives itself from the plan every time a column is rebuilt. Cost: **203 chunks against 191**, and boot 1415 ms against 1332. A second 2 × 2 km layer for 6% more chunks, because milestone 17's ground was implicit.

**One real bug the ACs caught, which no surface test could have.** The net's range check was horizontal — `_steer` returned a flat distance and the net and the flash both gated on it. An animal controller standing at the top of a shaft was "5 m away" from a raccoon **9 m below it**, and netted him through the ceiling. Vision and the net are both three-dimensional now.

## Acceptance criteria

- [x] A sewer network exists under the street network and is enterable from street level — 11 tunnels, 21 stairwells
- [x] Entrances are always on streets, never inside a building or in the sea — asserted on class *and* on the coastline, because the class check alone would miss it if the water carve ever stopped running before the sewer bake
- [x] Tunnels are navigable — a real breadth-first search over standable voxels (air, headroom, something underfoot, a climbable step), run from **deep inside a tunnel** rather than at the stairs. "There is an entrance" is exactly the proxy this repo has shipped twice
- [x] Underground is lit well enough to move through and dark enough to be unpleasant — the sun goes out, he carries the only light, fog closes to 30 m. *Unpleasant* is playtest
- [x] Crab people exist, hold territory, and react to Jimothy — 22 live in the tunnels, none on the surface; reaction asserted as movement, since a "reacting" crab that stays put has not reacted
- [x] Treasure can be dug up, is recorded for the photo book, and buys **nothing** — score, fatness and heat all asserted unchanged across the pickup, with the baseline taken *between* the digging and the find
- [x] Pursuers follow Jimothy underground and behave sensibly in tunnels — measured: an animal controller searches the street, drops down the shaft, reacquires and nets him at 9 m down. `VISION.DARK_RANGE_SCALE` cuts sight to 30% below ground, so a corner is worth far more down there
- [x] Memory still scales with what has been dug, not with the size of the underground — walking a tunnel records **zero** edits
- [ ] It is a place worth going — **verified by user playtest**

## Exit condition

User drops down a manhole in Trashattan, gets lost, meets a crab person, digs up a Tamagotchi, and surfaces somewhere in Compost Hill with no idea how he got there.
