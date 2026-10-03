# Jimothy's Big Day Out

## Pitch

Play as Jimothy — Seattle's viral short-spine raccoon — in a third-person 3D rampage across one Ballard block. Every snack you eat makes you visibly fatter, and fat is score; every bit of chaos — tipped cans, scared locals, general mess — makes you more wanted, until the response escalates from paparazzi all the way to the army rolling in tanks. It's a game about getting big and fat without getting captured: shells send you flying, but nothing ends the day until the net catches you.

## Core gameplay loop

1. **Waddle** around the block (third-person follow cam, camera-relative controls, arcade-floaty momentum).
2. **Bonk** trash cans to tip them, then **raid** the spilled garbage for snacks.
3. **Eat to get FAT** — every snack visibly grows Jimothy. Fat is the score; chaining pickups quickly builds a combo multiplier. Eating is an explicit **button press with its own animation**, not auto-pickup *(revised 2026-08-07, JIM-30: eating is the scoring verb, and it was the one thing the player never actually did)*.
4. **Climb** trees to loot weird finds (bird nests, eggs, pants) and catch a breather — ground pursuers can't climb.
5. Chaos raises **HEAT** — tipping cans, making a mess, scaring (slapstick-hurting) locals. Paparazzi → animal control → police cordon → the ARMY, with tanks that blast Jimothy across the map.
6. **Grab silly powerups** (bubble blower, dance ray, food magnet…) to cause chaos and escape trouble.
7. **Scurry and hide** (bushes, under porches) to slowly drain heat — or keep rampaging and ride the multiplier.
8. Get **netted** → day over → a **holiday photo book of "Jimothy's Big Day"**, assembled from shots the paparazzi took during the run, with final fatness vs. personal best. Immediately restart *(2026-08-07, JIM-31)*.

## Game rules

- **Comet arrival (2026-10-03):** each new run opens with flaming Jimothy falling from the sky, a huge crash and a small destructible crater. A brief cinematic hands back grounded control with score and heat at zero.
- No timer. The day lasts until animal control's **net** catches Jimothy — the net is the *only* way the run ends.
- Heat tiers (0–5), GTA wanted-star style:
  - **0** — quiet block.
  - **1** — paparazzi follow with camera flashes.
  - **2** — angry locals kick at Jimothy while paparazzi continue flashing.
  - **3** — animal-control chaser with the net spawns. The net is lethal to the run; nothing else is.
  - **4** — police cars pursue Jimothy and armed police shoot at him.
  - **5** — **the ARMY.** Tanks, jets and soldiers with automatic rifles respond. Hits launch/stagger Jimothy and can drop his combo; the net remains the only run ender.
