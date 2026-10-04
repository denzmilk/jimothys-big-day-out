# Vehicles, wearable abilities and readable tool effects

Requested by Chris, 2026-10-04. **Chris selected hijacking and driving cars first: milestone 53, now implemented and awaiting playtest.** The remaining rides, wearables and full tool-feedback pass are retained in the [expanded sequential plan](playground-expansion.md), alongside the fourteen additions and bosses. Existing traffic, tools and costumes do not imply these later capabilities already work. The new ammo/charge request extends the contracts below; skill purchases will separately spend current body fatness.

## Baseline before M53

- Six imported CC0 car models, road traffic, suspension, glass, breakaway parts and explosions. Cars have no seated drivers or player driving controls. M42 plans NPC parking/visits and explicitly excludes player stealing/driving.
- Twelve MPFB people, street activities and shared ragdolls provide the humans for occupants and combat reactions.
- Twenty-four physical tools with food energy, pickup/swap/drop and various effects. `ToolSystem.use()` mostly applies effects immediately to a cone-selected target; firework rockets have timed travel. `burst()` uses one small sphere-particle family for most items. There are no tool SFX; the only current `AudioContext` is in the comet entrance.
- F already controls the fly camera; E/B headbutt; T/LB equips; mouse/V/RB uses equipment; G/B drops it. New controls must preserve those bindings outside their specific riding state.

## Selected first feature: hijack and drive a car

Approach a stopped/slow car → see an enter/hijack prompt → watch its driver leave and Jimothy climb in → accelerate, steer, brake/reverse and handbrake around a block → crash or park → exit onto clear ground and resume walking.

Controls: **Y / gamepad Y** enter or exit; **W/S** accelerate or brake/reverse; **A/D** steer; **Space / gamepad A** handbrake; gamepad **RT/LT** throttle/brake and left stick steering; **H / L3** horn. Contextual HUD shows the active bindings. Exit at low speed; a blocked side uses the other door or reports that the exit is blocked. Camera orbit remains available.

Acceptance boundaries for the first feature:

1. Visible MPFB drivers and one occupant owner per car. A hijack is a visible door-side action with an interruption window and a fleeing displaced driver. A distant/fast car cannot be stolen by pressing a key; it must be reached and slowed first. No cloned driver, invisible passenger or ownerless actor on cancellation.
2. Jimothy keeps his original rig and a readable seated/steering pose. Seat fit is measured against the car cabin and his current body. Oversize entry gets a clear prompt; growth inside forces a safe release or breaks the vehicle if no cabin space remains. No silent shrinking.
3. Acceleration, braking before reverse, speed-dependent steering, rolling resistance, handbrake and speed-sensitive follow camera. Wheel rotation and steering follow actual motion; tyres maintain terrain contact on grades. PhysicsSystem remains the sole body owner under ADR-0002, with explicit traffic → player → loose/wreck ownership handoffs.
4. Car-sized swept contact checks prevent tunnelling through walls and other cars. Speed/mass affect shove and crash strength; light props, ragdolls, glass and car panels use their existing physical paths. A crash can eject/stagger Jimothy; the net remains the run-ending rule. Hijacking and actual collisions produce bounded heat events.
5. Starter/idle/rev, tyre skid, horn, door and crash sounds; exhaust, tyre smoke and contact sparks/dust occur at the relevant parts. Engine loops stop on exit, destruction, pause and restart. Vehicle damage stays visible after exit/travel.
6. Safe exit, wreck/ejection, collection, water entry, growth, capture, pause, focus loss, streaming and restart all restore coherent player/driver/car ownership. Headless tests verify actual movement/contact and state transitions; original-rig playtest verifies boarding, handling, camera and feedback.

Dependencies: existing traffic/M32, vehicles/M27, human grounding/ragdolls/M26–29 and PhysicsSystem/ADR-0002. The occupant ownership work can support M42 later; full destination parking/visit routines remain M42. Cars are the recommended first feature because bikes and boards also need a reliable rider handoff.

## Remaining requested features

Each is separately testable and should receive its own focused milestone when selected. These are retained requests, not a newly approved order.

