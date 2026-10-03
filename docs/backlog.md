# Backlog

> Out-of-scope ideas, feature requests, and follow-ups captured during sessions but **not** worked on in the session that captured them. Read at the start of every milestone-creation conversation. Append-only — promoted items get a checkbox tick and a link to the milestone that absorbed them, not a deletion.
>
> If an item turns out to be wrong / no longer wanted, mark it `~~struck through~~` with a one-line reason rather than removing it; future sessions need to see that it was considered and rejected.

## Gameplay & features

- [x] **Size-tiered food and edible destination buildings** → milestone 40 (planned, approved 2026-10-03). Chris cannot see small bin food once large; bridge growth with increasingly substantial food, including giant lobster/banana landmark buildings gated by Jimothy's size. Extends the existing farms/markets and landmark proposals. Size L; value L. Consumption and destruction persist during travel; eating remains deliberate.
- [x] **Landmark tourists** → milestone 41 (planned, approved 2026-10-03). Visitors travel to points of interest, look around, pose and take selfies, then react to rampaging. Size M; value M. Uses existing MPFB people, IK and ragdolls; depends on landmark sites.
- [x] **Drivers, parking and getting in/out** → milestone 42 (planned, approved 2026-10-03). People visibly own a trip from driving to parking, walking at a destination and returning. Size L; value L. Traffic, seats, door exits, damage and streaming share one ownership state; player driving remains separate.

- [ ] **Farms and distinct food markets with greater risk/reward.** Extend the pending Seattle/collectible content proposal with food destinations that differ in food, layout and exposure.
  - Source: 2026-10-03 Chris ("need some farms and markets too for differnt food types/locations with freater risk/reward").
  - Rough size: L · Rough value: L
  - Proposed direction, pending content-plan confirmation: allotments/orchards for scattered fruit and vegetables with exposed rows; farmyards/barns for eggs, produce crates and larger harvest meals behind fences and residents; produce markets for dense small pickups amid vendors; fish markets for valuable seafood feasts in busy, narrow aisles; bakery/night-market stalls for cakes and prepared feasts with long eating commitments. Distinct silhouettes/names/payouts; full meals keep the existing interruptible eating action. Risk comes from witnesses, pursuit access, time exposed and escape routes, while the net remains the only run-ender. Quiet edge scraps provide an alternative to the busiest central rewards.
  - Dependencies: existing food identities, inhabited interiors, pedestrian reactions, destructible props and streaming; shared site reservations with the pending landmark route. Per-run depletion must survive leaving/re-entering to prevent unlimited food from streaming resets. New food assets need sourced references, editable Blender preparation and in-game inspection.
  - Proposed siting: Rummage Valley's outer edge for farm plots/barns, Bandit Bay for a neighbourhood produce market, and Trashattan's waterfront market for seafood and prepared-food stalls. Keep cheap edge scraps, richer central stashes and at least two escape routes at each site. Small Jimothy can use narrow gaps; giant Jimothy can break fences and stalls, attracting the existing escalating response. Eating alone remains heat-neutral; disturbing people and damaging the site creates heat. These are proposed placements, not validated/generated parcels yet.

