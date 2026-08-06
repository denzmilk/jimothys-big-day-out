# Backlog

> Out-of-scope ideas, feature requests, and follow-ups captured during sessions but **not** worked on in the session that captured them. Read at the start of every milestone-creation conversation. Append-only — promoted items get a checkbox tick and a link to the milestone that absorbed them, not a deletion.
>
> If an item turns out to be wrong / no longer wanted, mark it `~~struck through~~` with a one-line reason rather than removing it; future sessions need to see that it was considered and rejected.

## Gameplay & features

- [x] Fatness growth system — every snack visibly fattens Jimothy (body scale from the existing `snacksEaten` counter); fat IS the score. Trade-offs open: slower / bigger catch-target / can't fit in hide spots. Possibly display score as weight ("14.2 kg"). → milestone 05-fatness-and-food.md (visual growth + jiggle + two-tier food economy; trade-offs and weight display still open)
  - Source: 2026-07-23 Chris ("the more food you eat, the fatter jimothy gets… a game about getting big and fat without getting captured"; "distort and wobble jimothys body to make him big a jiggly as he eats"; "some you gotta stop to eat vs. just kind of scooping as you go")
  - Rough size: M · Rough value: L
  - Notes: core-fantasy feature, cheap first pass (scale the body group; slop-rig pieces scale naturally later). Slot right after milestone 02 — the trade-offs need pursuers to matter.
- [ ] Locals (civilians) + chaos-heat expansion — wandering neighbours who react to Jimothy: startled leaps, dropped groceries, comedic fleeing. Scaring/slapstick-bonking them raises heat; strictly cartoon, no gore. Mess objects (flower pots, bins, fences?) as additional chaos sources.
  - Source: 2026-07-23 Chris ("the more chaos you bring, the more the stars go up — scaring people, hurting people, knocking over bins, making a mess")
  - Rough size: L · Rough value: L
  - Notes: heat plumbing lands in milestone 02; civilians extend its sources afterward. Also the natural targets for the powerup arsenal.
- [ ] Silly powerup arsenal — pickups that weaponize chaos or aid escape: bubble blower (traps people in floating bubbles), poop-yourself gun, dance ray, sick ray (vomit), kamehameha, extra-long legs (stretchy-tube synergy!), super jump, food magnet. Chaos tools spike heat; movement tools dodge pursuers.
  - Source: 2026-07-23 Chris (full list verbatim from session)
  - Rough size: L · Rough value: L
  - Notes: post-slice content, gated on civilians existing (most powerups need targets). Extra-long legs should reuse the procedural leg rig. Delivery method open (gameplan open questions).

- [ ] Pants as wearable cosmetic — Jimothy visibly wears looted pants for the rest of the run (vs score-only pickup)
  - Source: 2026-07-23 scoping session ("maybe there's pants in trees")
  - Rough size: M · Rough value: L
  - Notes: pure comedy/clip value; blocked on the milestone 03 loot system and the open question below
- [ ] Shells knock over trash cans — tank fire causes collateral chaos that feeds the score
  - Source: 2026-07-23 milestone 03 design notes
  - Rough size: S · Rough value: M
- [ ] Tree score-banking / heat interaction — climbing the big tree banks the combo or has some mechanical payoff beyond loot
  - Source: 2026-07-23 idea-phase open question
  - Rough size: M · Rough value: M