| Feature | Proposed action and observable result |
| --- | --- |
| Motorbikes | Mount, throttle/brake, steer and lean; visible handlebar/foot contact, wheel suspension and skids; impacts cause a recoverable ragdoll dismount. Reuse the rider ownership and collision work from cars. |
| Bicycles | Mount, pedal/coast, steer and brake; foot-to-pedal and hand-to-bar contact, cadence-driven animation and wheel rotation; momentum and recoverable spills. |
| Skateboarding | Push/coast and brake; hold/release jump for an ollie; air input selects a kickflip, shuvit or directional 180; approach an eligible physical rail/ledge and hold grind to lock onto its edge, balance and jump off. Land aligned to keep the trick chain; bail breaks it. Broken rails immediately release the grind. Wheels, trucks, feet and board remain aligned; no automatic airborne rail teleport. |
| Boxing gloves | Equip visible gloves; repeated primary attack within a combo window gives left punch → right punch → finishing kick. Each has wind-up, contact and recovery; one hit per target per strike, wall occlusion and a whiff animation. Hits stagger, then knock down using the shared ragdolls. |
| Wrestling mask | Wear a fitted mask; primary attack grabs one reachable person, then directional input chooses throw or body slam; a moving attack gives a clothesline. Paired poses align limbs and the victim before releasing into the shared ragdoll. Growth has an explicit grab/reach cap; dropped targets recover alive. |
| Runners | Visible running shoes; hold use for a fast sprint with acceleration, braking and turning limits. Stride cadence and foot planting follow distance travelled. Shoe trails, dust and rhythmic footsteps make the boost obvious; collisions remain active. |
| Orange gi | Visible orange gi and belt fitted to Jimothy's original rig. Hold use to cup the paws and charge a bright energy orb; release a broad Kamehameha beam with a white core, coloured sheath, recoil and impact bloom. Charge determines energy cost/strength; interruption cancels without firing. Walls stop the beam until destroyed; shared destruction budgets apply. |

Wearables use the existing one-equipped-item/food-energy rules as the proposed starting point. They must fit the original growing, jiggling model and restore the slinking gait when unequipped. Boxing gloves are a new melee combo, distinct from the existing ranged spring-glove gadget. New models need editable Blender sources, export metadata and inspection in the game. Cars reuse the existing imported CC0 assets; bike/board assets should follow the same free-source/licence workflow.

## Feedback contract for every item

Chris's requirement: use must be unmistakable, with defined projectiles/behaviour, SFX and particles. **The table below is a target for the feedback pass, not a claim about today's implementation.** Existing behaviour/costs remain in Constants.js; any changes to delivery/hit rules need tests before implementation.

- Every use has an identifiable start, active/travel phase, impact/result and finish. Visuals start at the actual muzzle, hand, foot or tool head and follow the same aim/collision path as gameplay.
- A projectile has position, velocity, radius, maximum travel/lifetime, first-contact handling and expiry. Sweep its full movement each step against terrain, actors and props. Travel-time projectiles apply their effect on contact. Beams/cones use matching solid occlusion and visible reach. Misses still look and sound like uses.
- No shot through a nearby wall because its muzzle started beyond that wall. Clip outgoing effects to the obstruction and show the contact there. Large Jimothy gets bounded reach and readable effects, rather than unlimited particles/rays/lights.
- Energy is reserved/spent only for a valid action. Empty energy, cooldown, blocked deployment and oversize movement items show a short reason and distinct dry-use cue; they do not fake a successful hit.
- Audio has an unlocked shared context, master/SFX gain, bounded voices, distance attenuation and separate starts/loops/ends. Pause, focus loss, unequip, capture and restart stop loops. No per-particle oscillators or contexts.
- Fixed pools bound trails, bursts, beams, audio and temporary lights. Avoid changing scene light count while firing. Obvious silhouettes, sustained paths and impact rings supply readability without relying only on particle quantity or colour.

### Existing 24 tools: desired delivery and feedback

