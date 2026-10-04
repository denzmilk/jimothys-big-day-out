# Playground expansion and repair sequence

Chris requested this queue during M53, 2026-10-04, and explicitly asked to finish cars then plan and implement the additions sequentially. This is the complete request inventory and delivery direction. M53 and the reproduced JIM-89 car-suspension follow-up are implemented, awaiting playtest. Each later step gets its own tests, live inspection, commit and playtest verdict; a planned entry is not a completed feature.

## All fourteen additions, plus bosses

| Request | Kept scope | Delivery step below |
| --- | --- | --- |
| 1. Jetpack | Controlled flight; top-speed comet aura; swept crash explosions and damage | 11 |
| 2. Treasure hoards and food purge | Discoverable food stashes; deliberate comic purge to lose size | 8 |
| 3. Land legs and fat rolling | Slower balanced slink; momentum and physical rolling at larger sizes, original model retained | 1, 3 |
| 4. Wanted escalation and fish | Five stars require sustained mass destruction; repair underwater fish jitter | 4, 5 |
| 5. Wider bubbles and blue fish | Body-sized bubble sources; explicitly reproduce the blue-fish glitch | 5 |
| 6. Floating cars on grades | Actual tyre contact through uphill/downhill changes, parked/NPC/player cars | 0 |
| 7. People in water | Swimming/wading, shoreline exits and ragdoll-to-swim recovery | 6 |
| 8. Weapon amounts | Per-item ammunition/charge; readable remaining amount; throw away exhausted equipment | 7 |
| 9. Hats and scarves | Many discoverable, wearable styles including party hats, fedoras and googly eyes | 13 |
| 10. Location minigames | A fitting playable activity at every implemented significant location | 14 |
| 11. Grappling playground | Attach two things, swing, reel, pull structures apart and surf moving cars | 10 |
| 12. Exploration skills | Discover powers and spend current fatness to unlock them; ultimate-fatness gates | 9 |
| 13. Rough terrain and sewer stairs | Smooth natural/destructed surfaces and matching collision; usable real sewer steps | 2 |
| 14. Jimothy ragdoll | Small bodies fly floppy after cars, kicks and blasts; heavy bodies resist more | 3 |
| 15. Raccoon bosses | Normal raccoon anatomy, textured sourced base, costumes, areas and distinct special moves | 15 |

The immediate car follow-up also requests more ditch torque, tougher cars (JIM-95), repair of a downhill road snag (JIM-96, screenshot supplied), and completion of the remaining M53 acceptance criteria. Chris explicitly authorised continuing this queue one item at a time, reviewing each result for fluid, reliable gameplay without requiring cosmetic perfection. The earlier request remains: motorbikes, bicycles, skateboard ollies/grinds/tricks, boxing gloves with punch/punch/kick, wrestling mask/moves, runners and an orange gi with a Kamehameha. These are included below and in [vehicle/equipment design](vehicle-and-equipment-request.md).

## Sequential delivery

The order puts contact/ownership and size rules ahead of powers that depend on them. Movement checkpoints in steps 0–3 (M53–M57 and JIM-69) are implemented, awaiting playtest; the recorded giant-performance and cave-smoothing limits remain open. JIM-99’s crater exit repair and M58 wanted pacing are also implemented, awaiting playtest. M59 photographers and kicking locals are implemented, awaiting playtest. The native uphill civilian crouch under JIM-50 is also repaired, awaiting playtest. M60 police cars/guns are implemented, awaiting playtest. M61 rifle troops complete the implemented staged response, awaiting playtest. JIM-90 fish stability is next, then the separate JIM-91 wider bubble repair. Later rows are work packages to split when reached, not a claim that each fits one session.

