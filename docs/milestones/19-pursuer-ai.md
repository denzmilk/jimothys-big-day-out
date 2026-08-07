# Milestone 19: Pursuer AI — vision, memory and giving up

## Status

scoped, not started. **Should land before milestone 18.**

## Objective

Give the pursuit an actual brain.

> Chris, 2026-08-07: *"they just make a beeline for you and never stop - no AI there at all."*

He is describing the code exactly. `Pursuers._steer` is:

```js
const dx = jp.x - group.position.x;   // jp is Jimothy, always
group.position.x += (dx / d) * step;  // straight at him, through anything
```

There is no vision, no line of sight, no memory, no search, no giving up and no patrol. A paparazzo on the far side of the island knows precisely where Jimothy is at all times and walks through buildings to reach him. **Hiding in a bush drains heat but does not actually break their knowledge of him** — the bush works on the heat number, not on the pursuer.

## Why this blocks the underground

Milestone 18 puts a sewer network under the city, and Chris has decided **pursuers follow Jimothy down there**. A beeline AI in a tunnel network is worse than useless: they would track him through solid rock, ignore every corner and dead end, and make the most atmospheric space in the game the least interesting. **Occlusion-based vision is what makes tunnels mean anything** — corners to break line of sight behind, darkness that shortens sight range, dead ends that are a gamble.

The same is true above ground, it is just less obvious: the city has alleys and blocks precisely so there is something to duck behind.

## The shape

A standard awareness model, kept small:

| state | behaviour |
|---|---|
| **Patrol** | Walk a beat, or loiter somewhere plausible. Currently they stand and stare. |
| **Suspicious** | Heard something, or caught a glimpse. Move to investigate, do not commit. |
| **Chase** | Has line of sight. This is today's behaviour, and it is correct *here*. |
| **Search** | Lost sight. Go to the last known position, then cast around it. |
| **Give up** | Nothing found after a while. Back to patrol, or despawn. |

**Vision** is a cone (range, half-angle) plus a line-of-sight check. `VoxelWorld.solidAtWorld` already exists, so a DDA march along the ray through the voxel grid is cheap and exact — it will respect buildings, rubble he has just made, and tunnel walls, all for free.

**Hearing** matters as much as sight and is more on-theme: **destruction is loud.** A headbutt through a wall should pull every pursuer in earshot toward the noise, not toward Jimothy. That makes the demolition tool a genuine decision rather than free chaos, and it gives `Events.WORLD_DEMOLISHED` a second job.

**Hiding becomes a vision modifier**, not a separate system. A bush should cut sight range hard rather than toggling a flag, so it works because they cannot see you rather than because a number said so.

## What it fixes that is already broken

- **Bushes are the only pressure valve and they do not really work** — the pursuer still knows.
- **Alleys, corners and blocks currently do nothing tactically.** Milestone 16 built a city with places to duck behind and nothing that cares.
- **`animal control nets jimothy` has been the flakiest spec in the suite.** A pursuer with no search behaviour either arrives instantly or never, which is exactly the shape of a flaky timing test.
- **Heat tiers control head-count and nothing else.** Escalation should change *behaviour* — paparazzi hang back for a photo, animal control commits, the army does not care about line of sight at all.

## Scope

- `src/gameplay/Pursuers.js` — the state machine, per-pursuer.
- `src/level/VoxelWorld.js` — a `raycast(from, to)` / `hasLineOfSight` helper via voxel DDA.
- `src/core/Constants.js` — `VISION` (range, half-angle, dark-multiplier), `HEARING` (radius per event), `SEARCH` (duration, wander radius), per-pursuer-type overrides.
- `render_game_to_text()` — each pursuer's **state**, whether it can see Jimothy, and its last-known-position. Without this, none of the above is assertable and the specs stay eyeball-only.

## Out of scope

- Pathfinding. They can keep steering straight at their target for now; the target just stops being "wherever Jimothy is". A* over the voxel grid is its own milestone, and worth doing only once the states are right.
- Squad coordination, flanking, radio. One brain each.
- The army (tier 5) — tanks arguably *should* be dumb and terrifying.

## Dependencies

- **Depends on:** nothing hard. Better after milestone 17 (terrain), since slopes change what "can see" means.
- **Blocks:** milestone 18 — the underground is not worth building for a beeline AI.

## Acceptance criteria

- [ ] A pursuer with no line of sight to Jimothy does **not** move straight at him — the assertion that this milestone happened at all
- [ ] Breaking line of sight around a corner causes a search at the last known position, not instant re-acquisition
- [ ] Searching ends: after `SEARCH.DURATION` with no sighting, the pursuer gives up
- [ ] A bush cuts sight range so that hiding works by not being seen, not by a flag
- [ ] Destruction noise pulls pursuers toward the **noise**, not toward Jimothy
- [ ] Vision respects geometry — assert a pursuer cannot see through a building, and that blasting the building open restores the sightline
- [ ] Heat tier changes behaviour, not just head-count
- [ ] Pursuer state, sight and last-known-position are in `render_game_to_text()`
- [ ] `animal control nets jimothy` stops being flaky
- [ ] The chase reads as a chase — **verified by user playtest**

## Exit condition

User is chased into an alley, breaks line of sight, hides, and watches animal control search the wrong end of the alley and give up — then blasts a wall somewhere else and sees them all turn toward the noise.

## Notes

- **Resolved 2026-08-07:** pursuers **follow Jimothy underground**. Chris: *"Nah they can follow you in."* That closes milestone 18's open question — and is only a good decision if this milestone lands first, since it is vision and search that make an underground chase a chase rather than a formality.
- Keep the steering. The bug was never *how* they move, it was that the target was always Jimothy. Point the existing `_steer` at a `target` that the state machine owns and most of this milestone is the state machine.
