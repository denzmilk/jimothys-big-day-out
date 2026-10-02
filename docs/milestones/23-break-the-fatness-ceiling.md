# Milestone 23: Break the fatness ceiling — grow until the city is furniture

## Status

**Reopened after Chris's playtest, 2026-10-02.** Growth and held movement exist, but the giant form does not read as a ball and the tumble stops after 0.9 seconds while translation continues (JIM-24/JIM-49/JIM-60). See [the loaded-model audit](../giant-audit-2026-10-02.md). Previous size/camera checks below do not establish correct shape or continuous rotation. Giant destruction is separately recorded as JIM-61.

Depends on: milestone 22 (things land on the ground) · Blocks: milestone 24 (katamari roll)

## Objective

Make eating grow Jimothy without limit, and make everything that has to work at that size actually work: he can be seen, he can move, and the city stops being an obstacle course and becomes furniture.

> Chris, 2026-08-07: *"the idea is that Jimothy can get as big as a house if he keeps eating."*
>
> Chris, 2026-08-08, on the dev panel's fatness dial topping out: *"That upper limit is way too small for ultimate fatness — that's gotta be an issue to change and increase to an actual massive size. Like consume the world size."*

This is **JIM-24**, and it is the core fantasy: fat is the score, so the score having a hard ceiling is the game having one.

## The ceiling is arithmetic, not tuning

`width = 1 + MAX_WIDTH_GAIN × f` where `f = fat / (fat + SOFTCAP)`. Since `f < 1` for every finite input, **width cannot exceed ×1.9 — ever, for any amount of food.** No value of `SOFTCAP` moves it. Measured across the whole dial:

| fatness | factor | body width | blast radius |
|---|---|---|---|
| 0 | 0.000 | ×1.00 | 0.75 m |
| 25 | 0.500 | ×1.45 | 3.50 m |
| 90 | 0.783 | ×1.70 | 5.05 m |
| 200 | 0.889 | ×1.80 | 5.64 m |
| 600 | 0.960 | ×1.86 | 6.03 m |

Eating **24× more** between fatness 25 and 600 buys **28 % more width**. The curve is the defect.

## The two decisions, made 2026-08-09

**How big: block-sized, ×30–50** (Chris's call). Against the world's real numbers:

| | width |
|---|---|
| Jimothy, lean | 1.1 m |
| Jimothy, today's hard ceiling | 2.1 m |
| a craftsman house (`CITY.MIN/MAX_HEIGHT`) | 6–16 m |
| **the target** | **33–55 m** |
| a city block including its road (`CITY.BLOCK`) | 34 m |
| the streamed world's radius (`STREAM.LOAD_RADIUS`) | 106 m |
| the island | 2000 m |

So he ends up **bigger than any building including the downtown towers, and about one city block across**. Island-scale (×100+) was considered and rejected for now: at 110 m he is wider than the entire loaded world, which is a rendering-strategy change rather than a tuning one.

**Speed at scale: the roll.** This is the open question `docs/gameplan.md` flags as *"needs a decision before JIM-24"* — `SPEED_PENALTY_MAX` is 0.7, so a maxed Jimothy walks at 1.8 m/s and takes **12 minutes** to cross the island against 5.5 lean. Chris, 2026-08-09:

> *"The roll is supposed to turn into a katamari style roll and collect at this fatness scale — so that's how you move about."*

So the on-foot penalty **stays exactly as signed off** — a fat raccoon waddling is slow, and that trade is not being softened. What changes is that at this size the roll stops being a 0.9 s comedy flop and becomes a **sustained traversal mode whose speed scales with him**. Fat stops being a tax on exploring and becomes a change of gear, which is precisely the resolution recorded against JIM-29.

**This milestone delivers the movement half of that and not the collecting half.** Accretion, the stash, sifting and people-come-back-out are milestone 24 — a whole loop, and a separate playtest.

## Scope

- `src/core/Constants.js` — an unbounded growth curve; the roll's traversal numbers; `DEV.FATNESS_MAX` raised to match.
- `src/core/MathUtils.js` — `fatFactor` stays 0→1 for everything that *should* saturate (speed penalty, hide squeeze, jiggle); a new unbounded companion drives SIZE. Keeping them separate is the point: the penalties were tuned against a saturating curve and must not inherit an unbounded one.
- `src/gameplay/JimothyController.js` — collision radius, step-over height and the roll at scale.
- `src/systems/CameraSystem.js` — the boom pulls back with girth, or he fills the screen and the player cannot see the street.
- `src/ui/DevTools.js` — the fatness dial's range and readout follow the new curve.

## Out of scope

- **Katamari collection (JIM-29)** → milestone 24. This one only has to make him big and mobile.
- **The building LOD ring (JIM-37).** At block scale the streaming boundary is very visible — he is 44 m across inside a 106 m disc. That is a real problem and it is *not* made worse by this milestone; it is the same pop-in already logged, newly obvious. Its own milestone.
- **Heat and destruction at scale (JIM-35).** `BLAST_PER_FAT` compounds, so a block-sized headbutt will level a block, and one headbutt is already a five-star wanted level. Expect the playtest to make this urgent; it wants Chris's judgement rather than a guess, so it stays logged.
- **Softening the on-foot speed penalty.** Explicitly rejected above.

## Giant repair acceptance — approved 2026-10-02

- [ ] Loaded torso becomes round at Block/Absurd size, with small head/limbs and collision/visual centres aligned at multiple headings.
- [ ] Held giant rolling continues rotating with travelled distance past the first second; lean flop remains intact.
- [ ] Attached props and people meet the visible skin across several rotations and release with owner physics/AI restored.

## Acceptance criteria

- [x] Eating past the old ceiling keeps making him bigger — width strictly increases at fatness 200, 2 000 and 20 000, where today all three are ×1.8
- [x] He reaches block scale: at a reachable fatness he is wider than `CITY.MAX_HEIGHT`, i.e. bigger than any building on the island
- [x] The camera keeps him in frame at every size — asserted against his actual silhouette in the frustum, not against a distance constant
- [x] He can still move at scale: he steps over the things he is now bigger than instead of catching on them, and never wedges on a house
- [x] The roll is a sustained traversal mode at scale — a block-sized Jimothy crosses the island in a time comparable to a lean one on foot, against 12 minutes today
- [x] Everything that saturates still saturates: the speed penalty, hide squeeze and jiggle are unchanged at the fatnesses they were tuned at
- [x] Nothing that reads fatness breaks at extreme values — the dev readout, the HUD, the snapshot
- [ ] It feels like becoming a monster rather than a bigger raccoon — **verified by user playtest**

## Exit condition

User eats until Jimothy is taller than the houses, rolls across the island in a sane amount of time, and the city reads as furniture rather than as an obstacle course.

## Verification — 2026-10-02

`tests/scale.spec.js` covers continued growth, reachable block size, unchanged saturating penalties, camera framing, movement and held rolling. Adjacent aim, physics, fatness and dev-panel checks were run with the world pass. A separate loaded-rig measurement projected the bounds of every posed body part into the camera at fatness 0, 90 and 250: maximum vertical screen extent 0.263, 0.500 and 0.695, all within the frame. Evidence: `output/iterate/actual-rig-camera-check.log`. The visual feel still needs Chris's playtest.