| Step | Work | Exit observation and dependencies |
| --- | --- | --- |
| 0 | M53 cars and JIM-89 suspension persistence — implemented, awaiting playtest | Hijack, steer, brake/reverse, recover from a shallow ditch, crash and exit. Six driven models pass sampled grade contact; ten parked cars retain suspension/heading after streaming, repairing the reproduced 22 cm hover. Source car models stay intact. |
| 1 | M54: slower slinking land gait; reopen JIM-76 | Walk/turn/stop across speeds and sizes: planted paws, balanced body, no rapid scuttling or curled dancing legs. Keep idle, swimming, riding and attack poses. |
| 2 | M55: traversable terrain and sewer stairs; JIM-43/93/94 | Walk both directions over natural slopes, dug ground and every sewer entry; render/contact heights agree, no sticking, roof snaps or falling through steps. Keep buildings crisp and terrain destructible. |
| 3 | Physical rolling and Jimothy ragdoll | Fat rolls build momentum, bank and bounce with terrain; small Jimothy flops after impacts then safely gets up. Keep the original fat jiggly rig, collection shell and boulder-like destruction channel. Scale impulse by mass; bound contacts/attachments and profile giants (JIM-48/69/70). Split roll and ragdoll into separate changes sharing one movement owner. |
| 4 | Wanted pacing and staged response; JIM-35 | Repeated minor scares and small ground marks cannot jump to five stars. Record minor/house/block-scale damage scenarios, credit only player-caused destruction, then deliver paparazzi → kicking locals → animal control → police cars/guns → jets/tanks/automatic troops. Keep searches, escape and net-only ending. |
| 5 | Fish stability and wider bubbles; JIM-90/91 | Swim beside blue fish and schools at 30/60/120 Hz; continuous bounded paths, no teleporting or competing physics poses. Bubbles spread over Jimothy's submerged body, increasing breadth with size while staying pooled. |
| 6 | Swimming people; JIM-92 | A person enters water, switches from wading to a readable swim, seeks reachable shore, exits and resumes routines. Car ejection/ragdoll recovery use the same ownership path; no walking on the seabed. |
| 7 | Equipment amounts and full feedback; JIM-88 | Each existing tool has defined ammo/charge, consumption, range/travel/contact, SFX and visible effects. Remaining capacity is readable; empty gear is physically tossed once, clears ownership and cannot be fired. Apply the [24-tool feedback contracts](vehicle-and-equipment-request.md) in small verified families. |
| 8 | Tiered foods, food hoards and purge | Finish M40 and farm/market risk/reward. Hide varied finite food hoards at land, upper-floor and underwater sites. Deliberate held purge visibly shrinks Jimothy with a comic effect, respects clearance and cannot duplicate edible food. Returning to a depleted hoard does not reset it. Pure keepsakes remain a separate collection. |
| 9 | Discovery and fatness-funded skills | Discover a power in the world, see prerequisites/cost, deliberately spend current fatness, shrink safely and retain the unlock. Costs and ultimate-fatness gates are explicit. Implement a small initial tree and persistence first, then add powers as their own steps ship. |
| 10 | Grapple, tether and car surfing | Shoot a visible hook into valid geometry, swing with tension and release; connect two movable/destructible objects with finite strength; a destroyed anchor releases safely. Surf a moving car with relative ground velocity and transfer to riding. Depends on steps 0–3, 7, 9 and existing shared bodies/destruction. Extend existing suction-grappler/tow-reel ownership rather than creating duplicate systems. |
| 11 | Jetpack and superman flight | Unlock/collect flight, control ascent/steering/descent with bounded fuel, then reach a clear top-speed comet state. Sweep the whole body before crash damage/explosion; damage scales with speed/mass, one impact cannot detonate every frame. Jetpack is equipment; superman flight is a late skill. |
| 12 | Remaining rides and combat outfits | Separate deliveries: motorbike → bicycle → skateboard with ollie/grinds/trick chains → boxing combo → wrestling moves → speed shoes → orange-gi energy beam. Reuse rider ownership, ragdolls, skill gates and item feedback. Each has physical readable poses and a safe cancellation path. |
| 13 | Downtown, keepsakes, hats and scarves | Finish the city/upper-floor routes and M47 pure keepsakes. Add a wardrobe with at least 20 hats and 12 scarves, discoverable across land/sea/heights; preserve hat/scarf fit and visibility through growth, roll, swim, ragdoll and riding. No combat bonus for ordinary cosmetics. |
| 14 | Location activities and living visitors | Add the minigames below to all 16 landmarks, then distinct farm, market, sewer, beach and underwater-site variants as those sites exist. M41 tourists react to/visit activities; M42 drivers park, get out, visit and return using M53 ownership. |
| 15 | Area raccoon bosses | Introduce costumed normal raccoons with distinct silhouettes, telegraphed moves, recoveries and counters. Increasing power opens later arenas. Bosses use existing physics, powers, water, traversal and destruction; rewards never require a lost/destroyed entrance. |

