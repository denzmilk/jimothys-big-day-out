# Jimothy's Big Day Out

## Pitch

Play as Jimothy — Seattle's viral short-spine raccoon — in a third-person 3D rampage across one Ballard block. Every snack you eat makes you visibly fatter, and fat is score; every bit of chaos — tipped cans, scared locals, general mess — makes you more wanted, until the response escalates from paparazzi all the way to the army rolling in tanks. It's a game about getting big and fat without getting captured: shells send you flying, but nothing ends the day until the net catches you.

## Core gameplay loop

1. **Waddle** around the block (third-person follow cam, camera-relative controls, arcade-floaty momentum).
2. **Bonk** trash cans to tip them, then **raid** the spilled garbage for snacks.
3. **Eat to get FAT** — every snack visibly grows Jimothy. Fat is the score; chaining pickups quickly builds a combo multiplier.
4. **Climb** trees to loot weird finds (bird nests, eggs, pants) and catch a breather — ground pursuers can't climb.
5. Chaos raises **HEAT** — tipping cans, making a mess, scaring (slapstick-hurting) locals. Paparazzi → animal control → police cordon → the ARMY, with tanks that blast Jimothy across the map.
6. **Grab silly powerups** (bubble blower, dance ray, food magnet…) to cause chaos and escape trouble.
7. **Scurry and hide** (bushes, under porches) to slowly drain heat — or keep rampaging and ride the multiplier.
8. Get **netted** → day over → final fatness vs. personal best. Immediately restart.

## Game rules

- No timer. The day lasts until animal control's **net** catches Jimothy — the net is the *only* way the run ends.
- Heat tiers (0–5), GTA wanted-star style:
  - **0** — quiet block.
  - **1** — paparazzi appear and follow.
  - **2** — paparazzi swarm; camera flashes stun (comedy stagger, not run-ending).
  - **3** — animal-control chaser with the net spawns. The net is lethal to the run; nothing else is.
  - **4** — police cordon: more/faster pursuers, roadblocks.
  - **5** — **the ARMY.** Tanks roll in and fire shells at Jimothy. Shells ragdoll-launch him (dropping the combo, comedic knockback — possibly across the map) but never end the run. Shells can blast him out of trees.
- **Fatness:** every snack makes Jimothy visibly fatter — body scale grows with snacks eaten. Score IS getting fat (points per snack × combo). Fatness trade-offs are an open question (slower? bigger target? harder to hide?) — the tension should be "one more snack" greed vs. escape-ability.
- **Chaos raises heat** (not eating itself): tipping cans, wrecking/making a mess, scaring locals, blasting powerups at people. Heat drains slowly while hidden and out of sight.
- **Locals** (civilians) wander the block; scaring or slapstick-bonking them is chaos. Tone is strictly cartoon slapstick — startled leaps, dropped groceries, comedic fleeing. No gore, ever.
- **Powerups** (post-slice content, see backlog): bubble blower (trap people in bubbles), poop-yourself gun, dance ray, sick ray (vomit), kamehameha, extra-long legs, super jump, food magnet. Chaos tools raise heat; movement tools aid escape.
- **Trees:** Jimothy can climb; paparazzi and animal control cannot. Trees hold weird loot (bird nests, eggs, pants, other finds — "JIMOTHY ACQUIRES PANTS"). Pursuers wait below, so heat does not drain in a tree — and at tier 5, tank shells can dislodge him.
- Combo multiplier resets if no pickup for a few seconds (or when a shell sends him flying).
- Best score persists in localStorage.

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
- Not open world — one block, dense and hand-placed.
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
- Fatness trade-offs: does fat slow him, enlarge his hitbox/catch radius, block hide spots, all of the above? Decide at the fatness milestone — greed-vs-escape tension is the design goal.
- Is the score literally displayed as weight ("14.2 kg")? Cute, on-theme; decide at the fatness milestone.
- Powerup delivery: found on the block? dropped from tipped cans? tree loot? Decide at the powerups milestone.
