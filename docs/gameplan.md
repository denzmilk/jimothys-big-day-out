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

- No timer. The day lasts until animal control's **net** catches Jimothy — the net is the *only* way the run ends.
- Heat tiers (0–5), GTA wanted-star style:
  - **0** — quiet block.
  - **1** — paparazzi appear and follow.
  - **2** — paparazzi swarm; camera flashes stun (comedy stagger, not run-ending).
  - **3** — animal-control chaser with the net spawns. The net is lethal to the run; nothing else is.
  - **4** — police cordon: more/faster pursuers, roadblocks.
  - **5** — **the ARMY.** Tanks roll in and fire shells at Jimothy. Shells ragdoll-launch him (dropping the combo, comedic knockback — possibly across the map) but never end the run. Shells can blast him out of trees.
- **Fatness:** every snack makes Jimothy visibly fatter and jigglier — body distortion grows (wide-load blob, tiny head) with a springy wobble kicked by every bite. Score = points × combo; fatness = raw fat eaten (the body, and the capture screen's headline number). Fatness trade-offs (decided 2026-07-23): the fatter he is, the SLOWER he waddles and the harder he is to hide — bushes stop fitting entirely past a width threshold. Getting fat is winning and losing at the same time.
- **Food comes in two tiers** (2026-07-23 playtest feedback): **scraps** scoop instantly at full waddle (fat 1, 10 pts); **feasts** (WHOLE PIZZA, TURKEY LEG…) demand standing still to chomp through a channel (fat 5, 50 pts) — a deliberate risk commitment at high heat. Interrupting the chomp loses the progress.
- **Chaos raises heat** (not eating itself): tipping cans, wrecking/making a mess, **smashing the neighbourhood apart**, scaring locals, blasting powerups at people. Heat drains slowly while hidden and out of sight.
- **Everything breaks** (ADR-0003): the city is voxel-based and destructible — walls, fences, shopfronts, landmarks. Tank shells at tier 5 level the place; rubble is real geometry that piles up, blocks pursuers, and can bury food. Destruction is a chaos source, so wrecking things is itself a route up the heat ladder.
- **Locals** (civilians) wander the block; scaring or slapstick-bonking them is chaos. Tone is strictly cartoon slapstick — startled leaps, dropped groceries, comedic fleeing. No gore, ever.
- **Powerups** (post-slice content, see backlog): bubble blower (trap people in bubbles), poop-yourself gun, dance ray, sick ray (vomit), kamehameha, extra-long legs, super jump, food magnet. Chaos tools raise heat; movement tools aid escape.
- **Trees:** Jimothy can climb; paparazzi and animal control cannot. Trees hold weird loot (bird nests, eggs, pants, other finds — "JIMOTHY ACQUIRES PANTS"). Pursuers wait below, so heat does not drain in a tree — and at tier 5, tank shells can dislodge him.
- Combo multiplier resets if no pickup for a few seconds (or when a shell sends him flying).
- Best score persists in localStorage.

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
- ~~**Fat is both the goal and a movement penalty, and the bigger map has made that collision much worse.**~~ **RESOLVED 2026-08-07 → JIM-29 (katamari roll).** Chris: *"let's do something with the roll katamari style… Jimothy becomes a giant wrecking ball."* Rather than softening the penalty, the roll scales *with* girth: on foot a fat Jimothy gets slower, but rolling he becomes unstoppable. Fat stops being a tax and becomes a change of mode. Kept below for the measurements, which still bound the problem.
- **The measurements behind it.** `FATNESS.SPEED_PENALTY_MAX` was raised 0.45 → 0.7 to make the lasso land (JIM-23), which was right on a 500-unit map. On a 2000-unit one it means a *successful* run — a fat Jimothy — ends with him barely able to cross a world built for exploring: **12m 12s** to walk one side, versus 5m 31s lean. It also runs straight into JIM-24 ("as big as a house"), where the fantasy arguably wants a house-sized animal *covering ground*, not struggling. Candidate resolutions, none chosen: decouple size from speed above a threshold; make the penalty about agility (turning, acceleration) rather than top speed; or lean in and make traversal itself the fat trade-off, with the island's water as an alternative route. **Raised 2026-08-07 with measurements; needs a decision before JIM-24.**