### Skill and food rules

Chris's new direction deliberately adds a use for current fatness. Ordinary tool use still spends that tool's supply; **buying a skill spends body fatness**, with a preview and deliberate confirmation in the skill interface. Proposed implementation default: discovered skill locations and bought skills persist locally; current body fatness and wanted level reset per run. The HUD distinguishes current size from peak achieved fatness; spending cannot erase an existing personal best. Ultimate-fatness checks happen before payment, so buying a late power cannot immediately disable itself.

Start with traversal/speed, firearm handling and strength branches, with grapple and flight on later branches. Later unlock costs must be balanced against M40 food tiers and measured travel/hoard payouts. No inactive menu button should claim a power exists before its runtime milestone ships. Purging is a separate deliberate shrink action, with cooldown and no edible returned food; skill purchases do not trigger purge effects.

### Location minigame direction

Use **Raccoon Side Hustles**: an optional physical start object, short local objective, clear feedback, bronze/silver/gold targets and replayable local bests. No forced teleport or separate abstract menu game. Destruction, a lost objective or capture cancels cleanly and offers a fair retry; no irreversible reward lockout. Counts and time limits are tuning, defined when each activity is built.

| Existing landmark ID | Activity |
| --- | --- |
| `space-noodle` | Rooftop Lunch Run: climb through real checkpoints, steal the picnic and descend to the delivery bin. |
| `picky-place` | Catch of the Day: catch thrown fish in order and carry them to a market crate while avoiding decoys. |
| `frumont-troll` | Toll Troll: ricochet rolling junk through the troll's toll hoops. |
| `gas-guzzlers` | Pipe Pressure: use a washer to hit valves in sequence before pressure vents. |
| `bandit-locks` | Salmon Slalom: swim upstream through gates and return a floating lunchbox. |
| `ferry-fiasco` | Deckhand Disaster: shove correctly marked cargo onto deck before departure. |
| `mono-rail-yard` | Rail Rat: grind or balance along a rail route, with a walking practice route. |
| `rainforest-bubbles` | Bubble Botany: carry fragile seed bubbles to matching planters without popping them. |
| `smiff-tower` | High Rise Heist: retrieve a rooftop snack cache using ledges/grapple and return it intact. |
| `great-squeal` | Wheel of Cheese: grab hanging cheeses as the wheel carries them past safe boarding points. |
| `museum-of-loud` | Trash Percussion: strike physical junk instruments in a growing rhythm pattern. |
| `hat-stomps` | Fashion Frenzy: find and wear the requested hat/scarf combinations in a timed local scavenger route. |
| `volunteer-waterworks` | Pressure Patrol: connect water outlets and blast moving targets with the washer. |
| `discovery-light` | Lighthouse Lunch: follow the sweeping beam between safe spots and collect shore snacks. |
| `big-pinch-diner` | Lobster Pot: dodge snapping claws and knock food crates into the giant cooking pot. |
| `banana-snacks` | Banana Bowling: roll through arranged peel lanes and knock down fruit-display pins. |

