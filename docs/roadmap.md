# Roadmap — Jimothy's Big Day Out

> Written 2026-07-23 from Chris's feature list. Ordered by **what unblocks what**, not by excitement. Each phase says what it needs and what it risks. Issues and known problems are marked ⚠️.
>
> Source of truth for scope is still `docs/gameplan.md`; this file is the delivery order. Individual items graduate into `docs/milestones/NN-*.md` when started.

## Where we are (2026-07-23)

**Working and playtested:** waddle/scurry/hop, camera-relative controls, trash containers (4 kinds) that tip and spill, two-tier food (scoop vs. stop-and-chomp), fatness with jiggle + speed/hiding penalties, heat tiers 0–3, paparazzi + animal control + the net, capture/restart, hide bushes, dev-tools panel, destructible voxel city with deformable ground, headbutt + roll moves, 26 pedestrians who flee, Blender asset pipeline, TRELLIS local model generation.

**Not started:** everything in phases 2–6 below.

## ⚠️ Open issues carried forward

> **The register moved to [`docs/issues.md`](issues.md)** (2026-08-06) — it carries evidence, code locations and status per issue, which this table had no room for. IDs match. **Log new issues there, not here.**

| ID | Issue | Impact | Where |
|---|---|---|---|
| JIM-01 | **Map size is capped by eager ground allocation.** 5× per side measured at 19 s boot / 1007 draw calls / 3.5 GB heap. Currently at 5× area instead. | Blocks a genuinely city-scale map | Phase 1 |
| JIM-02 | **No structural integrity.** Blast a wall's base and the roof floats. This is the gap between "voxels" and "Teardown". | Destruction reads as fake | Phase 1 |
| JIM-03 | **4 specs failing** (`score and combo`, `heat rises with chaos`, `tier-2 camera flash`, `interrupted feast`) — list corrected 2026-08-06 and confirmed pre-existing. | Feast eating unverified | Phase 0 |
| JIM-04 | **Den is an empty shell.** Lore props researched (`docs/lore.md`) but not placed. | Missed identity beat | Phase 3 |
| JIM-05 | **Tiers 4–5 unreachable** — police and the ARMY/tanks exist only in the gameplan. | The escalation payoff is missing | Phase 2 |
| JIM-06 | **No audio at all.** `moss-sfx` MCP is connected and unused. | Game is silent | Phase 3 |
| JIM-07 | **Buildings are hollow shells with no interiors**, and windows/doors are decorative. | Blocks "enter houses" | Phase 4 |
| JIM-08 | Pedestrians are capsules that slide; no ragdoll, no injury states. | Blocks goat-sim comedy | Phase 2 |
| JIM-09 | No deploy pipeline yet (GitHub Pages workflow unwritten). | Can't share it | Phase 6 |
| ~~JIM-10~~ | ~~**Jimothy's mesh is not watertight**~~ — fixed 2026-08-07 (milestone 09). Cause was our own prep script decimating before welding, not the source asset. 56,414 → 940 boundary edges. | — | done |
| JIM-11 | Legs read as detached at the socket — separate from the fatness drift already fixed. | Same | Phase 0 |
| JIM-13 | **City reads as a commune** — identical houses in rows, uniform grid, no interiors. | The world has no variety | Phase 1/4 |

---

## Phase 0 — Stabilise (small, do first)

Fix what's already broken before adding surface area.