| Tool | Delivery and result | Visible/audio signature |
| --- | --- | --- |
| Power washer | Sustained narrow jet; pushes reachable light props and knocks people down along its actual path. | Thick moving water ribbon, spray cone at the first surface and trailing droplets; pump start/loop/stop and hard splashes. |
| Bubble gun | Visible travelling bubble; first eligible person is enclosed, rises and is released alive when it bursts. | Large iridescent launch bubble, sparkling wake, full-body enclosure; bloop, rising wobble and pop. |
| Leaf blower | Sustained broad cone pushes loose light objects. | Clear outward gust bands plus leaves/dust; motor rev and rush. |
| Vacuum | Sustained inward cone gathers loose food into a nearby pile. | Inward spirals running from affected food to intake; suction whine and pickup rattles. |
| Food magnet | Radial pulse pulls reachable food from all sides. | Expanding ring and inward food trails; electrical hum and rising collection pings. |
| Fire extinguisher | Dense cone pushes objects and gives Jimothy backward recoil. | Full white plume, expanding surface cloud and kickback; valve click, forceful hiss and sputtering end. |
| Paint sprayer | Visible paint glob/spray contacts the first eligible surface and leaves an attached splat. | Bright stream, radial splat droplets and persistent surface stain; pressurised spit and wet smack. |
| Confetti cannon | Short wide blast startles the reachable crowd. | Big muzzle puff, tumbling multicolour strips and expanding pressure ring; pop followed by paper flutter. |
| Air horn | Narrow sonic pulse briefly stuns people in its unobstructed cone. | Travelling compression rings and startled target pose; unmistakable horn blast. |
| Disco ray | Occluded aimed beam makes a person dance temporarily. | Segmented coloured beam with a moving bright core and rhythm marks around target; chord stab and short rhythmic loop. |
| Sick ray | Occluded aimed beam triggers a cartoon queasy pose and recovery. | Wavy green beam, splat and bubbles/queasy icon on target; warble and cartoon gurgle. |
| Stink sprayer | Lob a visible glob that lands and leaves a temporary repelling cloud. | Glob arc, impact puff and readable swirling cloud; wet plop, hiss and buzzing cloud. |
| Spring glove | Visible spring extends to a close target, makes one contact, then retracts. | Expanding spring, glove squash and impact stars; spring twang, punch thump and retraction. |
| Suction grappler | Launch an anchor along aim; a valid surface contact attaches the rope and pulls Jimothy. | Visible head and taut moving rope; launch snap, suction pop and strained reel loop. |
| Plunger launcher | Travelling plunger attaches to the first car struck, slowing it temporarily. | Full plunger arc/flight and visible stuck plunger; thunk/pop, strained tyres, release pop. |
| Tow reel | Visible hook attaches to a eligible movable prop; tension pulls it within the mass limit. | Hook, cable and tension/reel motion; ratchet, motor strain and detach clack. |
| Foam cannon | Deposit a growing physical foam barrier at a clear target site. | Thick foam stream, expanding lobes and bubbling surface; pressure hiss and dense splat. |
| Trampoline popper | Place a spring pad on a clear supported surface; contact launches a body. | Pad unfolds, compresses and rebounds with a ring; deployment clack and rising boing. |
| Rocket skates | Held boost accelerates Jimothy along the collision-tested motion path. | Clear foot exhaust flames, long smoke/spark trails and lean; ignition, engine roar and cutoff. |
| Pogo stick | Repeated grounded compression → launch → flight → landing cycles. | Visible spring compression and landing dust rings; squeak, boing and weighty landing thump. |
| Umbrella glider | Open canopy limits fall speed while energy lasts, with steering. | Visible open umbrella and trailing airflow ribbons; opening snap, fabric flutter and air rush. |
| Bubble shield | A temporary full-body shield interrupts capture. | Expanding shell, surface waves on contact and clear expiry collapse; swelling chime, contact boing and pop. |
| Jackhammer | Repeated bit contacts remove local terrain/material at the feet/front. | Fast reciprocating head, chips/dust from the exact contact and body vibration; heavy rattle and material crunch. |
| Firework launcher | Visible arcing rocket sweeps against terrain/actors/props and detonates on contact or fuse expiry. | Bright rocket, continuous smoke/spark trail and broad starburst/pressure ring; launch thump, whistle and layered boom. |

### New wearable abilities: desired feedback

| Ability | Start → active → result |
| --- | --- |
| Boxing combo | Shoulder/paw wind-up and glove whoosh → visible jab/cross/kick at the contact frame → separate thump/crack for each stage, impact stars and stronger finishing knockdown. A missed strike has no hit sound. |
| Wrestling moves | Grab pose and cloth sound → visible matched lift/turn/release → throw whoosh or slam thud with ground dust/ring and ragdoll. Safe cancellation releases the person. |
| Runners | Lace/squeak cue and crouch → shoe trails, rapid grounded steps and wind rush → skid/dust and decelerating footsteps when released. |
| Orange gi beam | Audible rising charge and expanding orb between paws → wide continuous beam, recoil and sustained roar → first-surface impact bloom, rubble/dust, bass hit and fading energy crackle. Readable charge, energy limit and recovery prevent permanent firing. |

## Verification when selected

Write failing tests for the selected feature before source changes. Test input routing, real contact effects, misses/occlusion, energy/cooldown, size limits and resource cleanup at 30/60/120 Hz. Inspect the original loaded rigs and actual rendered pixels; audio tests must measure an active output signal, not only an event counter. Sample sustained use with CPU/render-submission, draw, body, effect and audio-voice budgets. Chris's handling/pose/sound/readability playtest remains required.

Existing wanted pacing (JIM-35), giant performance (JIM-48), giant skin distortion (JIM-69), food tiers/M40, tourists/M41, NPC trips/M42, downtown and hidden keepsakes stay in their recorded state. Selecting one of this request's features changes the immediate next task only; it does not silently complete or remove those asks.
