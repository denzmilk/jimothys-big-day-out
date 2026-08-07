# Milestone 14: The island — a coastline instead of a wall, and water that is too good

## Status

not started

## Objective

Replace the invisible wall at the map edge with a coastline, and surround it with water conspicuously better than the rest of the game.

> Chris, 2026-08-07: *"I think a walled edge doesn't work - let's pop it on an island - imaginary seattle island with some stupidly impressive water physics - like so good they're out of place for the game."*

Two separate wins in one shape:

- **The boundary stops announcing itself.** An invisible wall says "the game ends here". A shoreline is a *reason* for the world to stop, and it costs nothing to explain.
- **One deliberate break in the art direction.** Everything else is demi-real photo-texture jank. The sea being inexplicably gorgeous is the joke — and it only lands if the rest stays janky. This is a licence for exactly one thing, not permission to raise fidelity generally.

**Imaginary Seattle, not a reproduction.** Also the safe answer: it sidesteps the landmark trademark exposure recorded in `docs/backlog.md` (the Space Needle's *shape* is a registered mark).

## Why this is cheap now, and would not have been

`Layout` (milestone 12) already answers "what is at (x, z)?" as a pure seeded function. A coastline is one more such function — `isLand(x, z)` — consulted by ground generation, building placement, and the minimap alike. Built before streaming, the coast would have been baked into an eager world and re-authored the moment streaming landed.

## Scope

- `src/level/Layout.js` — `isLand(x, z)` and `shoreDistance(x, z)`. An island outline from a few summed sinusoids (or value noise) over the seed, so it is organic rather than a circle, and still a pure function.
- `src/level/VoxelCity.js` — ground generation writes beach/rock at the margin and nothing beyond it; **buildings suppressed off-land and near the shore**, so no house is ever half in the sea.
- `src/level/Water.js` (new) — the sea. See "the one expensive thing" below.
- `src/gameplay/JimothyController.js` — entering water. Currently the map edge is a hard clamp; that clamp is what this replaces.
- `src/core/Constants.js` — `ISLAND` (radius, shore falloff, beach material) and `WATER` (level, colour, wave scale, buoyancy).
- Remove the physics walls / position clamp at `WORLD.BOUNDS`.

## The one expensive thing: what "stupidly impressive" means here

The brief is a *look*, and the cheapest convincing route is a custom shader, not a simulation:

- **Gerstner waves** in the vertex shader — sharp-crested, actually displacing geometry, so the horizon moves and the shoreline gets real wave motion. This is what sells it, and it is cheap.
- Screen-space reflections or a planar reflection pass, depth-based colour absorption, and foam derived from depth against the shore.
- Buoyancy for anything that ends up floating (bins, debris, a rolled Jimothy) sampled from the *same* wave function the vertex shader uses, so what you see and what you bump into agree.

**A full fluid sim is the wrong tool** — expensive, and it does not look better for an ocean read at distance. Decide by measurement, not by ambition: the frame budget is shared with a streaming voxel city.

## Resolved: the fairy godmother

> Chris, 2026-08-07: *"When jimothy goes in the water a small fairy god mother comes and traps him in a bubble returning him to the shore saying something like 'The AI couldn't handle swimming mechanics Jimothy'"*

Entering the water summons a small fairy godmother, who bubbles Jimothy and floats him back to the beach, breaking the fourth wall about the game's own limits on the way.

**This is a better answer than any of the three that were on the table** (swim / paddle back / wash-up reset), and worth recording why, because it looks like a joke and is actually a design solution:

- **It removes the escape-hatch problem completely.** If Jimothy could swim and animal control could not, water becomes a free lasso counter on a 2000-unit map — the exact trap that got fast travel cut from milestone 13. A bubble ride is not an escape; it puts him back on the shore he came from.
- **It makes the boundary diegetic without a wall and without a punishment.** Nothing is taken from the player, so there is no reason to resent it.
- **It is the funniest possible use of the one over-built thing in the game.** The water is deliberately too good, and the reward for engaging with it is being told off by a fairy for expecting swimming mechanics.
- It costs a small model, one line of dialogue and a bubble ride — versus a swim state with its own physics, animation, camera and pursuer rules.

**Build notes:**

- The bubble ride should be **slow enough to read the line** and to enjoy the view, but not so slow it becomes a punishment on the third time. It is a joke, and jokes get less funny with repetition — consider varying the line.
- **Vary the dialogue.** One line heard forty times stops landing. A small pool of them, in the same self-aware register, is nearly free.
- She should also handle the case of a **fat Jimothy rolling into the sea at speed** (JIM-29), which is the funniest way to arrive and the one most likely to break a naive "teleport to shore" implementation.
- Keep her *small*. The brief says small; scale is the joke.

**Still open:** whether pursuers chasing him into the water get the same treatment. A paparazzo bubbled mid-sprint is free comedy and costs nothing extra once she exists.

## Out of scope

- Boats, or anything rideable on water (the rideables backlog entry).
- Underwater content. The surface is the feature.
- Rivers, rain, puddles, or water anywhere but the sea. If the shader generalises, good, but do not design for it.
- Real Seattle geography. Imaginary island — see above.

## Dependencies

- **Depends on:** milestone 12 (streaming ground + layout). `isLand` is a layout query.
- **Relates to:** milestone 13 — the minimap draws the coastline for free, from the same function.
- **Blocks:** nothing, but it defines the world's shape, so procedural space authoring (`docs/backlog.md`) should land after it, not before.

## Acceptance criteria

- [ ] The map edge is a shoreline, not a wall — walking to the edge in any direction reaches a beach, never an invisible barrier
- [ ] No building is ever generated partly in the sea, at any seed
- [ ] The coastline is deterministic and order-independent, exactly as the rest of layout is — the same assertion milestone 12's `layout is order-independent` makes
- [ ] Water renders with visibly moving waves, and what floats agrees with what is drawn (same wave function, asserted numerically rather than by eye)
- [ ] Entering the water summons the fairy godmother, who bubbles Jimothy back to the nearest shore with a line — including when he arrives fat and rolling at speed (JIM-29)
- [ ] Frame rate holds with water plus a loaded city — measured, and compared against the milestone-12 baseline of 83 draw calls
- [ ] The island reads as an island from the ground — verified by user playtest
- [ ] The water reads as *conspicuously too good* — **verified by user playtest**, since that is the entire brief and no metric captures it

## Exit condition

User waddles to the edge of the world, hits a beach instead of an invisible wall, looks out at the sea, and finds it unreasonably beautiful for a game about a fat raccoon.