- Repair the 3 failing feast specs; confirm feast eating end-to-end (⚠️ #3).
- Commit the backlog of staged work.
- Re-verify the full loop on the bigger map: heat still reachable, pursuers still find you at city scale, hide spots still relevant (they're currently clustered near spawn — the city grew around them).

## Phase 1 — Make the world hold up (foundation)

Everything later sits on this. Doing it after the content is written means redoing the content.

1. **Virtual/streaming ground** (⚠️ #1). Stop allocating undamaged ground: render intact terrain as merged tiles, materialise voxel chunks only where damage happens, and generate city blocks on demand around the player. *This is what unlocks the full 5×-per-side map.* Biggest single technical job on the list.
2. **Structural integrity** (⚠️ #2). Flood-fill support from bedrock per chunk-island; unsupported voxels convert to debris and fall. Budget it as its own milestone — it's the Teardown feel.
3. **Material toughness.** Glass shatters, clapboard splinters, brick resists, concrete needs a fat Jimothy. Makes fatness-as-power legible: you can *see* which materials you've outgrown.

## Phase 2 — Bodies and consequences (the comedy layer)

Depends on Phase 1 only loosely; can start in parallel.

4. **Ragdoll physics for people** (⚠️ #8). Pedestrians, paparazzi and animal control get simple jointed ragdolls. **Injured, never killed** — they flop, groan, crawl, and get back up. This is the goat-sim register and it must never read as gore (see `docs/lore.md` guardrails: cartoon slapstick only).
5. **Many more pedestrians.** Current 26 capsules → crowds via instanced rendering + a shared ragdoll pool (only nearby/hit people simulate). Crowd density is what makes a city feel alive.
6. **Injury states for pursuers.** A ragdolled paparazzo drops his camera (loot?), a floored animal-control officer takes seconds to recover — chaos as a defensive tool, not just a score source.
7. **Heat tiers 4–5: police cordon and the ARMY** (⚠️ #5). Tanks, shells that ragdoll-launch Jimothy without ending the run. The net stays the only run-ender. Blocked on ragdoll (Jimothy needs a launched state too).

## Phase 3 — Identity and feel

8. **Den interior + lore props** (⚠️ #4). The 15 researched props in `docs/lore.md` — the tipped raccoon-resistant bin, "Saint Jimothy" stained glass, the padlock trophy board. Cheap, high identity.
9. **Audio** (⚠️ #6). `moss-sfx` for honks, trash clatter, camera flashes, tank booms; procedural Web Audio for a heat-layered chase theme. Silent games feel broken.
10. **Day/night cycle.** Raccoons are nocturnal — night should be his advantage: pedestrians thin out, hiding is easier, paparazzi flashes read brighter and more dangerous. Tie heat decay to darkness so the cycle is mechanical, not just a lighting filter. Golden-hour → dusk → night → dawn.

## Phase 4 — Vehicles and interiors

11. **Stealable vehicles.** Cars, a shopping trolley, a scooter, the monorail. Jimothy is kinematic-while-controlled, so a vehicle is a *state swap* on the controller, not a second controller. Terrible-on-purpose handling; a trolley at speed should smash through voxel walls (needs Phase 1 material toughness to feel right).
12. **Enterable houses** (⚠️ #7). Interiors for a subset of buildings: doors that open, rooms with food and lore, residents to terrify. Two viable approaches — hollow the voxel buildings with authored interior rules, or portal to a separate interior scene. Decide with an ADR; the voxel-hollowing route keeps destruction continuous (blast a wall, walk in) and is much more in keeping with Teardown.

## Phase 5 — Toys

13. **Temporary pickups/weapons.** Fire extinguisher (propulsion + fog), taser (ragdolls a target), suction-cap gun, bubble blower, dance ray, sick ray, food magnet, super jump, extra-long legs. Each is a timed pickup with an ammo/duration meter. Depends on ragdoll (Phase 2) — most of them are only funny if people react physically.
14. **Rideables** (existing backlog item) — folded in with vehicles.

## Phase 6 — Ship

15. **Seattle landmarks** — ⚠️ legal: the Space Needle's *shape* is a registered trademark and Pike Place's name/sign are City of Seattle marks. Use deliberate parodies ("the Space Noodle").
16. **Real-raccoon-facts credits panel** (`docs/lore.md` guardrails).
17. **GitHub Pages deploy** (⚠️ #9) + a promo capture.

---

## Suggested order

Phase 0 → **Phase 1.1 (streaming ground)** → Phase 2.4 (ragdoll) → Phase 3.9 (audio) → then pick by appetite.

Rationale: streaming ground unblocks the map size you actually want and stops later content being authored twice. Ragdoll unblocks half of Phase 2 and all of Phase 5. Audio is the cheapest large jump in perceived quality. Everything else is content that slots onto those three.