- [x] Camera-relative movement + mouse orbit — v1 movement is world-aligned WASD with a facing-trailing camera; revisit if playtest says steering feels off, and mouse-orbit was in the original input scoping → milestone 04-dev-tools.md (promoted after Chris's playtest confirmed steering felt off)
  - Source: 2026-07-23 milestone 01 implementation
  - Rough size: M · Rough value: M
- [ ] Jimothy modular slop-rig + runtime model splitter — ONE full-Jimothy static GLB from Meshy free (piece-by-piece generation isn't possible there: no prompt control), split in-engine at load time into head / body / snub-tail: classify triangles by centroid against two cut planes (neck + tail base) whose positions are DevTools sliders, build three BufferGeometries reusing the GLB's material, and parent them into the existing group slots. Jagged cut edges hide inside slight piece overlap (slop-approved). Then procedural animation per piece: head bob/look, speed-scaled tail wiggle, body waddle-roll, plus stretchy-tube legs (Adventure-Time style, spring/step gait: hip anchors, foot targets that step past a drift threshold, tube stretch between). DevTools "Rig" tab: cut-plane sliders + per-piece offset/scale/rotation, persisted like all overrides, exportable as rig JSON.
  - Source: 2026-07-23 Chris mid-session ("build our own rigging and animation tool… slop one together in-engine"; "stitch them together in game"; "I might need a way to edit the model — it's not liking generating just a body in Meshy free")
  - Rough size: L · Rough value: L
  - Notes: needs no Blender, no rigging, no piece exports, no extra Meshy generations — one `jimothy.glb` is the entire external dependency. Runtime split also means re-cutting is a slider drag, not a re-export. Blender chop remains the manual fallback if the splitter fights us. Should become milestone 05; blocked only on `public/assets/models/jimothy.glb`.

- [ ] Silly rideables — terrible-on-purpose vehicles Jimothy can ride (shopping trolley, kid's scooter, escaped Roomba, a skateboard, the monorail?) with deliberately bad animation and worse physics. Comedy comes from the jank, not the driving model.
  - Source: 2026-07-23 Chris ("some silly rideables with terrible animations and physics")
  - Rough size: M · Rough value: L
  - Notes: pairs with the voxel city (ADR-0003) — a trolley at speed should smash through walls. Jimothy is kinematic-while-controlled, so a rideable is a state swap, not a new controller.
- [ ] Teardown-grade destruction — structural integrity (unsupported voxels fall), material-dependent toughness (glass shatters, brick resists), and cutting/pushing through walls rather than only sphere blasts. Reference: Teardown.
  - Source: 2026-07-23 Chris ("Inspiration from Teardown for destructability is where I want to go with it")
  - Rough size: L · Rough value: L
  - Notes: the current implementation does sphere damage + debris only. Structural collapse needs a connectivity pass (flood-fill from ground per chunk-island) — expensive, so budget it as its own milestone after the city exists.
- [ ] Seattle landmarks — Space Needle, Pike Place, Fremont Troll, monorail, Amazon spheres, ferries, Mount Rainier backdrop.
  - Source: 2026-07-23 Chris ("We will need to do a seattle themed city too")
  - Rough size: L · Rough value: L
  - Notes: ⚠️ LEGAL — the Space Needle's *shape* is a registered trademark (Space Needle LLC) and "Pike Place Market"/its neon sign are City of Seattle marks. CC0 asset licences do NOT clear trademark. Use deliberately off-model parodies ("the Space Noodle") for the same joke with far less exposure.

- [ ] Jimothy's den interior + lore props — dress the squashed trash-can house from the verified prop list in `docs/lore.md`: the tipped "raccoon-resistant" green bin (Toronto spent CA$31M on these; raccoons beat them by TIPPING THEM OVER — this game's core verb), the "Saint Jimothy" stained-glass window, a defeated-padlock trophy board with one mounted upside-down, the shredded city proclamation as bedding, a bobblehead of himself, the "WHITE HOUSE RACCOON" collar, and the cat-food-and-sprung-trap that foreshadows the net.
  - Source: 2026-07-23 Chris ("Jimothy's house should be a squashed sideways trash can - maybe do research on what Jimothy/racoons do to add in some LORE into his house")
  - Rough size: M · Rough value: L
  - Notes: den shell already built in `VoxelCity.buildTrashCanDen`; this is the interior dressing. `docs/lore.md` holds the full 15-prop list plus accuracy guardrails — the game references a real living animal and real institutions, so read the guardrails before writing any in-game text (no "diagnosed with", no UW diploma, never depict feeding him, shiny-hoarding is a myth).
- [ ] "Real raccoon facts" credits panel — one screen of genuine coexistence info, following the precedent of Chris Pirillo's 8-bit Jimothy game, which shipped real tips in its manual and got warm press for it. Cheap, on-brand, and inoculates the project against "glamourising wildlife harassment."
  - Source: 2026-07-23 lore research (docs/lore.md guardrails)
  - Rough size: S · Rough value: M

- [ ] Stealable vehicles + rideables — cars, shopping trolley, scooter, monorail. Terrible-on-purpose handling; a trolley at speed smashes voxel walls. Jimothy is kinematic-while-controlled so a vehicle is a controller state swap, not a second controller.
  - Source: 2026-07-23 Chris ("vehicles (stealable)", earlier "silly rideables with terrible animations and physics")
  - Rough size: L · Rough value: L · Roadmap: Phase 4
- [ ] Ragdoll bodies — pedestrians, paparazzi and animal control get jointed ragdolls. INJURED, NEVER KILLED: they flop, crawl and get back up. Goat-sim register, strictly cartoon (see docs/lore.md guardrails).
  - Source: 2026-07-23 Chris ("more pedestrians with ragdoll effects (goat sim vibes)", "enemies can be injured/ragdolled (not killed)")
  - Rough size: L · Rough value: L · Roadmap: Phase 2 — unblocks most of the weapon arsenal
- [ ] Crowd-scale pedestrians — far more than the current 26, via instancing plus a shared ragdoll pool so only nearby/hit people simulate.
  - Source: 2026-07-23 Chris ("more pedestrians")
  - Rough size: M · Rough value: M · Roadmap: Phase 2
- [ ] Day/night cycle — golden hour → dusk → night → dawn. Raccoons are nocturnal, so night should be a mechanical advantage: thinner crowds, easier hiding, faster heat decay in darkness, brighter/scarier camera flashes.
  - Source: 2026-07-23 Chris ("day/night cycle")
  - Rough size: M · Rough value: L · Roadmap: Phase 3
- [ ] Temporary pickups/weapons — fire extinguisher (propulsion + fog), taser, suction-cap gun, plus the earlier list (bubble blower, dance ray, sick ray, food magnet, super jump, long legs). Timed pickups with a duration meter.
  - Source: 2026-07-23 Chris ("temporary pickups/weapons (extinguishers, tazers, suction cap guns etc.)")
  - Rough size: L · Rough value: L · Roadmap: Phase 5 — depends on ragdoll
- [ ] Enterable houses — doors that open, interiors with food/lore/residents. Two approaches (hollow the voxel buildings vs. portal to an interior scene) — wants an ADR. Voxel-hollowing keeps destruction continuous, which is more Teardown.
  - Source: 2026-07-23 Chris ("houses to enter")
  - Rough size: L · Rough value: L · Roadmap: Phase 4
- [ ] Streaming / virtual ground — stop allocating undamaged ground voxels up front; render intact terrain as merged tiles and materialise chunks only where damaged. MEASURED BLOCKER: 5×-per-side map costs 19 s boot, 1007 draw calls, 3.5 GB heap; currently capped at 5× area instead.
  - Source: 2026-07-23 measurement while scaling the city
  - Rough size: L · Rough value: L · Roadmap: Phase 1 — prerequisite for a genuinely city-scale map
- [ ] Material toughness — glass shatters, clapboard splinters, brick resists, concrete needs a fat Jimothy. Makes fatness-as-power legible.
  - Source: 2026-07-23 roadmap planning
  - Rough size: M · Rough value: M · Roadmap: Phase 1
- [ ] Water physics — ponds, fountains and puddles Jimothy can splash into, wade through and swim in. Buoyancy on debris and containers; a fountain that keeps refilling after you smash its basin. Raccoons famously douse food in water, so there's an identity beat here too (`docs/lore.md`).
  - Source: 2026-08-06 Chris ("water physics for ponds/fountains etc.")
  - Rough size: L · Rough value: M · Roadmap: Phase 1 (new)
  - Notes: interacts hard with destructible voxels — if you can blast a pond's basin, the water has to go somewhere. Cheapest credible version is a water LEVEL per body (a plane + a volume test) with drain-on-breach, not per-voxel fluid sim. Decide the model in an ADR before coding; a cellular-automata fluid across a streamed world is a milestone on its own.
- [ ] Finer voxels for better breakaway — shrink `VOXEL.SIZE` (currently 0.55) so destruction crumbles instead of popping out in slabs.
  - Source: 2026-08-06 Chris ("finer voxels for better breakaway")
  - Rough size: S to change, L to afford · Rough value: M · Roadmap: Phase 1, AFTER streaming
  - Notes: ⚠️ HARD DEPENDENCY on streaming ground. Voxel count scales with the cube of 1/SIZE — halving SIZE is 8× the voxels and ~4× the chunk mesh faces. The current eager allocation already measures 19 s boot / 3.5 GB heap at 5×-per-side; halving voxel size on top of that is not survivable. Deliberately reverses the 2026-07-23 "voxel parts are very small" playtest call, so re-check the read-from-across-the-street legibility after changing it.
- [ ] Underground areas — sewers, basements, dug-out tunnels and hidden dens beneath the city. "More depth" both literally and as content: places to hide from heat, stashes of food, a second traversal layer.
  - Source: 2026-08-06 Chris ("more 'depth' with some hidden underground areas")
  - Rough size: L · Rough value: L · Roadmap: Phase 1/4
  - Notes: needs `VOXEL.GROUND_LAYERS` (currently 2 over bedrock) to grow a lot, which is another multiplier on the allocation problem — so it also wants streaming first. Interacts with hide spots (a sewer is the ultimate bush) and with `groundHeightAt`, which currently assumes one surface per column and would snap Jimothy to the roof of a tunnel.
- [ ] Aimable headbutt — let the player pitch the headbutt up/down (and hold to charge?) so it can be aimed at a wall's base, a first-floor window, or deliberately at the ground. Currently it always fires flat at chest height.
  - Source: 2026-08-06 Chris ("aimable headbutt")
  - Rough size: M · Rough value: M
  - Notes: the "stop it breaking ground by default" half is a separate, much smaller fix — see the bug list. Aiming needs an input decision (mouse pitch vs. modifier keys vs. auto-target the nearest surface) plus a reticle or the player can't tell where it will land.

- [ ] World variety — the city currently reads as a commune: identical craftsman houses in regular rows. Wants a real Seattle reference (Google Maps / Street View of an actual neighbourhood) to replicate, a proper road hierarchy rather than a uniform grid, several distinct building types with varied footprints/heights/materials/setbacks, and randomised furnishings inside the houses.
  - Source: 2026-08-06 Chris ("world variety, we need to get a google map or reference version of seattle to replicate, it looks like a commune atm with the same houses in rows - need roads, building types, basic randomised furnishings inside the houses")
  - Rough size: L · Rough value: L · Roadmap: Phase 1/4
  - Notes: splits into at least three jobs that ship independently — (a) reference-driven layout: pull a real Ballard/Fremont block pattern (arterials, side streets, alleys, lot subdivision, corner shops) and drive `buildDistrict` from it instead of the uniform `CITY.BLOCK` grid; (b) building-type library: parameterise `buildCraftsman`/`buildTower` into a family with per-lot variation, and vary materials/roof pitch/porches; (c) interior furnishings, which is the same work as the "enterable houses" item and should be decided with it (hollow the voxel buildings vs. portal to an interior scene). ⚠️ Same legal guardrail as the landmarks item: replicate the *character* of a neighbourhood, not identifiable private homes; and see `docs/lore.md`. Interiors multiply voxel count, so (c) is downstream of streaming.

## Known bugs

> **Bugs live in [`docs/issues.md`](issues.md)**, not here. This file is for ideas we chose not to do yet; that one is for things that are wrong, with evidence and code locations. The five defects Chris reported on 2026-08-06 are `JIM-10`, `JIM-11`, `JIM-12`, and the fixed `JIM-14`–`JIM-17`.

## Polish & juice

- [ ] Trump sun / Trump moon — the sun is a Donald Trump face with the makeup on (orange, bright, beaming); the moon is the same face with it off (pale, grey, unlit). The joke lands entirely on the day/night transition, so build it with that item, not before.
  - Source: 2026-08-06 Chris ("make the sun donald trump with his makeup on and the moon donald trump with his makeup off")
  - Rough size: S · Rough value: M · Roadmap: Phase 3, rides on the day/night cycle
  - Notes: political caricature of a public figure is squarely satire, and the project already parodies real institutions — but it is a real living person, so keep it a stylised caricature rather than a photo/likeness-scan, and expect it to be the single most likely thing to draw a takedown or storefront-policy complaint. Worth a toggle or a swap-in alternative face if the game is ever submitted somewhere with a "no real people" content rule. Pairs naturally with the heat-tier lighting: makeup-on sun = exposed daytime, makeup-off moon = raccoon advantage.

- [ ] Asset milestone — Jimothy Meshy 5 GLB (waddle/scurry/stagger/caught clips), CC0 GLBs for houses/cans/trees/pursuers/tanks, CC0 photo PBR textures for the demi-real look
  - Source: 2026-07-23 scoping session
  - Rough size: L · Rough value: L
  - Notes: Chris exports jimothy.glb manually from the Meshy web app (no API on free tier); everything else via game-3d-assets skill
- [ ] Audio milestone — procedural Web Audio: honks, trash percussion, flash zaps, shell whistles/booms, heat-layered chase theme
  - Source: 2026-07-23 scoping session (gameplan audio direction)
  - Rough size: M · Rough value: L

## Tech & refactors

- [ ] GitHub Pages deploy — Actions workflow building `dist/` to Pages; `base: './'` already set in vite.config.js
  - Source: 2026-07-23 scoping session (deploy decision)
  - Rough size: S · Rough value: L

## Tooling & QA

- [x] Full Playwright suite config — `playwright.config.js` with webServer auto-start so `npx playwright test` doesn't need a manually running dev server → milestone 01-core-waddle-loop.md (trivially adjacent; needed to write the specs)
  - Source: 2026-07-23 scaffold session
  - Rough size: S · Rough value: M

## Open questions

- Pants: cosmetic (Jimothy wears them) or score-only? Decide before milestone 03's loot table is finalized.
- Mobile touch support and multiplayer are v1 anti-goals (gameplan) — revisit only after the loop ships.
