# Milestone 13: Navigation — minimap, map screen, waypoints

## Status

not started

## Objective

Make a city too big to hold in your head navigable.

> Chris, 2026-08-07, choosing the streaming-ground target: *"Much bigger map - with a map function, fast travel, minimap."*
> Then, on being asked how fast travel should interact with the chase: *"nvm skip fast travel, waypoints only."*

Split out of milestone 12 deliberately. Streaming is infrastructure with a measurable exit condition; this is UI with a felt one. Bundling them would give one milestone whose exit condition could not be tested incrementally, and would let UI work block a perf fix that four other things depend on.

## Resolved: no fast travel, waypoints instead

Fast travel was in the original ask and was **cut by Chris after one question**, which is the right outcome and worth recording so it is not re-proposed.

The problem: heat escalates paparazzi → animal control → police → army, and the net is the *only* run-ender. A teleport-at-will button makes the entire pursuit structure optional — the game is a chase, and fast travel is an escape button. Every rule that fixes this (low-heat-only, costs your combo, den-only) is a compromise that adds a tuning knob and a way to feel cheated.

Waypoints solve the actual problem — *"the map is big and I want to get to that thing over there"* — with no effect on the chase whatsoever. You still have to run there, which is the game. **Do not reintroduce fast travel** without a deliberate decision about the pursuit; the analysis above is why it went.

## Dependencies

- **Depends on:** milestone 12 (streaming ground). Specifically its **layout layer** — the pure, cheap, seeded "what is at (x, z)?" query.
- **Blocks:** nothing, but it is what makes a big map usable rather than merely large.

**Why the layout layer is the whole dependency:** under streaming, most of the world is not generated at any given moment. A minimap drawn from loaded chunks would show a small disc around the player and nothing else. It reads layout instead, which knows the entire city without building any of it — including places Jimothy has never been, which is exactly where you want to set a waypoint.

## Scope

- `src/ui/Minimap.js` (new) — always-on corner map: roads and building footprints from layout, Jimothy's position and heading, pursuers, his den, and the active waypoint.
- `src/ui/MapScreen.js` (new) — full-screen map on a key, with pan/zoom and waypoint placement.
- Waypoint state on `GameState`, plus an on-screen edge indicator with distance when the target is off-screen — otherwise a waypoint set on the map is invisible the moment you close it.
- `src/core/Constants.js` — `MINIMAP` (size, zoom, colours, update rate) and `WAYPOINT` (marker size, indicator behaviour, arrival radius).
- `render_game_to_text()` — expose minimap contents, waypoint position and distance, so this is testable without reading pixels.

## Out of scope

- **Fast travel.** Cut deliberately — see above.
- Multiple simultaneous waypoints, or a quest/objective system. One marker the player sets by hand.
- Fog of war / discovered-vs-undiscovered map. Attractive, but it needs a persistence story and the game is a single-run score attack.
- Landmark icons — pairs naturally with the Seattle-landmarks backlog entry, which carries a **trademark warning**; read it before drawing anything recognisable.

## Acceptance criteria

- [ ] Minimap shows roads and buildings for the surrounding area **including regions that have never been generated** — the assertion that proves it reads layout, not loaded chunks
- [ ] Jimothy's position and facing are correct on it at any heading and any distance from origin
- [ ] Pursuers appear on it, so the minimap actually helps you escape
- [ ] Full map opens, pans and zooms, and closes without disturbing the running game
- [ ] A waypoint can be placed anywhere on the map, **including on terrain that has never been generated**
- [ ] With the map closed, an off-screen waypoint shows an edge indicator with live distance — and it stays correct as he turns
- [ ] The waypoint clears on arrival (within `WAYPOINT.ARRIVAL_RADIUS`) and on restart
- [ ] Minimap cost does not scale with world size — it queries a window, never the whole city
- [ ] Restart clears and rebuilds all of it, leaking nothing

## Exit condition

User opens the map on a city far larger than one screen, sees where he is, drops a waypoint on somewhere interesting, closes the map, and is led there by the indicator — running the whole way, with the chase entirely unaffected.

## Notes

- The minimap is the first thing in this project that renders a *view of the world* rather than the world. Prefer a canvas overlay driven by layout queries over a second three.js camera: a top-down camera would only see loaded chunks, which is the exact problem this milestone exists to avoid.
- Update rate is a real budget. Redrawing every frame is wasteful for something that changes slowly; redraw on a threshold of player movement.
- The waypoint indicator is also the natural home for anything later that wants to point at something — the den, a feast, a landmark. Build it as "point at a world position", not as "point at the waypoint".