Coverage must be data-driven: a check enumerates implemented significant location IDs and fails if any lacks an activity definition and reachable start. Add orchard harvesting, market delivery, sewer sluice routing, beach sand sculpting and wreck salvage for their actual generated site families. Validate each activity once on its intended route plus destruction, cancellation, travel and restart; merely assigning 16 differently named copies of one race is insufficient.

### Boss direction and source research

Normal long-spined raccoons keep their muzzle, mask, limbs and striped tails. Costumes are separate fitted assets, not alterations that turn them into copies of Jimothy. Initial design: six area bosses, introduced one at a time:

| Boss | Area/costume | Telegraph → special move → counter |
| --- | --- | --- |
| Captain Crumbs | Picky Place; fishmonger apron/cap | Wind up a fish → slippery fish volley → sidestep and strike during crate reload. |
| Sluice Bruce | Sewer pump room; overalls/headlamp | Valves rattle → sweeping water jet → redirect the flow and approach through cover. |
| Baron von Bin | Gas Guzzlers; scrapyard armour | Magnet glows → orbiting junk/tether slam → break exposed anchors or pull away armour. |
| Mad Cap | Hat & Stomps; oversized hat/scarf | Hat spins → decoy hats and a returning brim throw → follow the real tail and punish the catch. |
| Admiral Nibbles | Ferry/wreck area; sailor coat | Buoys flash → charge through marked water lanes → dive/evade then pull the exposed buoy tether. |
| King Compost | Banana/farm district; produce crown | Stomp wind-up → rolling produce and ground shockwaves → jump or counter-roll at sufficient mass. |

Start with one complete boss and verify combat/arena/reset/resource contracts before costuming the other five. Boss attacks knock Jimothy around and can scatter food; retain the net-only run-ending rule. Area gates depend on unlocked abilities/current strength without making a huge body fit through a tiny required door.

**Research checked 2026-10-04; candidates, not imported assets:**

- [WildMesh 3D — Raccoon, free demo](https://sketchfab.com/3d-models/raccoon-realistic-3d-model-demo-free-9922c5c1a2cd40d1b72b046a1b45ebd0): the creator's indexed listing states realistic anatomy/textures, 5.8k triangles and CC Attribution. Preferred candidate for normal anatomy. The listing mixes demo/full animation claims, so inspect the actual downloadable archive, licence, texture maps, rig and included clips before choosing it. Direct page fetch returned 403 in this session; no download/import is claimed. Retain creator/source/CC BY licence and modification credit in shipped attribution.
- [Quaternius — Raccoon](https://poly.pizza/m/xMmx6VQP3r): animated FBX/glTF, listed CC0; useful unrestricted fallback. Verify actual texture assets; material-only colour is not yet proof of the requested textured finish.
- [Caeliflower — low-poly raccoon](https://www.cgtrader.com/free-3d-models/animal/mammal/low-poly-raccoon-232a28b8-98fc-4c81-842c-6995dd5a50c7): free, basic rig, hand-painted texture and Blender/glTF source. Its [standard royalty-free terms](https://help.cgtrader.com/hc/en-us/articles/360015124437-Royalty-Free-License) restrict standalone redistribution; do not place its raw asset in this public browser repository without a compatible permission grant. Prefer the CC BY/CC0 candidates.

Asset gate: official download → verify licence/archive → inspect in Blender → retain editable rig/texture source → author separate costumes/moves → export bounded GLBs → inspect live anatomy, shadows and animation. Record sources and changes with the assets. No ripped-game or noncommercial-only substitute.

## Verification and status policy

Each step records a failing reproduction first, passing gameplay/state checks, native original-rig views where visual, restart/travel/interrupt checks, and local performance measurements with their limits. Chris's hands-on verdict remains necessary for feel and appearance. Keep giant performance and queue latency visible; passing a new feature test does not close JIM-48. None of this document changes current gameplay until its corresponding implementation is tested and shipped.
