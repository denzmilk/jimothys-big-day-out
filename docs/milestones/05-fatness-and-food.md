# Milestone 05: Fatness & food

## Status

in-progress — implementation complete and green (35/35 suite), awaiting Chris's jiggle/pacing playtest

## Objective

Deliver the core fantasy: Jimothy gets visibly big and jiggly as he eats. Body distortion (wide-load blob growth with a springy jiggle on every bite) driven by a new fatness stat, and a two-tier food economy per Chris's playtest feedback ("a lot of food was needed… some you gotta stop to eat vs. just kind of scooping as you go"): scraps scoop instantly on the move, feasts are big fat paydays that require standing still to chomp through — a deliberate risk commitment at high heat.

## Scope

- `FOODS` constants: **scrap** (instant scoop, fat 1, 10 pts) and **feast** (channel-to-eat, fat 5, 50 pts, ~1.2 s standing still); can spills become 4 scraps + 1 feast.
- Channel eating: standing within reach of a feast (below a max speed) accrues progress; moving off or getting stunned resets it. "NOM NOM NOM" feedback while chomping.
- Fatness stat on GameState (`player.fatness`), fed by food fat values via ScoreSystem; combo multiplies points, not fat.
- Body distortion: width/depth grow toward a soft-capped maximum as fatness rises (height barely — wide-load blob, tiny head untouched for meme accuracy).
- Jiggle: damped spring kicked on every bite (big kick for feasts) + continuous jelly wobble while moving, scaled by fatness.
- HUD `FAT` readout; capture screen already reports FINAL FATNESS (now backed by real fatness — shows the fatness stat, score stays the combo-multiplied number).
- Fatness/food knobs in the DevTools Tune tab.

## Out of scope

- ~~Fatness gameplay trade-offs~~ — Chris decided mid-milestone (slower waddle + bushes stop fitting) and they were appended below; bigger net-catch radius was NOT chosen.
- More food types beyond the two tiers; food magnets and other powerups (backlog).
- Weight-as-score display ("14.2 kg") — open question in the gameplan.

## Dependencies

- **Depends on:** milestone 02
- **Blocks:** none (03 proceeds independently; slop-rig will inherit the distortion/jiggle rig)

## Acceptance criteria

- [x] Can spills contain both food types; snapshot lists snack types — test: `tests/fatness.spec.js::spills contain scraps and a feast`
- [x] Scraps scoop instantly while moving (existing behavior, now typed) — test: `tests/fatness.spec.js::scraps scoop on the move`
- [x] Walking over a feast does NOT collect it — test: `tests/fatness.spec.js::feasts require stopping`
- [x] Standing at a feast for the channel duration collects it: +50×combo points, +5 fatness — test: `tests/fatness.spec.js::feasts require stopping`
- [x] Leaving mid-channel resets progress — test: `tests/fatness.spec.js::interrupted feast resets`
- [x] Eating raises `fatness` and visibly widens the body (snapshot `widthScale` grows) — test: `tests/fatness.spec.js::fatness distorts the body`
- [x] HUD shows the fatness readout — test: `tests/fatness.spec.js::hud shows fatness`
- [x] Fat Jimothy waddles measurably slower (asymptotic speed penalty) — test: `tests/fatness.spec.js::fat jimothy waddles slower` *(appended 2026-07-23: Chris's trade-off call)*
- [x] Past a width threshold, bushes no longer conceal him (hide radius squeezes to zero) — test: `tests/fatness.spec.js::fat jimothy cannot fit in bushes`
- [ ] Jiggle feels goofy: bite-kick wobble + jelly while waddling — verified by user playtest
- [ ] Food economy pacing (does progress feel meaty now?) — verified by user playtest

## Exit condition

User tips a can → scoops scraps at full waddle, then stops on the WHOLE PIZZA and chomps through it while paparazzi close in → Jimothy visibly balloons and jiggles with every bite → the capture screen reports a FINAL FATNESS worth bragging about.

## Test plan

Failing Playwright specs first (`tests/fatness.spec.js`) via `render_game_to_text` + `advanceTime`; channel timing asserted deterministically. Manual playtest: Chris judges jiggle comedy and food pacing; tunes `FATNESS`/food knobs in the panel. Regression: `npm run test:smoke && npx playwright test`.

## Notes

- Test-infra hardening done during this milestone: tests now boot in manual time from frame zero (`__MANUAL_TIME__` init flag) so no real-time physics ever runs under test; assertions tolerate incidental can-bonks during navigation; Playwright timeout raised to 120s with workers capped at 4 (flakes were pure wall-clock timeouts under parallel sim load — the sim itself is deterministic).

- Fat is score's engine but they're separate numbers: score = points × combo (the leaderboard number), fatness = pure accumulated fat (the body). Capture screen shows fatness; HUD shows both.
- The distortion applies to the placeholder body mesh now and must transfer cleanly to the slop-rig body piece later — keep it a scale/spring on the body slot, not mesh-specific math.