- [x] **Usable collectibles and Seattle landmark placement — renewed request, 2026-10-03.** → milestones 43–45, approved and promoted 2026-10-03. Plan things Jimothy can pick up and use, explicitly **power washers and bubble guns**, and build Seattle-inspired landmarks into the island. Extends the existing silly-powerup, temporary-weapon, Seattle-landmark and island park/plaza entries below; those remain the source for earlier ideas.
  - Source: Chris ("need to plan out collectables too - things that jimothy can pickup and use, power washers, bubble guns etc. then as well landmarks based on seattle ... build those into the world").
  - Rough size: L · Rough value: L
  - Status: Chris approved tools → landmarks → food progression → tourists → drivers. The roster is 24 usable tools and 16 distinct landmarks (`docs/tool-landmark-roster.md`), replacing the earlier three-site proposal. Milestones 43–45 precede 40–42; all 24 tools and 16 sites are implemented, awaiting playtest. Keep the existing imaginary-Seattle direction and physical/destructible world contracts.
  - Audit before 43–45: `GameState`/`InputSystem` had no equipped-tool lifecycle. `islandPlan.js` has districts, hills, water and bridges; the unimported `cityPlan.js` still holds the old Space Noodle/plaza entries. Landmark work needs reserved sites in the active island plan, not another decoration overlay on generated houses.
  - Research: [Ballard origin reporting](https://www.geekwire.com/2026/8-bit-jimothy-viral-sensation-raids-trash-cans-eludes-paparazzi-in-seattle-creators-video-game/), [Space Needle history](https://www.spaceneedle.com/history), [Pike Place Market](https://www.pikeplacemarket.org/market-history/), [Troll's Knoll](https://www.seattle.gov/parks/parks/trolls-knoll-park), [Gas Works Park](https://www.seattle.gov/parks/parks/gas-works-park), [Ballard Locks fish ladder](https://www.nws.usace.army.mil/Missions/Civil-Works/Locks-and-Dams/Chittenden-Locks/Fish/), [Seattle ferry terminal](https://www.wsdot.com/Ferries/VesselWatch/TerminalDetail.aspx?terminalid=7), [monorail route](https://www.seattlemonorail.com/faq/). References checked 2026-10-03; new game names and interactions are design proposals, not historical claims.

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

- [x] Pants as wearable cosmetic — Jimothy visibly wears looted pants for the rest of the run (vs score-only pickup) → absorbed into **JIM-27 (Jimothy costumes)** in `docs/issues.md`, 2026-08-07
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
- [ ] Teardown-grade destruction — structural integrity (unsupported voxels fall), material-dependent toughness (brick resists), and cutting/pushing through walls rather than only sphere blasts. Glass shattering promoted to milestone 27 on 2026-10-02. Reference: Teardown.
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
- [x] Ragdoll bodies → milestone 29 (2026-10-02) — pedestrians, paparazzi and animal control get jointed ragdolls. INJURED, NEVER KILLED: they flop, crawl and get back up. Goat-sim register, strictly cartoon (see docs/lore.md guardrails).
  - Source: 2026-07-23 Chris ("more pedestrians with ragdoll effects (goat sim vibes)", "enemies can be injured/ragdolled (not killed)")
  - Rough size: L · Rough value: L · Roadmap: Phase 2 — unblocks most of the weapon arsenal
- [ ] Crowd-scale pedestrians — far more than the current 26, via instancing plus a shared ragdoll pool so only nearby/hit people simulate.
  - Source: 2026-07-23 Chris ("more pedestrians")
  - Rough size: M · Rough value: M · Roadmap: Phase 2
- [x] Day/night cycle → milestone 30 (2026-10-02; lighting first, crowd/stealth balance remains deferred) — golden hour → dusk → night → dawn. Raccoons are nocturnal, so night should be a mechanical advantage: thinner crowds, easier hiding, faster heat decay in darkness, brighter/scarier camera flashes.
  - Source: 2026-07-23 Chris ("day/night cycle")
  - Rough size: M · Rough value: L · Roadmap: Phase 3
- [ ] Temporary pickups/weapons — fire extinguisher (propulsion + fog), taser, suction-cap gun, plus the earlier list (bubble blower, dance ray, sick ray, food magnet, super jump, long legs). Timed pickups with a duration meter.
  - Source: 2026-07-23 Chris ("temporary pickups/weapons (extinguishers, tazers, suction cap guns etc.)")
  - Rough size: L · Rough value: L · Roadmap: Phase 5 — depends on ragdoll
- [x] Enterable houses, furniture, food and residents → milestone 38 / ADR-0006. Continuous destructible voxel rooms, open doorways and stairs. Hinged door interactions and house-specific lore dressing remain deferred below.
  - Follow-up: hinged doors and house-specific lore props remain on the backlog; this pass implements open entrances and furnished inhabited rooms.
  - Source: 2026-07-23 Chris ("houses to enter"); expanded 2026-10-02 food/interiors request
  - Rough size: L · Rough value: L · Roadmap: Phase 4
- [ ] Streaming / virtual ground — stop allocating undamaged ground voxels up front; render intact terrain as merged tiles and materialise chunks only where damaged. MEASURED BLOCKER: 5×-per-side map costs 19 s boot, 1007 draw calls, 3.5 GB heap; currently capped at 5× area instead.
  - Source: 2026-07-23 measurement while scaling the city
  - Rough size: L · Rough value: L · Roadmap: Phase 1 — prerequisite for a genuinely city-scale map
- [ ] Material toughness — clapboard splinters, brick resists, concrete needs a fat Jimothy. Makes fatness-as-power legible. Glass shattering promoted to milestone 27 on 2026-10-02.
  - Source: 2026-07-23 roadmap planning
  - Rough size: M · Rough value: M · Roadmap: Phase 1
- [x] Water physics → milestone 31 (2026-10-02; waves, local ripples, buoyancy and swimming; fountain/pond breach flow remains deferred) — ponds, fountains and puddles Jimothy can splash into, wade through and swim in. Buoyancy on debris and containers; a fountain that keeps refilling after you smash its basin. Raccoons famously douse food in water, so there's an identity beat here too (`docs/lore.md`).
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
- [x] Aimable headbutt — let the player pitch the headbutt up/down (and hold to charge?) so it can be aimed at a wall's base, a first-floor window, or deliberately at the ground. Currently it always fires flat at chest height. → promoted to `docs/milestones/20-aimable-headbutt.md` (2026-08-08). The input decision this entry flagged was resolved as **the aim is the camera** (mouse pitch while pointer-locked), and the reticle it insisted on is fed by the same `impactPoint` the blast uses. **Hold-to-charge was deliberately left here** — it is a separate feel decision and wants its own playtest.
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

- [ ] **Flatten the camera's pitch in a tight space, so the boom can sit back along the tunnel.** Milestone 21 gave the boom collision (JIM-41), and in a sewer that pins it at `COLLIDE_MIN` — 1.0 m, measured — because the follow boom rises 3.5 m over 7 m and a tunnel is 2.9 m tall. It stops the camera being inside the rock, which was the bug, but near-first-person is a big feel change for the underground. A boom that lowers its pitch as it gets squeezed would find the 5–6 m of clear tunnel that is genuinely there behind him.
  - Source: 2026-08-08, milestone 21 (measured while fixing JIM-41)
  - Rough size: S · Rough value: M
  - Notes: **wait for Chris's playtest before building it** — near-first-person in a pipe may simply be the right answer, and this is only worth doing if it reads badly. Related: milestone 20's known rough edge, that follow mode never places its camera from `pitch` at all.

- [ ] **A lean Jimothy can barely tunnel.** 10 flat swings at a sewer wall removed 7 voxels at fatness 0, against ~2 400 at fatness 40 — the blast radius is 0.75 m before any fatness bonus, so a thin raccoon just taps the rock. Arguably correct (`FAT_BLAST_SHARE: 1.0` is commented "this is the move eating is meant to buy") but it is close to the mechanic doing nothing at the low end, and digging is now how you get around down there.
  - Source: 2026-08-08, milestone 21 (measured during live-iterate)
  - Rough size: S · Rough value: S
  - Notes: a balance call for Chris, like JIM-35, which this shares a cause with. Fixing it by raising `VOXEL.BLAST_RADIUS` would make every *surface* headbutt bigger too — a dig-specific radius multiplier is the narrower lever.

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

- [ ] **Entity registry — one consistent way to add a vehicle, item or prop.** Before vehicles and items land, define the shape they all plug into: a declarative config per entity (mesh/asset, physics body, interaction verbs, score/heat contribution, spawn rules) that a generic system reads, so adding the shopping trolley is *writing a config*, not threading another parameter through five files. Precedent already in the repo: `MOVES` carries per-move destruction policy and `onImpact` takes a whole config — the same trick, scaled up.
  - Source: 2026-08-07 Chris ("when we get to adding in vehicles, items etc. see if you can come up with a structured modular approach to adding them in consistently")
  - Rough size: M · Rough value: L
  - Notes: **architecture-enabling — must land BEFORE the first vehicle, not after.** Retrofitting a registry onto three hand-rolled vehicles costs more than building it once. Wants an ADR, since it constrains every content addition afterwards. Feeds the rideables, powerup-arsenal and pants-as-cosmetic entries above, all of which are currently blocked on "how do we add a thing".
- [x] **Procedural space authoring — a safe method for building out different spaces.** → promoted to `docs/milestones/15-density-and-variety.md` (2026-08-07), together with JIM-32 density and Chris's variety ask — they are the same problem A repeatable way to generate a *kind* of place (a block, a shop interior, a park, an alley, an underground section) rather than hand-placing voxels per location, with "safe" meaning it cannot produce a space that traps the player, floats, or blocks the only exit — validated at generation time, not discovered in playtest. Once it exists, a "world tour" pass drops meme-worthy easter eggs across the map.
  - Source: 2026-08-07 Chris ("come up with a safe procedural method for building out different spaces - then we can do a world tour and add in meme-worthy easter eggs everywhere")
  - Rough size: L · Rough value: L
  - Notes: **Depends on streaming ground (JIM-01)** — authoring spaces against an eagerly-allocated map means authoring them twice, which is the same reasoning that put streaming ahead of city content. The easter-egg pass is a separate, cheap follow-up once the generator exists; keep them apart so the generator isn't held up by content. Absorbs the "world variety" ask (road hierarchy, building types, interior furnishings) and gives the Seattle-landmarks entry somewhere to live — **re-read its trademark warning before authoring any recognisable landmark.**

- [ ] **Port `cityPlan.js`'s parks, plazas and landmarks onto the island.** Milestone 17 switched the masterplan's source from `cityPlan.js` to `islandPlan.js`, which carries coastline, districts, hills, water and bridges — but no parks, no plazas and no landmarks. So the Space Noodle and the civic plaza are currently nowhere, and `PARK` is down to 1.2% of the map (the unclaimed land between districts) with `PLAZA` at 0%. The old data is still in `cityPlan.js`, unimported, with a header saying so.
  - Source: 2026-08-07, milestone 17
  - Rough size: S · Rough value: M
  - Notes: not a straight copy — the old polygons were drawn against a flat square, so they need re-siting against the coast. Mangy Point's "big park" is named in the district table and does not exist. **Re-read the trademark warning on the Space Noodle before re-siting it.**
- [ ] **Raised bridge spans with real piers, and `span` honoured as authored.** Milestone 17's decks are a raised strip with ramped approaches and a constant 16 m width; the plan's per-bridge `span` (a crossing length) is currently used for nothing, because the crossing is measured off the land mask instead. Piers, a deck you can go under in the sewers, and the heat-4 police cordon the milestone imagines all want a bridge that is more than a raised path.
  - Source: 2026-08-07, milestone 17
  - Rough size: M · Rough value: M
- [ ] **Thirst Hill got flattened by downtown and should probably come back.** It sits 20 m outside Trashattan, and `TERRAIN.FLATTEN_RUN` relaxes the flat district over 120 m — so a 30 m hill renders as 3 m. Real First Hill is right next to downtown and is a hill. Either move it in `islandPlan.js` or give the flatten a per-district run.
  - Source: 2026-08-07, milestone 17
  - Rough size: S · Rough value: S

## Tooling & QA

- [x] Full Playwright suite config — `playwright.config.js` with webServer auto-start so `npx playwright test` doesn't need a manually running dev server → milestone 01-core-waddle-loop.md (trivially adjacent; needed to write the specs)
  - Source: 2026-07-23 scaffold session
  - Rough size: S · Rough value: M

## Open questions

- **JIM-44 bad food** — logged 2026-08-09 in `docs/issues.md`. Four open questions on it, the sharpest being whether bad food is obvious before you eat it: visible mould makes it a resource decision, an identical-looking pizza makes it slapstick, and those are different games.

- Pants: cosmetic (Jimothy wears them) or score-only? Decide before milestone 03's loot table is finalized.
- Mobile touch support and multiplayer are v1 anti-goals (gameplan) — revisit only after the loop ships.

## World pass approved 2026-10-02

- [x] Finer voxels and recognisable varied houses → milestone 25; promotes the earlier finer-voxels and world-variety entries.
- [x] Varied MPFB humans and nearby animated pedestrians → milestone 26; promotes crowd density and JIM-08 presentation.
- [x] Cars, poles, hydrants and physical street objects, with giant-roll attachment/release → milestone 27 and the collection portion of milestone 24. Driving/stealing remains deferred.
- [x] Sky and animated water appearance → milestone 25. Full fluid simulation remains deferred.

## Living-world continuation — 2026-10-02

- [x] Reactive grass, flowers, environmental animals, wind and airborne particles → milestone 30. Requested with ragdolls, lighting and water as the next world pass.
- [ ] Destructible fountain and pond basins with conserved drainage into dug channels. Ocean and nearby ripple simulation are milestone 31; finite water volumes need a separate flow model.
  - Source: earlier water-physics request, retained while milestone 31 adds swimming. Rough size: L · Rough value: M.

## Grounding follow-up — 2026-10-02

- [ ] Support feet on loose moving props and rubble piles, using a shared physical-surface query for people and Jimothy. Milestone 11 adds planted paws on voxel terrain, kerbs and broken ground; the existing pedestrian ground sampler also excludes moving prop surfaces. This retains the broader rubble criterion from milestone 11.
  - Source: milestone 11 original footing scope; clarified during JIM-22. Rough size: M · Rough value: M.

## Next world pass — approved, 2026-10-02

Chris asked to finish the interrupted spare-tyre/pedestrian pass first, then plan these additions. That pass is pushed as `0df5441` and `b8ca85d`, with 26 final focused checks plus build/rendered smoke passing. Chris subsequently approved the complete sequence, including beaches and underwater content, with “these as well — go for it.” Existing unrelated gameplay backlog remains deferred.

Chris subsequently reported the giant form, attachment, destruction and performance failures, and requested military jets. The [loaded-model audit](giant-audit-2026-10-02.md) confirms those defects. **Approved order: repair existing giant rolling → 33 responsive giant destruction/performance → 34 military response → 35 deformable beaches → 36 underwater exploration.** Giant repairs and milestones 33–36 are implemented and pushed, awaiting Chris’s playtest. Evidence and remaining performance limits are recorded in STATE and the milestone files.

### 1. Repair giant rolling (existing milestones 23–24)

- [x] Implemented, awaiting playtest: repair JIM-24/JIM-29/JIM-49/JIM-60 as the immediate next implementation. **Size: L; value: L; ease: M. Depends on:** existing skinned rig and entity ownership. **Blocks:** reliable giant contact destruction and military targeting.
- Approved AC: at House/Block/Absurd, the loaded torso approaches a round ball while the head, paws and tail retain their small scale. Author/verify the deformation in Blender if skin weights cannot support it. Check the actual skinned surface at multiple headings; cached world AABBs cannot define bone-local proportions. Preserve lean proportions, paw IK and idle gestures.
- Approved AC: visual centre, roll pivot, collision shape and collection surface agree throughout growth and tumble. Giant rotation follows distance travelled and continues past the first second. Starting/stopping does not teleport the body or carried objects; the lean flop keeps its established feel.
- Approved AC: ordinary C input through a street visibly carries bins, cars/parts, food, pedestrians and pursuers on the skin. Verify attachment distance/visibility across several rotations, rather than only count and parenting. Releasing restores physics/AI and living people; repeated release/restart does not leak bodies or entities.
- Exit: Chris rolls Block-size Jimothy along a street for ten seconds → a round body keeps rotating with a clearly visible layer of collected objects, then releases them safely. Final stash UI remains its separately recorded open scope.

### 2. Responsive giant destruction and draw distance (milestone 33)

- [x] Implemented in milestone 33, awaiting playtest: make the current populated world run smoothly before adding more scenery. Promotes JIM-48 and the distant-building visibility work in JIM-37. **Size: L; value: L. Depends on:** existing world/traffic systems. **Blocks:** military, beach and underwater content budgets.
- Source: Chris, “runs very poorly — likely too much rendering with things out of view,” followed by “performance tanks when he’s big” and “doesn’t seem to be able to destruct anything at that scale.” The pre-pass production smoke reported 1,731 renderer calls after two simulated seconds, with 36 people, 1,249 plants and nine animals. This is draw telemetry, not an FPS measurement. Some vegetation/particle batches, road markings and water meshes explicitly disable frustum culling. Water already limits reflection frequency; the cause and cost split still need measurement.
- Approved AC: record native-GPU browser/viewport/hardware and before/after frame time on a fixed town → destruction → coast route, by day and night. Separate primary rendering, shadows, reflections, terrain streaming, AI/IK and physics costs; correct the snapshot's misleading `voxels.drawCalls` label. Keep the existing draw-call assertion meaningful and do not raise its limit to hide the failure.
- Approved AC: add Low/Medium/High draw-distance and quality controls; spatially split batches with valid bounds, skip out-of-view work per render pass, use simpler meshes farther away, and merge compatible static objects. Distant building silhouettes should bridge the current streaming edge without loading full destructible buildings to the horizon. Preserve visible shadows and destruction state when objects return.
- Approved AC: reduce distant animation/AI frequency while retaining nearby interaction and traffic correctness. Memory, bodies and streamed objects remain bounded after repeated routes and restarts. Aim for a 60 FPS desktop default on the recorded hardware; report measured frame times and any remaining bottleneck. Chris confirms playability before moving on.
- Approved AC: remove measured synchronous mesh-rebuild stalls (475 ms at Block, 1,938 ms at Absurd in the audit). Bound generation, remeshing and debris/physics work per frame; a column budget alone is insufficient. Profile cheaper meshing and staged/worker rebuilds before selecting the implementation, while preserving collision and visible damage agreement.
- Approved AC: repair JIM-61 using the corrected giant surface and swept contacts. A Block-size headbutt hits a house at least as reliably as a House-size one; giant rolling knocks over/collects street objects and damages contacted structures while the headbutt retains stronger demolition. Upward growth must not aim every hit above the world. Preserve deliberate downward digging and avoid unprompted pavement craters.
- Approved AC: scale the affected area through bounded staged damage, with near impacts visible promptly and distant work queued. Never perform one synchronous city-block-volume voxel scan. Destruction persists across streaming and restart clears queues; glass, detached car parts, explosions and ragdolls remain bounded. Add the four-size wall repro and a repeated giant rampage to the performance route.
- Exit: Chris rolls through and headbutts buildings at Block size → visible contact breaks them without long stalls; changing draw distance reduces measured rendering cost without holes or lost damage state.

### 3. Military responds to a giant rampage (milestone 34)

- [x] Implemented in milestone 34, awaiting playtest: bring in tanks and jet passes once heat and size/power warrant them. **Size: L; value: L; ease: S. Depends on:** corrected giant collision/contact, milestone 33's damage and performance budgets, existing heat system and ADR-0002 launch/recovery. **Blocks:** final escalation playtest.
- Source: Chris, “there’s where the military should be coming in with jets and things to take him out.” The gameplan/milestone 03 already promise tanks, but runtime pursuit only implements paparazzi and animal control. Jets are new. Extract military work from milestone 03 when this proposal is promoted; keep trees/loot queued there rather than requiring them first.
- Approved AC: heat/size gates, spawn caps and cooldowns in Constants produce a readable escalation from ordinary pursuit to military response. Address JIM-35's immediate maximum heat from fine-voxel destruction so a small scrape cannot summon the full army. Expose tier, units and attack phase in the snapshot; reset returns to a quiet world.
- Approved AC: tanks navigate suitable streets, aim and fire with a readable warning. Jets perform bounded, telegraphed approach/attack/exit passes over the active area, with a dodge window and no instant repeated hits. Import free licensed models, retain sources/Blender files/licences, and inspect silhouettes and attack directions in game.
- Approved AC: explosions use the shared bounded damage pipeline and size-aware impulses. Hits can interrupt rolling and launch/stagger Jimothy, then restore control through PhysicsSystem. Military units/wreckage participate in breakage and eligible collection, with pooled projectiles/effects and no remote unlimited simulation.
- **Loss rule:** keep the existing net-only ending, as stated when beginning the approved pass. Shells and jets launch/stagger Jimothy; animal control captures him.
- Exit: Chris grows and ramps up destruction → tanks arrive and jets announce an attack pass; he can evade or get visibly blasted, recover and keep moving, within the measured performance budget.

## Approved world content after giant rampages

### Soft beaches and deformable sand (milestone 35)

- [x] Implemented in milestone 35, awaiting playtest: replace the hard shore transition with varied dry sand, wet sand and shallow seabed profiles. **Size: L; value: L. Depends on:** performance budgets / milestone 33, existing water and ground-contact systems. **Blocks:** placement of underwater sites near shore.
- Source: Chris, “softbody sand and a beach — too much of a hard edge on the shore.” Logged as JIM-59. Current terrain has a mathematical shore ramp, but its sand top material is selected only at/below sea level; dry land is topsoil. The exact reported hard edge still needs a coast survey and rendered reproduction.
- Approved AC: broad curved sand bands, dunes and flatter shallows appear at suitable beaches, with wet/dry material transitions and foam following the actual shoreline. Retain intentional rocky bluffs and harbour edges; avoid flattening the island's hills or roads.
- Approved AC: nearby sand yields into footprints, roll tracks and impact craters, with small bounded grain/sand effects and local settling. Jimothy's size changes the deformation. Ground sampling, visible terrain, feet, objects and water agree after deformation; there are no floating feet or invisible ledges.
- Approved AC: walking → wading → swimming → walking works across sampled coast sections. Deformations persist while travelling within the run and clear predictably on restart; streaming does not create seams. All work fits the performance budget established first.
- **Sand model:** the approved default is local surface deformation with bounded settling and grain effects. A full granular solver remains separate scope.
- Exit: Chris walks, rolls and headbutts along a beach → sand visibly yields, the shoreline feels gradual, and returning from the sea does not snag.

### Scattered underwater places and wildlife (milestone 36)

- [x] Implemented in milestone 36, awaiting playtest: make underwater exploration varied, sparse and interactive. **Size: L; value: L. Depends on:** milestones 33–34 and existing water/day-night/destruction systems. The current controller floats Jimothy at the surface; depth movement and underwater camera transitions belong in this scope so the scenery can actually be explored.
- Source: Chris requested underwater objects, fauna/creatures, ruins, boat wreckages, deliberate empty stretches, daylight god rays and bubbles. Repeated copies of one site do not meet the brief.
- Approved AC: seeded placement selects suitable depth/slope and separates points of interest with substantial empty seabed. Start with three distinct wreck hull families and four ruin layout families; vary layout, damage, burial, tilt, materials and plant growth. Reject repeated complete site signatures near each other. A fixed exploration route demonstrates variety and quiet gaps; streaming preserves the chosen site and its damage.
- Approved AC: dive/surface movement, paddling and camera transitions expose these places cleanly, with depth-dependent visibility. Retain the net-only run-ending rule and safe transitions back to shore.
- Approved AC: create or source licensed editable wreck/ruin assets with breakable sections and the existing physical interaction/collection interfaces. Populate suitable habitats with kelp/seagrass, schooling fish, seabed creatures and a slow-swimming creature family. Use bounded nearby populations, shared meshes and distance-based animation from the performance pass.
- Approved AC: sunlight shafts appear underwater during daylight, respect cover/depth and fade at night. Bubbles respond to swimming and selected environmental sources. Effects have explicit pool and visibility budgets and do not draw through the entire world.
- Approved AC: inspect several complete sites and intervening empty stretches in play, test destruction/streaming/restart, and rerun the same native-GPU performance route after adding underwater content. Chris judges variety, spacing and atmosphere.
- Exit: Chris swims between separated ruins and wrecks → the next site has a different silhouette/layout, creatures react nearby, daylight rays and bubbles sell the water, and frame time stays within the agreed budget.

The later beach/underwater briefs extend the earlier water scope; finite pond drainage remains separately deferred. Source recipes, asset licences, editable Blender files and in-engine inspection remain required for new assets. The complete sequence is authorised; no repeat approval is needed to continue it.


## City and hidden keepsakes — 2026-10-03

- [ ] **Recognisable downtown and skyscraper exploration.** Extends the existing world-variety entry; defect JIM-74 records the measured shortage of towers. Chris: “model out a city ... it all just looks like residential streets”. Size L; value L. Proposed milestone 46 supplies varied commercial buildings and reachable upper floors/roofs while preserving voxel destruction, existing landmarks and rendering limits. See `city-keepsakes-proposal.md`; priority is not yet confirmed.
- [ ] **Hidden Jimothy keepsakes, collected for their own sake.** Chris requests themed treasures underwater and up in skyscrapers, “just to collect for the sake of it”. Size L; value L. Extends milestone 18's zero-utility treasure rule and relates to the den/photobook backlog. Proposal: 36 distinct modelled objects, twelve underwater, twelve upper-floor/roof and twelve around streets/parks/landmarks; a collection viewer and local discovery save, no score/fatness/energy/currency rewards. Pickups survive support loss, remain reachable, respect occlusion and do not duplicate after travel/reload. Proposed milestone 47 follows city routes; counts, persistence and priority are in `city-keepsakes-proposal.md` for review.
