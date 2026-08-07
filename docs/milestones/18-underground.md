# Milestone 18: The underground — sewers, crab people, and treasure you can't spend

## Status

scoped, not started. **Depends on milestone 17.**

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

## Acceptance criteria

- [ ] A sewer network exists under the street network and is enterable from street level
- [ ] Entrances are always on streets, never inside a building or in the sea
- [ ] Tunnels are navigable — no dead space you cannot get out of, asserted as a reachability property the way milestone 15's safety checks are
- [ ] Underground is lit well enough to move through and dark enough to be unpleasant
- [ ] Crab people exist, hold territory, and react to Jimothy
- [ ] Treasure can be dug up, is recorded for the photo book, and buys **nothing**
- [ ] Pursuers follow Jimothy underground and behave sensibly in tunnels — searching corners rather than tracking through rock (needs milestone 19)
- [ ] Memory still scales with what has been dug, not with the size of the underground
- [ ] It is a place worth going — **verified by user playtest**

## Exit condition

User drops down a manhole in Trashattan, gets lost, meets a crab person, digs up a Tamagotchi, and surfaces somewhere in Compost Hill with no idea how he got there.