- **Wanted pacing requested 2026-10-03:** progress through those stages gradually, led by the destruction Jimothy causes. A crowd of frightened people or one small scrape must not skip directly to the army. The new kicking locals, police pursuit and rifle infantry remain planned; current runtime still has paparazzi, animal control, tanks and jets. JIM-35 is reopened for pacing work.
- **Building exploration (milestone 50):** wider connected rooms and hinged front/room doors remain in the continuous destructible world. Doors open on approach, obstruct sight/camera when closed, and break/fall when hit or unsupported. Furnishing groups leave clear paths; Jimothy's ceiling/overlap recovery retains the current floor.
- **Street routines (milestone 51):** the existing crowd makes phone calls, sips coffee, chases birds, cartwheels, meditates, levitates, moonwalks and gives piggyback rides, plus air guitar, robot dancing, stretches and selfies. Everyday habits are weighted more often; threats interrupt them and pairs separate. Landmark visit itineraries remain M41.
- **Fatness:** every snack makes Jimothy visibly fatter and jigglier — body distortion grows (a rounded version of the original raccoon, with readable head, paws and tail) with a springy wobble kicked by every bite. Score = points × combo; fatness = raw fat eaten (the body, and the capture screen's headline number). Fatness trade-offs (decided 2026-07-23): the fatter he is, the SLOWER he waddles and the harder he is to hide — bushes stop fitting entirely past a width threshold. Getting fat is winning and losing at the same time.
- **Food comes in two tiers** (2026-07-23 playtest feedback): **scraps** scoop instantly at full waddle (fat 1, 10 pts); **feasts** (WHOLE PIZZA, TURKEY LEG…) demand standing still to chomp through a channel (fat 5, 50 pts) — a deliberate risk commitment at high heat. Interrupting the chomp loses the progress.
- **Chaos raises heat** (not eating itself): tipping cans, wrecking/making a mess, **smashing the neighbourhood apart**, scaring locals, blasting powerups at people. Heat drains slowly while hidden and out of sight.
- **Everything breaks** (ADR-0003): the city is voxel-based and destructible — walls, fences, shopfronts, landmarks. Tank shells at tier 5 level the place; rubble is real geometry that piles up, blocks pursuers, and can bury food. Destruction is a chaos source, so wrecking things is itself a route up the heat ladder.
- **Cars reward growing stronger:** lean hits shatter windows, stronger blows break the body, and Chunky-size headbutts (fatness 25) trigger an explosion burst with separate wheels and panels. Wreckage remains physical and can be collected during giant rolling.
- **Contact has weight (2026-10-03, JIM-68):** at zero fatness, scurrying or rolling into standing people or cars costs Jimothy his forward momentum. Deliberate lean headbutts can topple a person with modest force and recoil. Growth earns rolling knockdowns, car shoves and collection; intact cars resist much more than people. Collision strength is separate from the existing headbutt destruction thresholds.
- **Built streets:** raised, destructible footpaths with concrete slabs and kerbs separate walking routes from roads and grass. Street grades keep a level cross-section through the hills.
- **Search strategy (2026-10-03):** nearby enemies receive an approximate dispatch area, need a short uninterrupted sighting to confirm Jimothy, and search his last seen position when he breaks sight. Noise draws attention to its own location. Bushes, darkness and solid cover help him escape. The local radar shows live sight cones, notice progress, finite search areas and committed military strikes; tanks need sight before choosing a new target.
- **Compass HUD (2026-10-04):** a circular, north-up minimap sits in the top right with the world clock curved into its rim. Wanted level and search status sit beneath it, followed by score, then a smaller fatness/combo row. The same map shows sewer routes underground.
- **Capture contest (2026-10-02):** animal control telegraphs a slow net swing, then fills a capture bar while holding Jimothy. Larger bodies take longer to capture; lean Jimothy keeps his faster movement. Escaping or knocking the catcher down interrupts capture. Rolls and headbutts ragdoll civilians and pursuers, who recover alive.
- **Living island (2026-10-02):** wind moves reactive grass, flowers and airborne particles; wildlife reacts to nearby rampaging. Daylight cycles through dusk, moonlit night and dawn. Water has waves and buoyancy; entry splashes, spreading ripples, foam and movement wakes grow with Jimothy’s size and impact speed. Falling cars, props, rubble and ragdolls share that response. Jimothy paddles and can climb back ashore. This swimming request supersedes milestone 14's fairy-return design.
- **Locals** (civilians) wander the block; scaring or slapstick-bonking them is chaos. Tone is strictly cartoon slapstick — startled leaps, dropped groceries, comedic fleeing. No gore, ever.
- **Powerups** (post-slice content, see backlog): bubble blower (trap people in bubbles), poop-yourself gun, dance ray, sick ray (vomit), kamehameha, extra-long legs, super jump, food magnet. Chaos tools raise heat; movement tools aid escape.
- **Trees:** Jimothy can climb; paparazzi and animal control cannot. Trees hold weird loot (bird nests, eggs, pants, other finds — "JIMOTHY ACQUIRES PANTS"). Pursuers wait below, so heat does not drain in a tree — and at tier 5, tank shells can dislodge him.
- Combo multiplier resets if no pickup for a few seconds (or when a shell sends him flying).
- Best score persists in localStorage.

## Usable tool arsenal and destination expansion — 2026-10-03

Chris approved tools → landmarks → food progression → tourists → drivers. Build at least twenty different usable tools; the implementation roster targets twenty-four with distinct uses, physical pickups, one equipped slot and a separate energy meter refilled by eating. Tool use does not spend earned fatness or score. Expand the imaginary Seattle island to sixteen varied destructible destinations with food/tool caches and accessible approaches. See `docs/tool-landmark-roster.md` and milestones 43–45; these are planned/in progress, not yet complete.

## Giant identity correction — 2026-10-03

The original textured model remains visible at every size. Proportional anatomy growth keeps the face, paws and tail readable while the belly gains more girth. The giant jiggles and tumbles continuously; an added ball must not replace his torso. Carried objects follow the actual animated skin. Giant rolls carve continuous shallow ground/road channels with tapered banks; repeated passes respect a nominal 2.2 m depth cap relative to the original grade. Lean rolls keep their lighter scrape.

## Scale and shape

> Chris, 2026-08-07: *"This isn't a crazy huge game, just a bit of fun for longer than the steam refund window."*

**The target is roughly two hours of play** — the Steam refund threshold — and that number is a ceiling as much as a floor. It is the yardstick for scoping anything expensive: a feature earns its place if it adds to those two hours, and content that would only matter in a forty-hour game does not.

**The world is an island, not a walled box.** Chris, 2026-08-07: *"a walled edge doesn't work — let's pop it on an island — imaginary Seattle island."* An invisible wall at the map edge announces the edge of the game; a coastline is a reason for the world to stop. Deliberately *imaginary* Seattle, not a reproduction — which also sidesteps the landmark trademark exposure recorded in `docs/backlog.md`.

**The water is the one thing allowed to be too good.** Chris: *"some stupidly impressive water physics — like so good they're out of place for the game."* This inverts the art direction on purpose rather than breaking it: everything else is demi-real photo-texture jank, and the sea is inexplicably gorgeous. The joke only works if the rest stays janky, so this is a licence for exactly one thing, not a general raising of fidelity.

**Explorable, not merely large.** `WORLD.BOUNDS` is 1000 (2000 units per side). Measured traversal: **3m 19s** scurrying edge to edge, 5m 31s walking, and 7–17 minutes while huge. That is a map you journey across, which is the intent — and it is why the minimap and waypoints (milestone 13) are not optional polish.

**Density is the whole bet — the model is Yakuza.** Chris, 2026-08-07: *"like yakuza!"* A small map crammed with things to find beats a large empty one, and the map is now large, so the density has to be built rather than assumed. This is the standing argument for the world-tour easter-egg pass (`docs/backlog.md`) being load-bearing content rather than decoration: **an empty big map is worse than the small one it replaced.** It is also the reason the two-hour target is a ceiling — those hours should come from density, not from distance.

## Win / lose conditions

No win state — score-attack. Lose = the net. The "win" is ending the day fatter than your personal best after surviving a tank barrage, and clipping the chaos.

## Art style

3D, third-person follow camera. **Demi-real with photo-texture jank**: real photographic textures (CC0 PBR sources) on simple geometry — the slightly-liminal, early-2000s-render look, on purpose. Stylized proportions on characters; Jimothy's short-spine roundness exaggerated and always on screen. One Ballard residential block: craftsman houses, yards, alley, climbable trees. Golden-hour Seattle mood — warm light, long shadows, saturated greens.

**Asset sourcing:** Jimothy is the only generated model — made with Meshy 5 in the Meshy web app (no API; free-tier export) and dropped in as GLB. Everything non-unique (houses, cans, trees, paparazzi, tanks, props) comes from open-source/CC0 model libraries.

## Audio direction

Procedural Web Audio, zero dependencies. Full meme slop: honks/squeaks for Jimothy, metallic trash-can percussion, camera-flash zaps, tank-shell whistles and comedy booms, and a chase theme that layers in intensity with each heat tier. Non-diegetic popup stingers for score events.

## Player goals

- **Short term (per run):** get as fat as possible before the net; keep the combo alive at high heat; survive tier 5 as long as possible.
- **Long term:** beat personal-best fatness (localStorage); share screenshots/clips of peak Jimothy chaos (an enormously fat raccoon in pants vs. a tank is the marketing).

## Anti-goals

- Not a stealth sim — hiding is a pressure valve, not the game.
- ~~Not open world — **one dense, destructible Seattle district**, bounded and hand-authored, not a streaming city~~ *(revised 2026-07-23, ADR-0003: the block becomes voxel-based and fully breakable; "hand-placed models" gave way to authored voxel level data)* — **REVERSED 2026-08-07.** It is now a streaming, explorable island (milestone 12 shipped the streaming; see "Scale and shape" above). Chris: *"It's meant to be explored."* The anti-goal is kept struck through rather than deleted because the reasoning behind it still holds as a warning: the game earns its value from *density* — things to smash, loot and trip over — and a big map is only an improvement if it is full. An empty big map is worse than the small one this replaced.
- No story, campaign, levels, or unlocks in v1.
- No multiplayer in v1 (keep game state centralized so it stays possible later).
- No mobile touch controls in v1 (desktop keyboard/mouse + gamepad only).
- The jank is curated — photo-texture uncanny is the aesthetic; broken gameplay is not.

## References

- **Jimothy the Raccoon** — the meme itself: [Know Your Meme](https://knowyourmeme.com/memes/jimothy-the-raccoon), [Wikipedia](https://en.wikipedia.org/wiki/Jimothy_(raccoon)). Short spine syndrome = the iconic round silhouette.
- **Goat Simulator** — physics-comedy rampage tone.
- **Untitled Goose Game** — small-space animal menace in a tidy neighborhood.
- **Katamari Damacy** — escalating gleeful score chaos.
- **GTA wanted stars** — the heat-tier escalation model, including the army showing up.
- **8-bit Jimothy game** ([GeekWire](https://www.geekwire.com/2026/8-bit-jimothy-viral-sensation-raids-trash-cans-eludes-paparazzi-in-seattle-creators-video-game/)) — prior art; we differentiate by being 3D, physics-flavored, and tank-inclusive.

## Open questions

- ~~Physics approach for can-tipping/shell knockback~~ — resolved: cannon-es (ADR-0002).
- Exact tree loot table and whether pants are cosmetic (Jimothy wears them) or score-only. Defer to the tree milestone.
- Is the score literally displayed as weight ("14.2 kg")? Cute, on-theme; decide at the fatness milestone.
- Powerup delivery: found on the block? dropped from tipped cans? tree loot? Decide at the powerups milestone.
- ~~**Fat is both the goal and a movement penalty, and the bigger map has made that collision much worse.**~~ **RESOLVED 2026-08-07 → JIM-29 (katamari roll).** Chris: *"let's do something with the roll katamari style… Jimothy becomes a giant wrecking ball."* Rather than softening the penalty, the roll scales *with* girth into a **hoarding mode**: on foot a fat Jimothy is slow, but rolling he is quick, and rolling is how he harvests. He accretes food, props and **people** like a marble, then stops to sift the stash — and anything alive he scooped comes back out where he dumps it, so a roll through a crowd must be followed by losing them before it pays. Fat stops being a tax and becomes a change of gear, and the roll becomes the *harvesting* tool while the headbutt stays the demolition one. Kept below for the measurements, which still bound the problem.
- **The measurements behind it.** `FATNESS.SPEED_PENALTY_MAX` was raised 0.45 → 0.7 to make the lasso land (JIM-23), which was right on a 500-unit map. On a 2000-unit one it means a *successful* run — a fat Jimothy — ends with him barely able to cross a world built for exploring: **12m 12s** to walk one side, versus 5m 31s lean. It also runs straight into JIM-24 ("as big as a house"), where the fantasy arguably wants a house-sized animal *covering ground*, not struggling. Candidate resolutions, none chosen: decouple size from speed above a threshold; make the penalty about agility (turning, acceleration) rather than top speed; or lean in and make traversal itself the fat trade-off, with the island's water as an alternative route. **Raised 2026-08-07 with measurements; needs a decision before JIM-24.**

## Approved military refinement — 2026-10-02

The giant-world pass adds tanks at tier 5 for all sizes, or tier 4 when Jimothy reaches an 8 m collision radius. Jets join at tier 5 for that larger size. Orange ground marks and HUD warnings precede attacks; moving away dodges the marked strike. Shells collide with intervening buildings and Jimothy's outer body. Blasts reset the combo, briefly launch and tumble him, and return control. The net remains the only run-ender. Strong attacks break military vehicles into physical parts that a large rolling Jimothy can collect. At giant size, E can interrupt rolling for an aimed headbutt. Looking upward launches his body toward low jet passes; the camera keeps the aircraft visible above his shoulder. Holding C resumes rolling after landing and recovery. Jets descend for their attack and climb away; distant or wrongly aimed attacks miss. Trees and the police cordon remain separate future work in milestone 03.

## Approved coast and underwater extension — 2026-10-02

Five beaches provide dry/wet sand, gradual outer shallows and local compaction from paws, rolls and impacts. The sea remains the existing wave/ripple and buoyancy simulation; sand uses persistent shallow dents with partial settling. Q dives, Space rises, and Shift swims faster. Underwater exploration alternates deliberate open stretches with varied wrecks, ruined structures, plants and wildlife. Breakable wreck pieces, artifacts, plants and ruin rubble participate in physical impacts and rolling collection. Daylight shafts, depth fog and bubbles support the underwater view; night reduces visibility. There is no drowning timer or new run-ending condition.


## Approved tools and landmark route — 2026-10-03

Chris approved tools → landmarks → food progression → tourists → drivers. Jimothy carries one of 24 food-powered tools, equips or swaps with T/LB, uses it with mouse/V/RB and drops it with G/B. Eating refills a separate tool-energy meter. The first eight gadgets are near spawn; sixteen additional tools reward travel to sixteen Seattle-inspired parody destinations. M opens the destination map and selecting a site supplies a waypoint. Landmarks have destructible voxel structures, physical details, food caches and street approaches. The complete roster is in `tool-landmark-roster.md`. Edible lobster/banana buildings and larger food tiers follow in milestone 40; tourists and driver visits follow in 41–42.
