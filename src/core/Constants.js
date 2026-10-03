export const PLAYER_CONFIG = {
  SPEED: 6,
  SCURRY_SPEED: 10,
  ACCEL: 30,
  TURN_SPEED: 8,
  // Snappy pop, not a moon jump: a raccoon hop should land where you aimed
  // it. Air control is throttled so he can't steer a whole flight path
  // mid-hop (playtest 2026-07-23: "jumps and just flies away").
  HOP_FORCE: 6,
  HOP_GRAVITY: 34,
  AIR_CONTROL: 0.35,
  // How high a ledge he can auto-climb: crater walls, rubble, kerbs. Must
  // exceed the deepest crater or his own destruction traps him.
  CLIMB_HEIGHT: 2.6,
  // How far above a surface still counts as standing on it. Big enough to
  // absorb the jitter of stepped voxel geometry (roof steps, crater lips) —
  // at 0.05 he oscillated between grounded and falling forever on a rooftop.
  GROUND_STICK: 0.25,
  CONTACT_WIDTH: .8, CONTACT_SKIN: .015, RECOVERY_RINGS: 4, RECOVERY_DIRECTIONS: 8,
  RADIUS: 0.55,
  PICKUP_RADIUS: 1.0,
  BONK_MIN_SPEED: 2,
  WADDLE_BOB_HZ: 3.2,
  WADDLE_BOB_AMPLITUDE: 0.08,
};

// JIM-68: controlled bodies need finite pushing strength even though Cannon
// integrates Jimothy as kinematic. Growth earns the heavy-object shove.
export const BODY_CONTACT = {
  BASE_MASS: 9, MASS_PER_FAT: 12, CAR_PUSH_RATIO: .5,
  HUMAN_MASS: 77, HUMAN_PUSH_RATIO: .65, HUMAN_RADIUS: .4, HUMAN_HEIGHT: 1.75,
  SKIN: .035, EPSILON: .000001, RECOVERY: .3,
  LEAN_HIT_SCALE: .24, FULL_HIT_FATNESS: 18,
  CAR_LIFT: .2, CAR_SPIN: .2,
};

export const INPUT = {
  DEADZONE: 0.15,
  GAMEPAD_HOP_BUTTON: 0,
  GAMEPAD_DIVE_BUTTON: 2,
  GAMEPAD_SCURRY_BUTTON: 7,
};

// Physical key codes (e.code) — layout-independent, rebindable via DevTools.
// Arrays are mutated in place by rebinding/overrides; never reassign them.
export const KEYBINDS = {
  FORWARD: ['KeyW', 'ArrowUp'],
  BACK: ['KeyS', 'ArrowDown'],
  LEFT: ['KeyA', 'ArrowLeft'],
  RIGHT: ['KeyD', 'ArrowRight'],
  HOP: ['Space'],
  DIVE: ['KeyQ'],
  SCURRY: ['ShiftLeft', 'ShiftRight'],
  POINTER_LOCK: ['KeyL'],
  DEVTOOLS: ['Backquote'],
  RESTART: ['KeyR'],
  HEADBUTT: ['KeyB', 'KeyE'],
  ROLL: ['KeyC'],
  TOOL_PICKUP:['KeyT'], TOOL_DROP:['KeyG'], TOOL_USE:['KeyV'],
  // Fly camera (milestone 17). FORWARD/BACK/LEFT/RIGHT and SCURRY are shared
  // with the raccoon on purpose — flying takes the controls AWAY from him
  // (InputSystem.suppressed) rather than running two things off one keypress.
  FLY_TOGGLE: ['KeyF'],
  FLY_UP: ['Space'],
  FLY_DOWN: ['KeyZ'],
  FLY_FASTER: ['Equal'],
  FLY_SLOWER: ['Minus'],
  FLY_SLOW: ['ControlLeft', 'ControlRight'],
};

// Jimothy's two destruction moves. Both hit IN FRONT of him rather than at
// his feet — blasting under himself dug a pit he fell into and got stuck in
// (playtest 2026-07-23). Both scale with fatness: a chunky Jimothy is a
// wrecking ball.
export const MOVES = {
  // The split (2026-08-06): headbutt is the DEMOLITION tool. The roll is the
  // COMEDY tool — a wonky forward flop, not a dash (Chris's playtest: "it
  // should be a wonky slow roll forward, almost like a flop"). Before this
  // they were both wrecking balls travelling faster than a sprint, so there
  // was no reason to pick one and a fat Jimothy ploughed the city flat by
  // accident.
  HEADBUTT: {
    REACH: 1.6,        // how far ahead the impact lands
    WINDUP: 0.12,      // rear back…
    LUNGE: 0.18,       // …then snap forward
    RECOVER: 0.22,
    LUNGE_SPEED: 7,    // he shoves himself into the hit
    COOLDOWN: 0.45,
    RADIUS_SCALE: 1.0,
    // Full fatness payoff: this is the move eating is meant to buy.
    FAT_BLAST_SHARE: 1.0,
    // `DIGS_TERRAIN: false` is the un-aimed answer, kept for the roll. A flat
    // headbutt cratering the road turned every swing into a hole he then had to
    // climb out of (playtest 2026-07-23), and this flag was the fix. It was
    // never "Jimothy cannot dig", it was "an unaimed dig is an accident".
    //
    // AIMABLE hands the decision to `Game.digsTerrain` instead, which asks the
    // WORLD rather than a number: **the swing digs when it will actually strike
    // ground.**
    //
    // There used to be a `DIG_ANGLE: 0.5` here — terrain became a target only
    // past 0.5 rad below the resting camera, more than half the available
    // downward travel. It is gone (playtest 2026-08-08, Chris: *"it's like it
    // only works if you hard lock into the ground"*), and what condemned it is
    // that it disagreed with the reticle: measured, the marker reported
    // reachable ground from 0.04 rad while the swing refused to dig until 0.54.
    //
    // Geometry is stricter than the angle where it matters — a flat swing
    // across a street still cannot crater the road, because a horizontal ray
    // from chest height never reaches the ground inside a headbutt's reach,
    // which is the 2026-07-23 fix restated as a fact rather than a threshold —
    // and looser everywhere else, which is what Chris asked for. It also makes
    // the reticle authoritative: orange means this swing digs.
    DIGS_TERRAIN: false,
    AIMABLE: true,
    // …and once he is THIS far under his own column's surface, terrain is a
    // target whatever the swing meets, including nothing at all (JIM-40). There
    // is no street to protect down a tunnel, and the old gate made digging
    // sideways impossible — measured at 0 voxels removed for a flat swing
    // against 11 for an aimed-down one, from the same spot in a sewer. Deep
    // enough that standing in a puddle of a crater does not count.
    DIG_BELOW: 1.5,
    // Anticipation is sold by PITCH, barely by sliding the head. The model's
    // pieces have open seams (JIM-10), so a big head translation drags the
    // neck hole into view — which is exactly what a headbutt was doing
    // (playtest 2026-08-06: "the headbutt also separates the body mesh").
    // Keep THRUST small and let PITCH carry the performance.
    THRUST_BACK: -0.07,
    THRUST_FWD: 0.12,
    PITCH_BACK: -0.26,
    PITCH_FWD: 0.34,
    // How much harder the head pitches than the body it sits on.
    HEAD_PITCH_GAIN: 1.6,
  },
  ROLL: {
    // Slower than a WALK (6) on purpose. At 13 it outran the scurry and read
    // as a dodge; the joke is a heavy raccoon heaving himself over.
    DURATION: 0.9,
    SPEED: 5,
    SPINS: 1,          // one deliberate flop, not a gymnastics routine
    COOLDOWN: 0.9,
    // Eased rather than linear: he commits slowly, tips past the balance
    // point, whips over and lands. A constant-rate spin looks mechanical.
    WOBBLE: 0.14,      // lateral wonk (radians) so the flop isn't clean
    WOBBLE_HZ: 1.5,
    // The tuck. A rigid model rotating on the spot reads as a prop being
    // spun, not an animal throwing itself over — he has to gather up first.
    // Ramps in over the windup fraction and back out at the end.
    TUCK_IN: 0.18,     // fraction of the roll spent gathering up…
    TUCK_OUT: 0.25,    // …and sprawling back out at the end
    TUCK_LEG: 1.15,    // legs fold under him (radians)
    TUCK_HEAD: 0.75,   // chin to chest
    TUCK_TAIL: 0.5,    // tail curls in
    TUCK_SQUASH: 0.12, // body balls up: wider and shorter
    // How much of his girth becomes roll speed (milestone 23). The roll is how
    // a giant gets around, so this is the number that decides whether the
    // island is crossable once he is block-sized: at 0.15 a fatness-250 Jimothy
    // (x32.6) rolls at about 29 m/s, crossing 2 km in ~70 s against 5m31s for a
    // LEAN raccoon on foot. Neutral at fatness 0 by construction.
    GIRTH_SPEED: 0.15,
    // Seconds between destruction ticks. It used to be five ticks spread across
    // a fixed 0.9 s roll; now that the roll is held for as long as you like,
    // ticking on a fraction of a duration that no longer exists would fire the
    // whole budget in the first second. TICKS is gone with it.
    TICK_SECONDS: 0.18,
    // A roll scrapes what it passes; it does not bore a tunnel. Five ticks of
    // a fat blast radius trenched whole streets (playtest 2026-08-06).
    RADIUS_SCALE: 0.55,
    // …and it only inherits a slice of the fatness bonus, so getting fat makes
    // you a better demolisher without making the flop a bulldozer.
    FAT_BLAST_SHARE: 0.3,
    DIGS_TERRAIN: false,
  },
};

export const TRASH_CAN = {
  RADIUS: 0.38,
  HEIGHT: 1.0,
  MASS: 8,
  // Upright dot-product threshold: below this the can counts as tipped.
  TIP_UP_DOT: 0.7,
  BONK_IMPULSE: 26,
  BONK_LIFT: 3,
  // Bonks re-fire while overlapping; cooldown keeps cans from rocketing.
  BONK_COOLDOWN_SECONDS: 0.4,
  // Containers are scattered across the city procedurally (see
  // TrashCans.defaultLayout) — hand-placing them across a 220 m district
  // isn't viable. Kept as the fallback/dev-reset layout near spawn.
  POSITIONS: [
    [6, -4], [10, 3], [-7, 6], [-12, -8], [3, 12],
    [-3, -14], [14, -12], [-16, 4], [9, 16], [-11, 14],
  ],
  // Variety of street containers — different sizes, masses and payouts.
  KINDS: [
    { name: 'can', radius: 0.38, height: 1.0, mass: 8, scraps: 4, feasts: 1, color: 0x3f6f5f },
    { name: 'wheelie', radius: 0.5, height: 1.4, mass: 14, scraps: 6, feasts: 1, color: 0x2f5f3f },
    { name: 'dumpster', radius: 0.95, height: 1.5, mass: 34, scraps: 9, feasts: 2, color: 0x4a5a72 },
    { name: 'recycling', radius: 0.42, height: 1.0, mass: 7, scraps: 3, feasts: 0, color: 0x2f6a8a },
  ],
  COUNT: 70,
};

// Where street containers go (Layout.propsIn). Placement is SEMANTIC — a bin is
// behind a shop or on a kerb, never at a hash-chosen point on a lattice — and
// these are the rates at which each kind of place gets one.
export const CONTAINERS = {
  STEP: 7,          // metres between candidate points
  // Alleys are where bins live, densely: both what a city does and where a
  // raccoon belongs.
  ALLEY_SHARE: 0.75,
  // Kerbside, in a district that HAS alleys — the back of house takes most of
  // them, so the street front stays sparse.
  KERB_SHARE: 0.125,
  // …and in a district that has none. Four times the rate, because that is
  // literally what happens in a city without alleys: everybody's bin is out
  // front. One rate for both left every residential and retail district on the
  // island with 5–13 containers per streaming disc against downtown's 38–56 —
  // the "empty big map" failure the gameplan warns about (JIM-32), returning
  // through the back door when milestone 17 changed the district mix.
  KERB_SHARE_NO_ALLEYS: 0.5,
  // Kerbside means BESIDE the road, not in it: 586 of 586 bins once shipped in
  // the carriageway. How far to look for one.
  KERB_REACH: 2.5,
};

// Two-tier food economy (gameplan): scraps scoop instantly on the move,
// feasts are fat paydays you must stand still to chomp through — a deliberate
// risk commitment at high heat.
export const FOODS = {
  SCRAP: { FAT: 1, POINTS: 10, RADIUS: 0.16 },
  FEAST: {
    FAT: 5,
    POINTS: 50,
    RADIUS: 0.32,
    CHANNEL_SECONDS: 1.2,
    // Faster than this and you're not eating, you're passing through.
    EAT_MAX_SPEED: 0.5,
    REACH: 1.1,
    NAMES: [
      'WHOLE PIZZA', 'TURKEY LEG', 'ENTIRE LASAGNA', 'BIRTHDAY CAKE',
      'FAMILY ROAST', 'ABANDONED MEATLOAF',
    ],
  },
};

export const FATNESS = {
  // Fat units at which the SATURATING factor reaches a half. Everything that
  // is a trade-off rides that factor (`fatFactor`) and still tops out.
  SOFTCAP: 25,
  // --- size: unbounded (milestone 23 / JIM-24) ---
  //
  // `width = 1 + MAX_WIDTH_GAIN * f` with `f = fat/(fat+SOFTCAP)` could never
  // exceed x1.9, for any amount of food ever eaten, because `f < 1`. That is
  // arithmetic and no value of SOFTCAP moves it: measured, eating 24x more
  // between fatness 25 and 600 bought 28 % more width. Chris, 2026-08-08:
  // *"that's gotta be an issue to change and increase to an actual massive
  // size. Like consume the world size."*
  //
  // A power curve instead, and deliberately one with POWER > 1. The obvious
  // alternatives were tried on paper and none of them work here: log and any
  // sub-linear power are *steep early and flat late*, so calibrating either to
  // reach block scale at a reachable fatness makes him house-sized by his
  // twentieth snack. The whole point is a big dynamic range, and only a
  // super-linear curve is small at the start and enormous at the end.
  //
  // Calibrated against the world's own numbers, which is why it lands where it
  // does — `Gorged` (90) is the fatness every measurement in the docs is
  // quoted at, and 250 is a run that went well:
  //
  //   fatness  90 -> x7.8   ~8.6 m, taller than a craftsman house (6-16 m)
  //   fatness 250 -> x32.6  ~36 m, wider than a CITY.BLOCK, bigger than a tower
  //   fatness 400 -> x65    and it keeps going, forever
  //
  // It has no ceiling. The practical limit is what the renderer can show — past
  // roughly x100 he is wider than the streamed world (STREAM.LOAD_RADIUS, 106 m)
  // and would be standing in ungenerated void, which is JIM-37's problem.
  WIDTH_GAIN: 1.0,
  GROWTH_POWER: 1.5,
  // A power curve is nearly FLAT near zero — at fatness 3 it gives x1.04 where
  // the old asymptote gave x1.10 — so the first few snacks would stop showing,
  // and "every snack visibly fattens Jimothy" is the core loop's step 3. So the
  // old curve is kept as an EARLY term rather than replaced: it saturates, so
  // it contributes 0.9 at most and is a rounding error once the power term
  // takes over, but it restores exactly the early growth that was signed off.
  EARLY_WIDTH_GAIN: 0.9,
  EARLY_HEIGHT_GAIN: 0.25,
  // How fast the silhouette becomes a BALL as he grows (playtest 2026-08-09).
  //
  // Chris: *"using the slider at the moment he just kind of gets really long -
  // but he should grow out in a big circle so the rolling makes sense."* He was
  // right, and the cause is that the skinned path scales the belly bone
  // UNIFORMLY — which preserves proportions, so a raccoon at x32 is a 64 m
  // raccoon. Long, not round.
  //
  // Blend the physical pivot toward the grown torso around House size.
  // JIM-69 retains the original textured animal and proportionate anatomy.
  ROUNDNESS_FULL_GROWTH: 8,
  // Height gains far less than width: he is a short-spine raccoon, and the
  // silhouette has to stay a wide low blob rather than becoming a cube. Kept at
  // the same RATIO to width the old constants had (0.25 / 0.9).
  HEIGHT_GAIN: 0.28,
  JIGGLE_HZ: 9,
  JIGGLE_DAMPING: 4,
  KICK_SCRAP: 0.06,
  KICK_FEAST: 0.2,
  // Continuous jelly wobble while waddling, scaled by fatness.
  JELLY: 0.05,
  // Eating makes him STRONGER, not just fatter (Chris 2026-07-23: "as jimothy
  // eats he can get stronger"). Blast radius grows with the same asymptotic
  // fat factor, so a well-fed Jimothy levels buildings a skinny one can only
  // chip. This is the upside that makes the speed penalty a real trade.
  // Destruction is the fat payoff: a lean Jimothy chips a wall, a gorged one
  // levels the block. Steep on purpose so eating visibly buys power.
  BLAST_PER_FAT: 5.5,
  // Trade-offs (Chris, 2026-07-23): fat = slower + too conspicuous to hide.
  // Fraction of waddle speed lost at the fat asymptote. Raised 0.45 → 0.7 on
  // 2026-08-07: eating has to HURT, or there is no decision in it. This is
  // also what makes the lasso (JIM-23) land — a gorged Jimothy is slow enough
  // to rope — and it is step one of JIM-24, where he grows house-sized.
  SPEED_PENALTY_MAX: 0.7,
  // …and how much of a bush's radius he has lost by the time he is maximally
  // fat, so past a point the blob simply doesn't fit.
  //
  // Expressed against the SATURATING factor, not against his width. It used to
  // be `(width - 1) * 2.5`, which was the same thing only while width was
  // bounded — once size grew without limit that formula closed every bush in
  // the game by fatness 30. 2.25 reproduces the old numbers exactly
  // (0.9 x 2.5), so the pressure valve still shuts exactly where it did.
  HIDE_SQUEEZE_MAX: 2.25,
};

// How dynamic bodies meet the voxel world (milestone 22 / JIM-42).
//
// There is nothing for them to collide WITH: static structure gets no physics
// bodies at all (ADR-0003), because a collider per voxel is what makes a
// destructible city unaffordable. So they are clamped against the grid after
// each step, exactly as Jimothy already is — and these are the numbers that
// decide whether that reads as landing or as sticking.
export const PHYSICS = {
  // Fraction of downward speed returned as bounce. Rubble is not a ball: high
  // enough that a chunk hops off the floor once or twice, low enough that a
  // blast does not turn into popcorn.
  GROUND_RESTITUTION: 0.28,
  // Horizontal and spin bleed applied on each contact, so debris skids to a
  // stop instead of sliding across the district forever. Nothing else damps
  // it — a grid clamp has no friction of its own.
  GROUND_FRICTION: 0.72,
  // Below this bounce speed, stop bouncing. Without it a chunk chatters against
  // the floor at ever-smaller amplitudes and never satisfies cannon's sleep
  // test, so 150 pieces of gravel stay awake for their whole lifetime.
  SETTLE_SPEED: 0.55,
  // A SLEEPING body whose floor has dropped further than this has had the
  // ground blasted out from under it and must fall. Nothing else can notice:
  // there are no collision events to lose, because there is no collider. Wide
  // enough to ignore float drift in a resting contact.
  WAKE_GAP: 0.12,
  // Above this much clear air over the terrain, skip the body entirely: it is
  // still falling and there is nothing under it yet. Doubles as a cost cap,
  // because the ground scan is O(height) — a body that gets a long way up would
  // otherwise walk its whole column every step. Generous enough to clear the
  // tallest tower downtown; it is a runaway guard, not a gameplay rule.
  MAX_LAND_HEIGHT: 120,
};

// Dev-panel-only values. Not gameplay — nothing outside `DevTools` reads them,
// and none of it is persisted: fatness is live run state, so a slider that
// survived a reload would be a save file nobody asked for.
export const DEV = {
  // Top of the fatness slider. Fatness itself has no ceiling — it is a running
  // total of everything he has eaten — but `fatFactor` is asymptotic, so past
  // here the curve is visually flat: 200 gives 0.89 against 100's 0.80, and
  // 1000 would give 0.98. Chris asked for a way to add "power/fattness"; this
  // is the range where moving the slider still changes something.
  FATNESS_MAX: 400,
  // Named stops, so "how fat is fat" is one click rather than a guess. The
  // numbers are the curve's own landmarks: SOFTCAP is where bulk reaches half
  // its maximum, and 90 is the fatness milestone 20 measured its 19.7 m shaft
  // at, so it is the one everything else in the docs is comparable to.
  // Named against the world's own landmarks now that size means something
  // (milestone 23): 90 clears a craftsman house, 250 clears a CITY.BLOCK.
  FATNESS_PRESETS: [['Lean', 0], ['Chunky', 25], ['House', 90], ['Block', 250], ['Absurd', 400]],
};

export const SNACKS = {
  SCRAPS_PER_CAN: 4,
  FEASTS_PER_CAN: 1,
  // Deterministic ring scatter (not random) so tests can target snack positions.
  SCATTER_RADIUS: 1.3,
  // Feast lands close to the can — the payday sits in the mess.
  FEAST_OFFSET: [0.6, 0.6],
  BOB_HZ: 2.4,
  NAMES: [
    'PIZZA SLICE', 'OLD BANANA', 'COLD FRIES', 'MYSTERY MEAT', 'CHICKEN BONE',
    'SUSPICIOUS BURRITO', 'WET BREAD', 'HALF A HOT DOG', 'EXPIRED YOGURT',
    'FANCY GARBAGE',
  ],
};

// Chaos raises heat; eating does NOT (fat is score, chaos is heat —
// gameplan 2026-07-23). Sources are wired event→constant in HeatSystem so
// future chaos (scared locals, powerup mischief) is one map entry.
export const HEAT = {
  MAX_TIER: 5,
  // Destruction reaches the army tiers; size gates the earlier giant response.
  TIER_THRESHOLDS: [0, 10, 20, 35, 60, 100],
  DECAY_PER_SECOND_HIDDEN: 2,
  PER_CAN_TIPPED: 5,
  PER_TREE_LOOT: 3,
  PER_SCARED_LOCAL: 3,
  PER_DEMOLITION: 0.4, // per cubic metre: changing voxel detail must not change wanted level
};

// Tuned down after playtest (2026-07-23: "a bit aggressive/hard to deal
// with"). They're a nuisance and a comedy beat, not a threat — the net is the
// only real danger. Fewer of them, slower, shorter stuns, and a shared
// cooldown so a crowd can't chain-stun you.
export const PAPARAZZI = {
  SPEED: 2.6,
  COUNT_TIER1: 1,
  COUNT_TIER2: 3,
  // They stop at photo range and loiter; tier 2+ they flash.
  FLASH_RANGE: 4,
  FLASH_COOLDOWN: 5,
  // No matter how many are around, flashes can't land faster than this.
  GLOBAL_FLASH_COOLDOWN: 2.5,
  MIN_TIER_FLASH: 2,
  STUN_SECONDS: 0.45,
  // A photographer wants the shot, not the raccoon: ordinary eyes, and it loses
  // interest sooner than animal control does (milestone 19).
  VISION_SCALE: 1.0,
  SEARCH_SCALE: 0.7,
};

export const ANIMAL_CONTROL = {
  SPEED: 5,
  NET_RANGE: 1.1,
  MIN_TIER: 3,
  // The one that commits (milestone 19). Better eyes than a photographer and a
  // much longer temper — a paparazzo wants a picture, this one wants the net.
  VISION_SCALE: 1.25,
  SEARCH_SCALE: 1.6,
};

// Pursuer awareness (milestone 19).
//
// Chris: "they just make a beeline for you and never stop - no AI there at
// all." Vision is what makes geometry mean something: alleys to duck down,
// corners to break line of sight behind, and — once milestone 18 lands — tunnels
// where a dead end is a gamble. It is a cone plus a DDA march through the same
// voxel grid the world is made of, so it respects buildings, rubble he has just
// made, and tunnel walls for free.
export const VISION = {
  RANGE: 34,
  NIGHT_RANGE_SCALE: 0.65,
  NOTICE_SECONDS: 0.5, NOTICE_DISTANCE_SECONDS: 0.35,
  NOTICE_DECAY: 0.8, CONTACT_RANGE: 2,
  // Half-angle of the cone: a 120° field of view, which is generous for a
  // human and stops "he was directly behind me" feeling arbitrary.
  HALF_ANGLE: 1.05,
  // Where they look FROM and what they look AT. Both matter: eyes at ground
  // level see through a kerb, and aiming at his feet loses him behind rubble.
  EYE_HEIGHT: 1.45,
  TARGET_HEIGHT: 0.5,
  // Close enough to notice whatever you are facing. Without it you can stand on
  // someone's toes unseen, which reads as a bug rather than as stealth.
  PERIPHERAL_RANGE: 5,
  // A bush cuts sight range HARD rather than toggling a flag, so hiding works
  // because they cannot see you. At 0.1 of 34 m that is 3.4 m — close enough
  // that hiding in a bush animal control is already standing next to does not
  // save you, which is the right answer.
  BUSH_RANGE_SCALE: 0.1,
  // Escalation buys better eyes, not just more bodies. Per tier above 1.
  TIER_RANGE_GAIN: 0.18,
  // Underground it is dark (milestone 18). They follow him down, so the thing
  // that makes a tunnel worth running into is that the same corner buys far
  // more there than it does on the street.
  DARK_RANGE_SCALE: 0.3,
};

// Destruction is loud, and that is what makes the demolition tool a decision
// rather than free chaos: a headbutt through a wall pulls every pursuer in
// earshot toward the NOISE, not toward Jimothy.
export const HEARING = {
  DEMOLITION_BASE: 26,
  DEMOLITION_PER_VOXEL: 0.45,
  DEMOLITION_MAX: 160,
  CAN_TIPPED: 24,
};

// Losing sight of him is the interesting half of a chase.
export const SEARCH = {
  DURATION: 14,
  // How far around the last known position they cast about.
  WANDER_RADIUS: 9, MAX_RADIUS: 16,
  DISPATCH_RADIUS: 12, DISPATCH_MIN_ERROR: 0.5, DISPATCH_VARIANTS: 7,
  ARRIVE_RADIUS: 2,
  REPICK_SECONDS: 2.2,
};

// What they do when they have nothing to chase. They used to stand and stare.
export const PATROL = {
  RADIUS: 42,
  ARRIVE_RADIUS: 3,
  LOITER_SECONDS: 2.5,
  // A beat, not a chase.
  SPEED_SCALE: 0.5,
};

// Shared by all pursuer types, round-robin — deterministic for tests.
// OFFSETS FROM JIMOTHY, not map coordinates (changed 2026-08-07, milestone
// 12). Read as absolute positions these were fine on a 500-unit world and
// meaningless on a 2000-unit one — a pursuer spawning at the origin could not
// reach a player who had walked away, so the run had no lose condition. A ring
// around him keeps the pressure the same wherever he goes, and lets the map
// grow again without revisiting this.
//
// ~25 units is close enough to arrive and far enough to be a chase rather than
// an ambush. Cycled in order rather than chosen at random: pursuer approach has
// to be deterministic under advanceTime.
export const PURSUER_SPAWN_POINTS = [
  [-25, -25], [25, -25], [25, 25], [-25, 25],
  [0, -25], [25, 0], [0, 25], [-25, 0],
];


export const SCORE = {
  // Per-food points live on FOODS; combo behavior lives here.
  TREE_LOOT: 50,
  COMBO_WINDOW_SECONDS: 4,
  COMBO_MAX_MULTIPLIER: 10,
};

export const WORLD = {
  BLOCK_SIZE: 1200,
  // Playable square: Jimothy is clamped here; physics walls sit just outside.
  //
  // 1000 is 4× per side / 16× the area of the old 250, which itself could not
  // grow because the ground was allocated up front for the whole map (JIM-01:
  // 19 s boot, 1007 draw calls, 3.5 GB heap at 5× per side). Milestone 12
  // removed that ceiling — boot and memory now track the STREAM radii, not
  // this number, so raising it further costs nothing at boot. What it does
  // cost is travel time and pursuer pacing, which is what should decide it.
  BOUNDS: 1000,
  GRAVITY: 9.8,
};

// Hiding is the only pressure valve, so bushes have to be reachable from
// anywhere. Four of them clustered near spawn was fine on a 50 m block and
// useless once the city grew to 500 m — spread across the district on the
// block grid, with a couple kept close to spawn and the den.
export const HIDE_SPOTS = {
  RADIUS: 2,
  // Spacing, not extent. The grid used to be written out to a hardcoded ±220 —
  // the old map's edge — so raising WORLD.BOUNDS left bushes covering about 5%
  // of the world and the pressure valve unreachable everywhere else. Derived
  // from BOUNDS, the density stays constant however big the island gets.
  SPACING: 68,
  POSITIONS: (() => {
    const spots = [[-20, -20], [18, 8], [-6, 18], [22, -18]];
    const step = 68;
    const edge = Math.floor(WORLD.BOUNDS / step) * step;
    // Push into the BLOCK INTERIOR, past the road band and the building
    // setback. The old `+4, -4` nudge landed 841 of 844 bushes in the middle
    // of the carriageway (measured 2026-08-07; Chris: "as are bushes"), which
    // is both nonsensical and the worst possible place to hide.
    const inset = 9 + 2.5 + 3;
    for (let x = -edge; x <= edge; x += step) {
      for (let z = -edge; z <= edge; z += step) {
        if (Math.hypot(x, z) < 40) continue; // spawn area already covered
        spots.push([x + inset, z + inset]);
      }
    }
    return spots;
  })(),
};

// Procedural Ballard-ish street grid. Blocks of buildings separated by roads;
// hand-authoring a city this size in voxels is not viable, so the layout is
// generated from a seed and stays diffable as rules rather than voxel data.
export const CITY = {
  BLOCK: 34,        // world units per city block including its road
  ROAD: 9,          // road width
  BUILDING_MARGIN: 2.5,
  MIN_HEIGHT: 6,
  MAX_HEIGHT: 16,
  // Downtown rises toward the middle; the edges stay residential. Derived from
  // the map rather than fixed: at the literal 45 it was tuned for, downtown
  // covered about four blocks of a 2000-unit island — a village green, not a
  // city centre, and the tower archetype effectively never appeared. Same
  // family of bug as the absolute pursuer spawns and the hardcoded hide-spot
  // grid (milestone 12): a constant that quietly meant "the middle of the old
  // map".
  DOWNTOWN_RADIUS: Math.max(45, WORLD.BOUNDS * 0.22),
  SEED: 1337,
};

export const PEDESTRIANS = {
  NAV_WORK:256, SPAWN_PER_FRAME:2,
  MODELS: ['commuter','neighbour','runner','worker','retiree','shopper','student','walker','musician','tourist','pensioner','artist'],
  COUNT: 36,
  RADIUS: 76, NEAR_DISTANCE: 60, NAV_STEP: 2,
  SPAWN_MIN: 12, SPAWN_GAP: 3.5, REFRESH_DISTANCE: 18,
  WALL_MARGIN: 0.5, BODY_PROBE: 0.9, GROUND_SCAN: 0.5, FOOT_CLEARANCE: 0.035,
  MAX_STEP: 1.5, SLOPE_PROBE: .45, MAX_GRADE: .8, GIVE_WAY_RADIUS: 7, OBSTACLE_MARGIN: .2, OBSTACLE_RADIUS_MAX: 1.1,
  ALPHA_CUTOFF: 0.5,
  TURN_SPEED: 8, WALK_RATE: 1, RUN_RATE: 1.4, FADE_TIME: 0.2,
  PAUSE_EVERY: 7, PAUSE_SECONDS: 0.7,
  SPEED: 1.4,
  // Wander target reached → pick a new one.
  ARRIVE_RADIUS: 0.15,
  // Jimothy this close sends them fleeing (and that's chaos → heat).
  SCARE_RADIUS: 5,
  FLEE_SPEED: 4.2,
  FLEE_SECONDS: 3.5,
};

// M51: habits share one bounded crowd and restore normal walking on exit.
export const PED_ACTIVITIES = {
  MAX_ACTIVE:12, START_DELAY:8, START_SPREAD:9, CHECK_INTERVAL:.35, COOLDOWN:12, COOLDOWN_SPREAD:16, RANGE:62,
  BLEND:.65, CLEARANCE:.48, GROUND_TOLERANCE:.22, PATH_SAMPLE:.35, TRAVEL:2.5, STRIDE_SCALE:.65,
  MOON_SPEED:.75, CARRY_SPEED:.65, CHASE_SPEED:2.2, PAIR_SEARCH:12, PAIR_APPROACH:1.8, PAIR_TIMEOUT:9, PAIR_MOUNT:.6, RIDER_LIFT:.22, RIDER_BACK:.28,
  BIRD_SEARCH:34, BIRD_STARTLE:8, BIRD_REFRESH:.35, BIRD_FLEE:2.5,
  PERSON_GAP:.65, DROP_MAX:8, DROP_LIFE:18, DROP_MASS:.3, DROP_SPEED:1.6, DROP_LIFT:1, DROP_SPIN:3,
  PROPS:{phone:{half:[.041,.08,.012],size:.16},coffee:{half:[.05,.092,.05],size:.18}},
  CATALOG:[
    {id:'phone',weight:4,duration:12,mode:'stand',prop:'phone'},
    {id:'coffee',weight:4,duration:11,mode:'stand',prop:'coffee'},
    {id:'bird-chase',weight:1,duration:7,mode:'chase'},
    {id:'cartwheel',weight:1,duration:4,mode:'cartwheel'},
    {id:'meditate',weight:2,duration:12,mode:'seat'},
    {id:'float',weight:1,duration:10,mode:'hover'},
    {id:'moonwalk',weight:1,duration:6,mode:'backwards'},
    {id:'piggyback',weight:1,duration:5,mode:'pair'},
    {id:'air-guitar',weight:1,duration:8,mode:'stand'},
    {id:'robot',weight:1,duration:8,mode:'stand'},
    {id:'stretch',weight:3,duration:8,mode:'stand'},
    {id:'selfie',weight:3,duration:9,mode:'stand',prop:'phone'},
  ],
  POSE:{
    REACH:.96, HAND_FORWARD:.05, GRIP_OFFSET:.04, FINGER_CURL:.8, THUMB_CURL:.4,
    PHONE:[-.14,.87,.07], PHONE_HEAD:[-.08,.035,0], MOUTH_HEAD:[-.01,.035,.075], CUP_RIM:.085, RIDER_GRIP:[.1,-.025,.08], COFFEE_LOW:[-.17,.59,.2], COFFEE_HIGH:[-.08,.84,.17], SIP_HZ:1.65, CUP_TILT:.35,
    SELFIE:[-.12,.84,.38], SELFIE_HZ:1.3, SELFIE_SWAY:.025,
    REST_HAND:[.17,.52,.04], SEAT_DROP:.42, FLOAT_RISE:.73, FLOAT_BOB:.035, FLOAT_HZ:1.8,
    SEAT_FOOT:[.1,.055,.2], SEAT_HAND:[.25,.19,.2], SEAT_POLE:[1,.15,.6],
    CART_PIVOT:.5, HAND_FLOOR:.025, CART_HAND:[.2,1.02,.01], CART_FOOT:[.28,.05,0],
    GUITAR_LEFT:[.34,.72,.2], GUITAR_RIGHT:[-.04,.58,.2], STRUM_HZ:14, STRUM_RANGE:.065,
    ROBOT_HZ:2.4, ROBOT_HAND:[.27,.67,.16], ROBOT_RANGE:.15,
    STRETCH_HAND:[.14,1.03,0], STRETCH_HZ:1.2, STRETCH_SWAY:.05,
    CHASE_HAND:[.35,.87,.18], CHASE_HZ:9, CHASE_WAVE:.09, CHASE_LOOK:-.3,
    RIDER_FOOT:[.23,.12,.1], RIDER_HAND:[.16,.7,.35], CARRIER_HAND:[.23,.45,-.18],
    MOON_LIFT:.055, MOON_HZ:5, HEAD_NOD:.045, HEAD_HZ:2,
  },
};

export const CAMERA = {
  FOV: 60,
  // 0.5, not 0.1: the far plane has to reach the far side of a 2 km island, and
  // a 0.1–2400 depth range is where z-fighting starts. The camera never gets
  // closer than a couple of metres to anything.
  NEAR: 0.5,
  FAR: 2400,
  FOLLOW_DISTANCE: 7,
  FOLLOW_HEIGHT: 3.5,
  LOOK_HEIGHT: 0.8,
  FOLLOW_LERP: 4,
  BLAST_SHAKE_TIME: .55,
  BLAST_SHAKE_ANGLE: .018,
  BLAST_SHAKE_FREQUENCY: 48,
  // Orbit mode (pointer locked): mouse-driven yaw/pitch around Jimothy.
  MOUSE_SENS: 0.0025,
  PITCH_MIN: 0.05,
  GIANT_PITCH_MIN: -.9,
  GIANT_AIM_BLEND: .35,
  GIANT_AIM_SHOULDER: .65,
  BODY_FADE_RATIO: 1.1,
  // Raised for aiming (milestone 20). The aim is measured from the resting
  // pitch of 0.47, so 1.5 leaves about 59 degrees of downward travel — enough
  // that "tilt down past halfway" is the dig, with room either side.
  PITCH_MAX: 1.5,
  // --- boom collision (JIM-41) ---
  // The camera had none at all, and a 7 m boom does not fit in a 3.6 x 2.9 m
  // sewer under any heading: measured with the eye INSIDE solid rock and 40% of
  // the boom buried, which culls the tunnel away and leaves unrelated chunk
  // faces — Chris's "underground it turns into blocks".
  //
  // How far short of the surface the eye stops. Comfortably over NEAR (0.5), or
  // the wall it stopped at clips open again.
  COLLIDE_MARGIN: 0.7,
  // …and how close it may ever get. A pipe this tight means near-first-person,
  // which is correct; it must not end up inside his head, so he fades instead.
  COLLIDE_MIN: 1.0,
  // Under this, he is between you and everything you are trying to see.
  FADE_DISTANCE: 3.2,
  // --- girth (milestone 23) ---
  // The boom grows with him, or a city-block-wide Jimothy fills the screen and
  // you cannot see the street. Added to the base distance PER METRE of body
  // radius over lean, so a lean Jimothy's camera is untouched — the same
  // neutrality rule the aim follows.
  //
  // 2.5 keeps him under about 20 degrees of the 60 degree FOV at every size:
  // at fatness 250 he is 18 m in radius, which puts the eye 50 m back.
  GIRTH_PULLBACK: 2.5,
  // …and it has to rise as well as retreat, or the camera ends up looking at
  // the side of a ten-metre-tall animal from its ankle.
  GIRTH_LIFT: 1.2,
  // What the camera aims at, per metre of radius. He is a wide low blob, so
  // this is well under half.
  GIRTH_LOOK: 0.45,
  // How much of him the collision clamp may sacrifice. `COLLIDE_MIN` of 1 m is
  // *inside* a giant, so without this a wall behind him would put the camera in
  // his ribcage.
  GIRTH_COLLIDE_MIN: 1.6,
};

// The aiming marker (milestone 20, rebuilt by milestone 21/JIM-39).
export const RETICLE = {
  // How far the marker LOOKS, which is deliberately much further than a
  // headbutt REACHES. Chris asked for it to highlight whatever it is on, and a
  // marker that vanishes past 3 m highlights nothing; the colour carries
  // whether the swing can actually get there.
  LOOK_RANGE: 40,
  // Lifted off the surface it landed on, or it z-fights with the face it marks.
  SURFACE_OFFSET: 0.05,
  OPACITY: 0.85,
  // Out of reach: still legible, obviously not a promise.
  MISS_OPACITY: 0.4,
};

// Free camera (milestone 17). The island is 2 km across and, until this
// existed, the only way to look at it was to walk. Everything the milestone
// adds after this — coastline, hills, districts — is judged by eye.
export const FLY = {
  // Base cruise, before the multiplier. About 5x a scurry: fast enough to
  // cross a district, slow enough to look at one.
  SPEED: 30,
  // Held-key modifiers on top of the multiplier, so you can dart and creep
  // without stepping the multiplier up and down.
  BOOST: 5,      // SCURRY (shift)
  PRECISE: 0.15, // FLY_SLOW (ctrl)
  // Stepped by -/= . Doubling per press covers 0.25x to 32x in nine presses,
  // which is the whole useful range from "read a doorway" to "cross the map".
  MULT_STEP: 2,
  MULT_MIN: 0.25,
  MULT_MAX: 32,
  MOUSE_SENS: 0.0022,
  // Just short of straight up/down: at exactly 90 the yaw axis degenerates and
  // the view rolls as you pass through it.
  PITCH_LIMIT: 1.5,
};

// The island you can see but have not walked into yet.
//
// The voxel world only extends `STREAM.LOAD_RADIUS` — about 106 m — and fog at
// 40–200 m was there to hide the fact that it simply stops. Which it did, by
// greying out everything you COULD see as well: at the edge of the loaded world
// the fog was already 41% opaque, so the answer to "why can't I see anything"
// was "because there is nothing out there, and the fog is apologising for it".
//
// So there is something out there now: one mesh, built once from the same baked
// height field the voxels come from, covering the whole island at HORIZON.STEP
// resolution. It costs one draw call and no streaming, and it is what makes the
// fly camera worth having — flying up used to reveal a 200 m disc of fog.
export const HORIZON = {
  // Metres per quad. 12 over a 2 km island is ~28k quads in one buffer: far
  // cheaper than one more ring of voxel columns, and it covers everything
  // rather than one more 35 m step.
  STEP: 12,
  // Dropped slightly, so wherever the real voxel ground exists it wins the
  // depth test rather than fighting with it. Half a metre at 100 m is invisible.
  DROP: 0.55,
  // Colours. Deliberately a shade duller than the voxel materials: distance
  // reads as distance, and it stops the seam at the streaming boundary being a
  // brightness step.
  LAND: 0x54764a,
  ROAD: 0x7d7c76,
  SAND: 0xa89272,
  DEEP: 0x2c4a5c,
};

export const COLORS = {
  SKY: 0xffd9a0,          // golden hour
  FOG: 0xf2c98c,
  // Far enough to see the next district. The old 40–200 was tuned for a 250 m
  // world and never revisited when the map became 2 km (milestone 12 raised
  // BOUNDS; nobody raised this).
  FOG_NEAR: 220,
  FOG_FAR: 1500,
  AMBIENT: 0x8a7a9a,
  SUN: 0xffe3b3,
  GROUND: 0x5d8a4a,
  SEA: 0x2f6f8f,
  WALL: 0x8d8578,
  // Where the headbutt will land (milestone 20). Two colours, because "will
  // this dig?" is the one thing the player cannot infer from the aim alone.
  RETICLE: 0xffe9a8,
  RETICLE_DIG: 0xff7a3c,
  // …and a third, because the marker now lands on whatever you are LOOKING at
  // (JIM-39), which is often further than a headbutt can reach. Highlighting a
  // wall across the street is useful; implying you can hit it is a lie.
  RETICLE_MISS: 0x7d8794,
  SNACK: 0xff6f4f,
  FEAST: 0xffc24f,
  BUSH: 0x2e5d34,
  PAPARAZZO: 0xd8d3c8,
  ANIMAL_CONTROL: 0x8a6d3b,
  NET: 0x555555,
  PLACEHOLDER_JIMOTHY: 0x6f6a72,
  PLACEHOLDER_TRASH_CAN: 0x3f6f5f,
};

export const ASSET_PATHS = {
  // Blender-prepped: decimated, texture-downscaled, pre-split into named
  // head/body/tail/leg parts (tools/prep_jimothy.py). 4.4 MB vs the 39 MB raw
  // Meshy export it was built from.
  JIMOTHY_MODEL: '/assets/models/jimothy-rig.glb',
  // ONE continuous mesh on an armature (ADR-0004, tools/rig_jimothy.py). The
  // seven-piece model above cannot deform across a joint, so every animation
  // shows a seam; this one stretches. Selected by RIG.SKINNED.
  JIMOTHY_SKINNED: '/assets/models/jimothy-skinned.glb',
};

// Runtime model splitter (milestone 06): one full Meshy GLB cut into
// head/body/tail at load time — no Blender, no rigging.
export const RIG = {
  CONTACT_LEAF:12,
  TORSO_WEIGHT: 0.8,
  ANATOMY_GROWTH: .45,
  JIGGLE_MAX: .06,
  JIGGLE_HEIGHT: .6,
  JIGGLE_LENGTH: .3,
  GIANT_JIGGLE_HZ: 2.4,
  GIANT_TUCK: .3,
  SOCKET_BLEND_IN: .15,
  SOCKET_BLEND_OUT: .6,
  GROWTH_ANCHORS: {
    head:[0,.08,1],tail:[0,.15,-1],
    leg_FL:[-.1,-1,.1],leg_FR:[.1,-1,.1],leg_RL:[-.1,-1,-.1],leg_RR:[.1,-1,-.1],
  },
  // One continuous mesh on an armature instead of seven separate solids
  // (ADR-0004). The split model could not deform across a joint, so every
  // animation showed a seam and each fix capped how far a move was allowed to
  // travel — which was capping the comedy the game exists for (JIM-21).
  // tools/prep_jimothy.py and the split load path stay until this has a
  // playtest behind it, so the fallback is one line away.
  SKINNED: true,
  // Overall nose-to-tail length in world units after normalization.
  TARGET_LENGTH: 1.7,
  // Cut positions as fractions of body length from the nose / from the rear.
  NECK_FRAC: 0.3,
  TAIL_FRAC: 0.12,
  // Flip if the export faces -z instead of +z.
  NOSE_POSITIVE_Z: 1,
};

// Destructible voxel city (ADR-0003). Chunked so one draw call covers a whole
// 16³ block of voxels — a mesh per voxel is ~19k draw calls and does not run.
export const VOXEL = {
  // Milestone 25: finer breakaway, with dimensions authored in metres.
  SIZE: 0.22,
  // Keep the original 35.2 m column coverage as cells shrink; otherwise
  // nearby bins and streets disappear from the load radius (milestone 25).
  CHUNK_XZ: 160,
  CHUNK_Y: 32,
  // A skinny raccoon is not a wrecking ball. Base radius barely scratches
  // paint — real demolition is earned by eating (FATNESS.BLAST_PER_FAT).
  BLAST_RADIUS: 0.75,
  // How far PAST the surface it hits the blast centre sits, as a fraction of
  // its own radius (playtest 2026-08-08). The sphere used to be parked at a
  // fixed standoff and never asked what was there, so the crater landed 1.87 m
  // ahead however close the thing you were aiming at — Chris: "it only works
  // direct in front of you". Now it lands ON what the reticle is on, and this
  // is how deep a bite it takes: 0.5 buries half the sphere, which is a crater
  // rather than a graze. At a steep aim with a big blast it reproduces the old
  // standoff to within 2 %, so milestone 20's measured shaft depths survive.
  BLAST_BITE: 0.5,
  // Retired by milestone 17. Ground was two stored layers — diggable dirt over
  // indestructible bedrock — which is a SURFACE, not a volume. It is now a
  // height field with `TERRAIN.SKIN` stored layers over implicit rock, and
  // bedrock sits `TERRAIN.DEPTH` below whatever the surface is here.
  GROUND_LAYERS: 2,
  // Material ids → colour. 0 is always air.
  MATERIALS: {
    1: { name: 'clapboard', color: 0xd8d2c4 },
    2: { name: 'shingle', color: 0x6b5f57 },
    3: { name: 'brick', color: 0x9b5b45 },
    4: { name: 'glass', color: 0x86b6c4 },
    5: { name: 'moss', color: 0x4f7a43 },
    6: { name: 'concrete', color: 0x9a9a94 },
    7: { name: 'bedrock', color: 0x6a6258 },
    // Strata (milestone 17). A tunnel has to read as going SOMEWHERE, which it
    // only does if the walls change on the way down.
    8: { name: 'topsoil', color: 0x6b4b30 },
    9: { name: 'clay', color: 0xa06a3c },
    10: { name: 'rock', color: 0x7d7b76 },
    11: { name: 'deeprock', color: 0x4c4a4f },
    12: { name: 'dry sand', color: 0xdfc995 },
    26: { name: 'landmark red', color: 0xd65340 },
    27: { name: 'landmark gold', color: 0xe5bb44 },
    28: { name: 'landmark plum', color: 0x965377 },
    29: { name: 'landmark teal', color: 0x49918b },
    30: { name: 'rusted iron', color: 0x85533d },
    31: { name: 'dark steel', color: 0x343b42 },
    32: { name: 'warm white', color: 0xece9d9 },
    33: { name: 'damp sewer brick', color: 0x665047 },
    34: { name: 'oxidised pipe', color: 0x426c66 },
    35: { name: 'sewer mortar', color: 0x8b8272 },
    36: { name: 'sewer paving', color: 0x6f736d },
    25: { name: 'wet sand', color: 0x9e9276 },
    13: { name: 'ivory trim', color: 0xf2e7ce },
    14: { name: 'sage siding', color: 0x829986 },
    15: { name: 'blue siding', color: 0x688a9c },
    16: { name: 'ochre siding', color: 0xb5986c },
    17: { name: 'cedar', color: 0x926749 },
    18: { name: 'asphalt', color: 0x414a50 },
    19: { name: 'slate roof', color: 0x414f59 },
    20: { name: 'terracotta', color: 0x9d604c },
    21: { name: 'painted door', color: 0x3a5960 },
    22: { name: 'paving slab', color: 0xb7b0a1 },
    23: { name: 'paving slab variation', color: 0xa9a496 },
    24: { name: 'kerbstone', color: 0xd0cbbb },
  },
  // Bedrock can't be destroyed. Without a floor, a roll digs straight through
  // every ground layer and leaves Jimothy stranded metres below grade in a
  // pit he can't climb (playtest 2026-07-23).
  BEDROCK: 7,
  // "Explicitly empty", as distinct from a 0 that means "nothing stored here".
  // Ground is IMPLICIT below the rendered skin (milestone 17): an unstored
  // voxel defers to the height field, so a dug hole written as plain 0 would
  // heal the instant anything queried it. 255 says the player took this one.
  EMPTY: 255,
};

// The island's third dimension (milestone 17).
//
// THE decision in this milestone: ground is IMPLICIT.
//
//     solid(x, y, z)  =  y < surfaceHeight(x, z)   unless an edit says otherwise
//
// Only a constant-thickness skin at the surface is stored as real voxels — that
// is what the mesher draws, and it costs exactly what the old two flat layers
// cost. Everything below it is answered by the height field, and materialises
// only where a blast exposes it. So DEPTH is free: 20 m and 200 m have the same
// boot cost and the same memory, and memory tracks how much has been DUG rather
// than how deep the world is. Built eagerly instead, 20 m at VOXEL.SIZE 0.55 is
// ~36 layers — an 18x rise in ground voxels, which would undo milestone 12.
export const TERRAIN = {
  // Sea level, and the origin of every height in this file. Grade is no longer
  // a constant: `y = 0` now means the WATERLINE, and the ground under any given
  // spot is whatever the height field says.
  SEA_LEVEL: 0,
  // World units per height-field cell. Matches the masterplan's class grid, so
  // the two agree cell-for-cell about where the coast is.
  CELL: 2,
  // How far the ground is diggable below its own surface before bedrock. The
  // number milestone 17 exists to make free — nothing iterates it.
  DEPTH: 30,
  // Voxel layers of real, stored ground kept under the surface. This is the
  // whole materialised cost of the terrain, and it does not move with DEPTH.
  // Two is what the flat world had; four gives a crater walls to show.
  SKIN: 4,
  // Strata boundaries in metres below the surface. Absolute rather than a
  // fraction of DEPTH, so what a shallow hole looks like never changes when
  // DEPTH does — which is the whole point of the AC that measures both.
  TOPSOIL_DEPTH: 1.1,
  CLAY_DEPTH: 4.5,
  ROCK_DEPTH: 12,
  // Height of dry land at the waterline's inland end, before hills.
  LAND_GRADE: 2.4,
  // How deep the sea gets, and over what distance the beach reaches it. 30 m of
  // run for a 10 m drop is about 18 degrees — a slope you can walk back up,
  // so the swimming controller can return smoothly to walking (M31).
  SEABED_DEPTH: 10,
  SHORE_RUN: 34,
  // How quickly a hill reaches full height as you move inland. Short on
  // purpose: this exists only so a hill does not step discontinuously out of
  // the beach ramp. Long values look like the safe choice and are not — at 150
  // it flattened every summit the plan placed near water, taking Trash Panda
  // Heights (the island's landmark climb) from 48 m to 8. The seaward face of a
  // coastal hill is a BLUFF, which is both what Magnolia and Queen Anne
  // actually are and fine for the player, because the landward approaches stay
  // walkable — which is what the hill spec asserts.
  HILL_COAST_RUN: 25,
  // Districts built on fill are FLAT, exactly as the real downtown and port
  // are. That gives the dense area a calm floor and puts the drama in the
  // residential hills (Chris: hills tuned for fun, not realism).
  FLAT_DISTRICTS: ['trashattan', 'sotrash'],
  // …and the run over which a flat district relaxes back into the hills around
  // it. Long, or downtown ends in a cliff instead of a climb.
  FLATTEN_RUN: 120,
  // A bridge deck is RAISED, so water still reads as water underneath it — two
  // 70 m causeways at grade filled a third of Lake Onion. Raised means approach
  // ramps: APPROACH is how far onto the land the corridor runs while it lerps
  // down to meet the ground, and it has to be long enough that the grade stays
  // under Jimothy's CLIMB_HEIGHT of 2.6.
  BRIDGE_DECK: 7,
  BRIDGE_APPROACH: 26,
  // Deck WIDTH. The plan's per-bridge `span` is the crossing LENGTH, which is
  // what the word means and what its numbers are (70 m at a canal that is 84 m
  // wide) — read as a width it built 70 m ribbons that filled a third of Lake
  // Onion. The length is measured off the land mask instead, which is the only
  // way to be sure a deck actually reaches both shores.
  BRIDGE_WIDTH: 16,
  // A crossing longer than this is not a bridge, it is a mistake in the plan.
  BRIDGE_MAX: 280,
  // Ground must be at least this far above the waterline to carry a road or a
  // building. Keeps the city off its own tideline without a second mask.
  BUILD_MIN_HEIGHT: 1.2,
};

// The underground (milestone 18).
//
// The island is 2 × 2 km of surface, and underneath it is the same 2 × 2 km for
// almost nothing, because milestone 17's ground is implicit: nothing is stored
// until it is disturbed. Carving a sewer is writing voxels exactly as building a
// house is, so a second layer of the game costs the price of authoring it.
//
// It also solves a real problem: a 2000-unit map takes 3m 19s to cross at a
// sprint. Sewers under the arterials are a SHORTCUT NETWORK — one that costs
// visibility and puts you somewhere unexpected, rather than teleporting, which
// is why fast travel was cut (milestone 13).
export const SEWER = {
  // Metres from the street surface down to the tunnel floor. Deep enough that
  // a building's foundation never punches into it, shallow enough that the
  // stairwell down is not an expedition.
  DEPTH: 8.2,
  // Bore. Wide enough for a fat Jimothy and an animal controller at once,
  // low enough to feel like a pipe rather than a corridor.
  WIDTH: 5.8,
  HEIGHT: 4.3,
  MAINTENANCE_WIDTH: 3.6, WALL_HEIGHT: 2.65, ARCH_RISE: 1.65,
  NARROW_NEAR_EXIT: 4, SECTION_LENGTH: 46, GUTTER_WIDTH: .9, GUTTER_DEPTH: .22,
  ROOM_OFFSET: 24, ROOM_RADIUS: [6.2,7.2,5.8], ROOM_HEIGHT: [5.1,5.8,4.4],
  ROOM_KINDS: ['pump','overflow','maintenance'], ROOM_BLEND: 2,
  FIXTURE_RADIUS: 65, FIXTURE_LIMIT: 28, FIXTURE_REFRESH: 8,
  LOCAL_LIGHT_LIMIT: 4, LOCAL_LIGHT_INTENSITY: 32, LOCAL_LIGHT_RANGE: 17,
  LOCAL_LIGHT_COLORS: [0xffd39a,0xa3d9c4,0xffd39a],
  WATER_COLOR: 0x285b50, WATER_OPACITY: .72, WATER_OFFSET: .045, WATER_SPEED: .6,
  FIXTURE_MASS: 45, FIXTURE_KICK: 3, FIXTURE_LIFT: 1.8, FIXTURE_SPIN: 1.2,
  SIGN_COLOR: 0x21483d, SIGN_TEXT: 0xf2e8be, SIGN_WIDTH: 1.45, SIGN_HEIGHT: .58,
  PIPE_RADIUS: .16, PIPE_HEIGHT: 2.25, PIPE_MATERIAL: 34,
  WALKWAY_MATERIAL: 36, ROOM_MATERIAL: [33,33,6], BRICK_MATERIAL: 33, MORTAR_MATERIAL: 35,
  BRICK_ROWS: 3, BRICK_LENGTH: 5,
  ROOM_PROP_INSET: .56, SIGN_Y: 2.45,
  GUTTER_TILE: 2, WATER_RADIUS: 45, WATER_LIMIT: 1000,
  LINING_CELLS: 2, ROOF_THICKNESS: .88, BASIN_SHARE: .42, BASIN_DEPTH: .66,
  ESCAPE_BUDGET: 100000, WAVE_FREQUENCY: 7, RIPPLE_REACH: 3,
  RIPPLE_FREQUENCY: 9,
  // Below this length a run of centreline is a puddle, not a tunnel, and gets
  // no sewer at all — an unreachable pocket in the rock is worse than nothing.
  MIN_RUN: 60,
  // How far apart the stairwells are along a run. Every component gets at least
  // one whatever this says: that is the "no dead space you cannot get out of"
  // guarantee, and it is enforced at bake time rather than hoped for.
  ENTRANCE_SPACING: 190,
  // The stairwell is a square shaft with a step spiralling down its wall. Steps
  // are ONE voxel high, so walking up is the auto-climb doing its ordinary job
  // rather than a special case — a vertical ladder would need one.
  SHAFT: 13,
  // Underground light. The surface's golden-hour sun is useless down here, and
  // the milestone asks for lit enough to move through and dark enough to be
  // unpleasant.
  LIGHT_COLOR: 0xffd9a8,
  LIGHT_INTENSITY: 30,
  LIGHT_RANGE: 16,
  FOG_COLOR: 0x0a0c10,
  FOG_NEAR: 3,
  FOG_FAR: 30,
  // How far below the surface counts as underground, for the light, the fog and
  // the pursuit.
  BELOW: 2.5,
};

// Treasure you can't do anything with (milestone 18).
//
// Chris: "treasure that you can't do anything with". The joke IS the
// uselessness — they score nothing and buy nothing, and the moment anyone makes
// them buy something they stop being funny. They pay off in the photo book
// (JIM-31), and they give digging a reason without giving it a reward.
export const TREASURE = {
  SPACING: 26,      // metres between candidate burial spots
  SHARE: 0.16,      // …of which this fraction actually holds something
  MIN_DEPTH: 1.6,
  MAX_DEPTH: 9,     // deep enough to reach the sewers, so some lie on the floor
  MIN_GROUND: 1.5,  // not at sea, not on the tideline
  RADIUS: 0.22,
  REACH: 1.4,
  COLOR: 0xffcf6a,
  NAMES: [
    'A HUBCAP', "SOMEONE'S RETAINER", 'A TAMAGOTCHI', 'A CURSED FURBY',
    'A BRIEFCASE THAT WILL NOT OPEN', 'ONE ROLLERBLADE', 'A BAG OF OLD KEYS',
    'A TROPHY FOR PARTICIPATION', 'A VERY OLD SANDWICH', 'HALF A GARDEN GNOME',
    'A PHONE WITH NO BATTERY', 'A JAR OF TEETH (DENTAL, PROBABLY)',
  ],
};

// The crab people (milestone 18).
//
// An underground faction with their own territory, going about their business
// and reacting badly to a raccoon. NOT a heat tier — a separate ecology that
// does not care about your wanted level, which is what makes going down there a
// change of situation rather than a safer version of the surface.
export const CRABS = {
  COUNT: 12,        // articulated nearby actors, shared geometry
  SPEED: 1.7,
  SCUTTLE_SPEED: 4.4,
  // Jimothy this close and they scatter. They are not a threat and not a score
  // — play it straight and let the absurdity do the work.
  ALARM_RADIUS: 7,
  SCUTTLE_SECONDS: 3,
  SIZE: 0.34,
  COLOR: 0xc9502f,
  MODELS: ['worker','scavenger','elder'], RADIUS: 44, SPAWN_GAP: 3,
  WANDER_DISTANCE: 9, REPATH: 1.8, GROUND_SCAN: .8, WALL_SCAN: .65,
  FOOT_LIFT: .07, FOOT_STRIDE: .22, STEP_HZ: 3.6, FOOT_CLEARANCE: .035,
  TURN_RESPONSE: 10, CLAW_WAVE: .20, PINCER_WAVE: .28,
  FALL_GRAVITY: 18, FLOOR_STEP: .45, KNOCK_SPEED: 4, KNOCK_SECONDS: .65,
};

// Chunk streaming (milestone 12, JIM-01). The world is generated around the
// player and unloaded behind him, so boot cost and memory stop scaling with
// map size.
export const STREAM = {
  // Radii in CHUNK COLUMNS, not metres. A column is CHUNK_XZ voxels square.
  // Load must be comfortably beyond the camera's far view or buildings pop in
  // where the player can see them.
  LOAD_RADIUS: 3,
  // Strictly greater than LOAD_RADIUS: without hysteresis, standing on a
  // boundary thrashes the same column in and out every frame.
  UNLOAD_RADIUS: 5,
  // The fly camera loads a wider disc, because 3 columns is 105 m and the
  // island is 2 km — "fly over it and recognise it as a city with a coast and
  // hills" is not a thing you can do through a 210 m porthole.
  //
  // 5 is 385 m across: 184 resident columns and ~840 MB of heap, measured
  // headless (output/iterate/fly-radius.mjs). 6 reaches 233 columns and gets no
  // cheaper per column. What actually caps this is that a flat chunk of ground
  // emits 4096 separate quads where one would do — there is no greedy meshing,
  // so a ground chunk costs ~1 MB of geometry. Fix that and this can double.
  // Tunable in DevTools, because how much of the island you want in frame is a
  // judgement, not a constant.
  FLY_LOAD_RADIUS: 5,
  // Generating several columns in one frame hitches. A visible pop at the
  // horizon is a better trade than a stutter under the player's feet.
  COLUMNS_PER_FRAME: 1,
  // The fly camera outruns that budget — it crosses a column every fraction of
  // a second — and a hitch while inspecting the map costs nothing, because
  // nobody is trying to land a hop.
  FLY_COLUMNS_PER_FRAME: 6,
  // The fixed vertical band CY_MIN/CY_MAX is gone (milestone 17). It was right
  // for a flat world and wrong the moment the ground ran from a seabed at -10 m
  // to a hilltop at 50 m, or the player dug 20 m down. VoxelWorld tracks which
  // chunks a column ACTUALLY has instead, which is both correct and cheaper
  // than widening the band would have been.
};

export const DEBRIS = {
  MAX: 150,           // hard cap; oldest recycles
  PER_BLAST: 14,
  LIFETIME: 6,
  IMPULSE: 4.5,
  MASS: 0.4,
};

export const LEGS = {
  // M11/JIM-22: stride distance follows actual travel; feet remain world
  // contacts during stance even when the player turns or walks into a wall.
  STRIDE: 0.36, MIN_SWING: 0.025, MAX_SWING: 0.14, PLANT_TRIGGER: 0.12,
  MIN_SWING_FRAMES: 2,
  PAW_CLEARANCE: 0.012, PAW_BAND: 0.045, PAW_SAMPLES: 24,
  SPRAWL: 0.018, CROUCH: 0.05, MAX_DROP: 0.38, KNEE_SPLAY: .7, PAW_REACH_MARGIN: .9,
  BODY_RESPONSE: 18, BODY_SPEED: 5, VELOCITY_RESPONSE: 22,
  RESET_DISTANCE: 3, GROUND_SCAN: 0.55, MIN_SPEED: 0.05,
  MAX_REACH: 0.995, SOLE_PASSES: 5,
  RECOVER_SECONDS: 0.16,
  TUBE_RADIUS: 0.09,
  FOOT_RADIUS: 0.11,
  // Hip anchor offsets in bodySlot space [x, y, z] — mirrored for left/right.
  HIP_X: 0.32,
  HIP_Y: 0.35,
  HIP_Z: 0.38,
  // Step when the planted foot drifts this far from its home under the hip.
  STEP_THRESHOLD: 0.45,
  STEP_SECONDS: 0.13,
  STEP_LIFT: 0.075,
  // Feet lead the body by velocity × this, so the trot reads as walking.
  STRIDE_LEAD: 0.12,
  // Real-leg swing mode: crude diagonal-pair flailing, on purpose.
  SWING_HZ: 1.4,
  SWING_AMPLITUDE: 0.75,
  SWING_MIN: 0.06,
};

export const JIMOTHY_IDLE = {
  WAIT: 3.2, GAP: 3.8, LOOK_SECONDS: 1.9, SCRATCH_SECONDS: 2.2,
  FADE_SECONDS: 0.3, MIN_SPEED: 0.08,
  BREATH_HZ: 0.45, BREATH: 0.008, HEAD_PITCH: 0.045,
  LOOK_YAW: 0.22, LOOK_PITCH: 0.12, TAIL_HZ: 0.65, TAIL_ANGLE: 0.08,
  SCRATCH_HZ: 5.5, SCRATCH_TRAVEL: 0.035, SCRATCH_SIDE: 0.24,
  SCRATCH_DROP: 0.34, SCRATCH_BACK: -0.10, HEAD_SCRATCH: 0.10,
};

// Dimensions in metres keep architecture independent of destruction resolution.
export const BUILDINGS = {
  DEN_SQUASH: .62,
  HEIGHTS: { craftsman: [2.9, 5.8], shed: [2.4, 3.1], apartment: [8.4, 16.8], shop: [3.6, 5.2], warehouse: [5.4, 8.0], tower: [22, 42] },
  LOT_WIDTH: { craftsman: 11.8, shed: 6.4, apartment: 22, shop: 16, warehouse: 32, tower: 23 },
  LOT_JITTER: [0.72, 1.22],
  TERRACE_BLEND: 3.0,
  MAX_LOT_SLOPE: { craftsman: 8, shed: 8, apartment: 12, shop: 8, warehouse: 8, tower: 8 },
  STYLE_COUNT: 3, PALETTE: [1, 14, 15, 16, 17], ROOFS: [19, 2, 20],
  STOREY: 2.9, FOOTING: 0.44, DOOR_WIDTH: 1.54, DOOR_HEIGHT: 2.2,
  WINDOW_SILL: 1.05, WINDOW_HEIGHT: 1.25, WINDOW_WIDTH: 1.3, WINDOW_SPACING: 2.7,
  PORCH_DEPTH: 1.65, PORCH_WIDTH: 3.8, PORCH_HEIGHT: 2.55,
  ROOF_PITCH: [0.40, 0.56, 0.32], ROOF_OVERHANG: 0.44, TRIM: 0.22,
  CHIMNEY_WIDTH: 0.66, CHIMNEY_RISE: 1.15,
};
export const ATMOSPHERE = {
  SKY_TOP: 0x7bafc9, SKY_HORIZON: 0xffd9a0, CLOUD: 0xffefda,
  SKY_RADIUS: 1800, CLOUD_SPEED: 0.003, CLOUD_SCALE: 5.0, SUN_DIRECTION: [-0.7, 0.36, 0.6],
  WATER_DEEP: 0x164859, WATER_SHALLOW: 0x529d9e, WATER_HIGHLIGHT: 0xffdfb1,
  WAVE_SPEED: 0.7, WAVE_SCALE: 0.22, WAVE_HEIGHT: 0.14, WATER_ROUGHNESS: 0.27,
  HEMISPHERE: 0.7, GROUND_LIGHT: 0x786c52,
};

// Milestones 24/27: the same dimensions drive appearance, break pieces and
// collection eligibility, so a five-metre pole cannot masquerade as a pebble.
export const STREET = {
  BATCH_CAPACITY:256, MARK_REFRESH:.12,
  BUSH_MASS: 10, BUSH_HEIGHT: .7, BUSH_BURIED: .45,
  VEHICLES: ['sedan','hatchback-sports','suv','van','taxi','delivery'],
  ROUGHNESS: .8, LEAF_THRESHOLD: 1,
  RADIUS: 100, REFRESH: 24, GRID: 4, ROAD_CLEARANCE: 1.3,
  PROP_COUNT: 48, CAR_COUNT: 8, PARKED_COUNT: 10, PROP_GAP: 7, CAR_GAP: 12,
  SPEED: 6, TURN_RATE: 4, ARRIVE: 0.15, STOP_GAP: 6,
  SPAWN_MIN: 13, GROUND_SCAN: 2, CLEARANCE: 0.02, MAX_SLOPE: 1.5,
  BONK_SPEED: 1.3, IMPULSE: 4, LIFT: 2.5, SPIN: 1.2,
  FRAGMENT_LIMIT: 72, FRAGMENT_LIFE: 24, BREAK_RADIUS: 0.5,
  DAMPING: 0.35, SLEEP_SPEED: 0.25, SLEEP_TIME: 0.8,
  // Box parts: width,height,depth, x,y,z, colour, break group.
  TYPES: {
    signal: {mass:18,size:4.5,parts:[
      [.42,.22,.42,0,.11,0,0x454c4f,0],[.16,3.5,.16,0,1.9,0,0x505b60,0],
      [.46,1.35,.34,0,3.8,.06,0x252e32,1],
      [.28,.28,.035,0,4.23,.25,0xff3020,2],[.28,.28,.035,0,3.8,.25,0xffbd22,2],
      [.28,.28,.035,0,3.37,.25,0x28ef83,2]]},
    lamp: {mass:16, size:5.5, parts:[
      [.4,.3,.4,0,.15,0,0x4a5154,0], [.18,2.4,.18,0,1.5,0,0x586469,0],
      [.18,2.7,.18,0,4.05,0,0x586469,1], [1.5,.15,.18,.65,5.3,0,0x586469,1],
      [.7,.16,.38,1.1,5.15,0,0xffe3a1,2]]},
    hydrant: {mass:12,size:1.1,parts:[
      [.36,.8,.36,0,.4,0,0xb94c36,0],[.48,.15,.48,0,.86,0,0xb94c36,1],
      [.68,.2,.23,0,.6,0,0xc29e58,1],[.45,.1,.45,0,.05,0,0x444b49,0]]},
    bench: {mass:24,size:2,parts:[
      [1.9,.13,.5,0,.5,0,0x976643,0],[1.9,.36,.13,0,.86,-.25,0x976643,1],
      [.12,.5,.55,-.7,.25,0,0x3f4d52,2],[.12,.5,.55,.7,.25,0,0x3f4d52,2]]},
    mailbox: {mass:14,size:1.4,parts:[
      [.62,.68,.55,0,1.04,0,0x335b70,0],[.17,.75,.17,0,.38,0,0x485057,1],
      [.43,.07,.03,0,1.22,.29,0x182b34,0],[.22,.13,.03,0,.9,.29,0xe9ddd0,0]]},
    tree: {mass:45,size:4.8,parts:[
      [.4,2.6,.4,0,1.3,0,0x735640,0],[.3,1.2,.3,.3,2.7,0,0x735640,1],
      [2,1.1,1.7,0,3.1,0,0x527746,1],[1.5,1.2,1.4,.5,4,0,0x638748,2],
      [1.2,.9,1.5,-.8,3.6,.2,0x819b50,2]]},
  },
  CAR: {
    // JIM-54: the preserved Blender exports have their front axle along -Z.
    MODEL_YAW: Math.PI,
    MASS: 1100, BREAK_RADIUS: 1.2, EXPLODE_RADIUS: 3.5,
    PANEL_ROOF: .76, PANEL_FLOOR: .28, PANEL_FRONT: .7, PANEL_REAR: .24,
    PANEL_SIDE: .3, PANEL_BUMPER: .38, COLLIDER_MIN: .035,
    PART_GROUP: 2, PART_MASK: -1, PART_SPEED: 5.5, PART_LIFT: 3.2, PART_SPIN: 4,
  },
};
// M32: metre-scaled lanes, deterministic junction phases and local lighting.
export const TRAFFIC = {
  LANE_OFFSET: 2.15, LANE_SHARE: .25, APPROACH_MARGIN: 1.5,
  MIN_ROAD: 12, ROAD_SAMPLE: 2, CONNECTOR_STEPS: 24, CURVE_SHARE: .55,
  GREEN: 12, AMBER: 2.5, ALL_RED: 1.5, OFFSET_U: 7, OFFSET_V: 11, OFFSET_SPAN: 16,
  ACCELERATION: 2.8, BRAKE: 5, TURN_SPEED: 3.6, GAP: 1.2, STOP_SETBACK: .9,
  LOOK_AHEAD: 18, PROBE_STEP: .6, LATERAL_GAP: .3, PERSON_RADIUS: .45,
  MAX_DROP: .45, OBSTACLE_HEIGHT: 3,
  ROUTE_CHOICES: [0,0,1,0,2], STOP_SPEED: .04, YIELD_WAIT: 1, RESERVATION_CLEAR: .5,
  SIGNAL_SITE_OFFSETS: [1,.5,1.5], SIGNAL_SEARCH: 4, SIGNAL_SEARCH_STEP: .5,
  SIGNAL_MIN_ROADS: 3, SIGNAL_OFF: 0x262b2c,
  SIGNAL_COLORS: [0xff3020,0xffbd22,0x28ef83],
  LAMP_START: 9, LAMP_SPACING: 24, LAMP_LIMIT: 36, SIGNAL_LIMIT: 24, PAVEMENT_INSET: 1,
  PARK_MIN_WIDTH: 12, PARK_SPACING: 18, PARK_START: 15, SPAWN_END: 6, PARK_KERB: 1.05,
  MARK_LIMIT: 160, MARK_WIDTH: .28, MARK_LIFT: .025, MARK_COLOR: 0xe4dfc9,
  DASH_LENGTH: 3, DASH_SPACING: 10, DASH_WIDTH: .11, DASH_COLOR: 0xdcba59,
};
export const COLLECTION = {
  CONTACTS_PER_FRAME: 6,
  SKIN_CLEARANCE: 0.02,
  MIN_RADIUS: 2.2, SIZE_RATIO: .72, CAPACITY: 64, CONTACT: 1.15,
  PERSON_SIZE: 1.8, FOOD_SIZE: .3,
  RELEASE_GAP: 2, RELEASE_SPACING: 1.2, RELEASE_SCAN: 5,
  RELEASE_IMMUNITY: 1.5, FALLBACK_Y: .8,
  DIVERSITY:.35, REPLACE_RATIO:1.5, RELEASE_PER_FRAME:6,
};

export const GROUNDING = {
  PELVIS_DROP: .045, FOOT_CLEARANCE: .018, PROBE: .18,
  MAX_REACH: .995, MAX_DROP: .6, SOLVE_EPSILON: .0001,
  WALK_STRIDE: 1.1, RUN_STRIDE: 1.6, FOOT_LEAD: .32, STEP_LIFT: .14,
  STRIDE_LEG_RATIO: 1.85,
  WALK_FOOT_SPEED: 7.2, RUN_FOOT_SPEED: 14,
  SWING_SHARE: .85, SWING_MIN: .12, SWING_MAX: .4, MIN_SPEED: .05,
  VELOCITY_RESPONSE: 16, LANDING_RESPONSE: 18, LANDING_SPEED: 2.5, LANDING_LOCK: .65, NORMAL_RESPONSE: 16,
  PELVIS_RESPONSE: 18, PELVIS_SPEED: 3, RESET_DISTANCE: 2.5,
  WHEEL_INSET: .8, MAX_TILT: .5, SUSPENSION: .4, WHEEL_CONTACT_BAND: .35, WHEEL_SOLVE_STEPS: 4,
};
export const PAVING = {
  WIDTH: 2, HEIGHT: .22, KERB_WIDTH: .33,
  SLAB_CELLS: 5, JOINT_HALF: .018, JOINT_DEPTH: .018,
  GRADE_RUN: 8, SEAM_BLEND: 24, LAND_EDGE: 4, LAND_BLEND: 6,
  ROAD_MATERIAL: 18, SLAB_MATERIAL: 22, SLAB_VARIANT: 23, KERB_MATERIAL: 24,
};
export const GLAZING = {
  MATERIAL_ID: 4, COLOR: 0xc9e2e4, ROUGHNESS: .08, TRANSMISSION: .88,
  THICKNESS: .06, IOR: 1.46, ENV_SIZE: 128,
  MAX_PANE_CELLS: 2048, VERTEX_WELD: .0001, COPLANAR_DOT: .999,
};
export const GLASS_SHARDS = {
  MAX: 72, PER_BURST: 24, PER_PANE: 12, LIFETIME: 7,
  LENGTH_MIN: .12, LENGTH_MAX: .28, WIDTH_RATIO: .65, THICKNESS: .012,
  MASS: .025, SPEED: 2.6, LIFT: 1.8, SPIN: 9, CLEARANCE: .025,
  COLLISION_MASK: -1,
  COLOR: 0xc5edf2, ROUGHNESS: .06, TRANSMISSION: .5, METALNESS: .15,
};

export const CAR_EXPLOSION = {
  MAX: 4, POWER_CAP: 1.6, TEXTURE_SIZE: 64,
  FIRE_COUNT: 10, FIRE_LIFE: .55, FIRE_SIZE: 3.6, FIRE_SPREAD: 1.8, HEIGHT: .65,
  FIRE_START: .18, FIRE_COLOR: 0xff8822, CORE_COLOR: 0xfff4b5,
  SMOKE_COUNT: 12, SMOKE_LIFE: 3.6, SMOKE_SIZE: 1.4, SMOKE_GROWTH: .9,
  SMOKE_RISE: 1.3, SMOKE_DRIFT: .65, SMOKE_OPACITY: .55, SMOKE_COLOR: 0x454348,
  SPARK_COUNT: 18, SPARK_LIFE: .85, SPARK_SIZE: .075, SPARK_SPEED: 7,
  SPARK_LIFT: 5, SPARK_GRAVITY: 9.8, SPARK_COLOR: 0xffdb6e,
  LIGHT_INTENSITY: 18, LIGHT_DISTANCE: 13,
};

// M29: nearby bodies only; everyone recovers, including the catcher.
export const RAGDOLL = {
  CAPACITY: 6, MASS: 7, RADIUS: .085, TORSO_RADIUS: .18, HEAD_RADIUS: .13,
  DAMPING: .18, ANGLE: 1.1, TWIST: .45, FORCE: 8000,
  IMPULSE: 5, POWER_GAIN: 1.6, MAX_SPEED: 16, LIFT: 4, SPIN: 3,
  HIT_HEIGHT: .9, HIT_PADDING: .45, CONTACT_PADDING: .45,
  DOWN_SECONDS: 3, MAX_SECONDS: 8, REST_SPEED: 1.2, RECOVER_SECONDS: .8,
  IMMUNITY: 1, GROUP: 4, MASK: -1,
  BONES: [
    ['pelvis','spine_03'],['spine_03','neck_01'],['neck_01','head'],
    ['upperarm_l','lowerarm_l'],['lowerarm_l','hand_l'],
    ['upperarm_r','lowerarm_r'],['lowerarm_r','hand_r'],
    ['thigh_l','calf_l'],['calf_l','foot_l'],['thigh_r','calf_r'],['calf_r','foot_r'],
  ],
};
export const CAPTURE = {
  WINDUP: .9, SWING: .55, RECOVERY: 1.2, HOLD_MAX: 6,
  RATE: 1.25, SIZE_RESISTANCE: 4, DECAY: .7, ARC: 1.1,
  CONTACT_FRACTION: .5,
  NET_RADIUS: .45, NET_RIM: .025, HANDLE_LENGTH: 1.1, HANDLE_RADIUS: .02, NET_BAG_DEPTH: .65,
  HANDLE_BUTT: .1, FRONT_GRIP: .28, PALM_FRACTION: .85, PALM_DEPTH: .02,
  NET_CLEARANCE: .08, GROUND_POSE_PASSES: 3,
  ARM_REACH: .985, ELBOW_OUT: .8, ELBOW_DOWN: -.65, ELBOW_BACK: -.25,
  FINGER_CURL: [1, 1.3, .9], THUMB_CURL: [.15, .35, .4],
  // Grip positions are relative to the animated shoulder centre (JIM-75).
  NET_POSES: {
    carry: {position:[-.14,-.4,.18],pitch:-.2},
    windup: {position:[-.14,-.08,.08],pitch:-1.05},
    contact: {position:[-.14,-.34,.08],pitch:.38},
    follow: {position:[-.14,-.36,.08],pitch:.48},
  },
};


export const ENVIRONMENT = {
 PLANTS:['grass','grass_large','flower_redA','flower_purpleA','flower_yellowA','plant_bushSmall'],
 GRASS_TINT:0x97b85b,
 PLANT_HEIGHT:[.32,.45,.45,.5,.4,.65], GRASS_SHARE:.88, PLANT_LIMIT:2400,
 RADIUS:48, GRID:1.5, REFRESH:16, WALL_GAP:.6, SCALE_MIN:.7,SCALE_RANGE:.6,
 WIND_X:.35,WIND_Z:.18,GUST:.6,GUST_HZ:.7,BEND:1.6,BEND_RADIUS:1.1,
 TRAMPLE_HEIGHT:2,REBOUND_SECONDS:8,FLATTEN:.88,
 CLUMP_LIMIT:12,CLUMP_RADIUS:2.2,CLUMP_PLANTS:12,CLUMP_INTERVAL:.22,CLUMP_LIFE:20,CLUMP_MASS:15,ROOT_DEPTH:.25,ROOT_MATERIAL:8,CLUMP_HALF_MIN:.15,
 ANIMALS:['cat','dog','eagle'],ANIMAL_SIZE:[.45,.65,1.7],ANIMAL_COUNT:9,
 FLEE_RADIUS:7,FLEE_SECONDS:3,FLEE_SPEED:4,WALK_SPEED:.65,BIRD_SPEED:3,BIRD_HEIGHT:5,BIRD_BOB:.3,
 ROAM_RADIUS:14,MAX_STEP:.4,TURN_RATE:.4,WANDER_HZ:.7,RUN_RATE:2,
 PARTICLE_COUNT:100,PARTICLE_COLOR:0xcbbb80,PARTICLE_SIZE:.055,PARTICLE_OPACITY:.6,
 PARTICLE_SPAN:45,PARTICLE_BASE:.5,PARTICLE_HEIGHT:5,PARTICLE_BOB:.4,
};
export const DAY_NIGHT = {
 PHASES:[[0,'Night'],[5,'Dawn'],[7,'Day'],[17,'Dusk'],[19,'Night']],
 STREET_LIGHT_COUNT:4,STREET_LIGHT_COLOR:0xffd9a0,STREET_LIGHT_INTENSITY:26,STREET_LIGHT_RANGE:15,STREET_GLOW:2,
 START_HOUR:17,PERIOD:720,TWILIGHT_LOW:-.12,TWILIGHT_HIGH:.2,NOON_BLEND:.65,
 SUN_AZIMUTH:.3,LIGHT_DISTANCE:80,SUN_INTENSITY:3.2,MOON_INTENSITY:.45,
 MOON_COLOR:0xaac9ff,SUNSET_COLOR:0xffb571,NOON_COLOR:0xfff4dd,
 AMBIENT_NIGHT:0x9cadcf,AMBIENT_DAY:0xdde9ef,AMBIENT_MIN:.25,AMBIENT_MAX:.3,HEMI_MIN:.3,HEMI_MAX:.8,
 NIGHT_TOP:0x070f22,NIGHT_HORIZON:0x202f4b,DAY_TOP:0x609ec9,DAY_HORIZON:0xc9e1ed,SUNSET_HORIZON:0xf2b884,
 NIGHT_CLOUD:0x263653,DAY_CLOUD:0xffefd9,NIGHT_EXPOSURE:1.1,DAY_EXPOSURE:1.1,NIGHT_ENV:.08,DAY_ENV:.8,
 UNDERGROUND_SUN:.05,UNDERGROUND_AMBIENT:.12,UNDERGROUND_EXPOSURE:1,UNDERGROUND_ENV:.04,
 SHADOW_SIZE:2048,SHADOW_RADIUS:45,SHADOW_NEAR:1,SHADOW_FAR:180,SHADOW_BIAS:-.0004,SHADOW_NORMAL_BIAS:.08,SHADOW_INTERVAL:.2,
};

export const WATER = {
 BEACH_PREVIEW:[75,-714],BEACH_YAW:-.3398,SWIM_HYSTERESIS:.08,
 GRAVITY:9.81,WAVES:[[.8,.6,18,.22,0],[-.6,.8,7,.095,1],[1,0,3,.035,2]],
 RIPPLE_SIZE:64,RIPPLE_CELL:.75,RIPPLE_SPEED:3.5,RIPPLE_STEP:1/60,RIPPLE_DAMPING:.9,RIPPLE_MAX:1.8,RIPPLE_LIFETIME:20,SPLAT_RADIUS:2,
 BODY_WINDOW:6,MAX_WINDOW:288,NEAR_WINDOW_MARGIN:1.2,SPLAT_FALLOFF:2,
 CONTACT_RESET_MARGIN:.15,
 REACTION_RADIUS_MIN:.2,REACTION_RADIUS_MAX:48,REACTION_BASE_RADIUS:.55,
 ENTRY_GAIN:.035,WAKE_GAIN:.018,REACTION_MIN:.025,REACTION_MAX:1.2,ENTRY_MIN_SPEED:1.5,
 WAKE_FOOTPRINT:.55,WAKE_TRAIL:.65,MAX_REACTIONS:16,
 FOAM_RINGS:32,FOAM_INNER:.82,FOAM_SEGMENTS:64,FOAM_LIFT:.045,FOAM_EDGE:.25,
 FOAM_WIDTH_MIN:.08,FOAM_WIDTH_RATIO:.15,FOAM_WIDTH_MAX:2.5,FOAM_WAKE_OPACITY:.28,
 RING_LIFE:2,RING_LIFE_GAIN:.4,RING_MAX_LIFE:5,RING_SPEED:2.4,RING_SPEED_GAIN:1.2,RING_OPACITY:.5,
 FOAM_NOISE_ARCS:31,FOAM_NOISE_SPEED:2.8,FOAM_BREAKUP:.7,SPLASH_VARIATION:.35,
 SPLASH_SCALE_MIN:.65,SPLASH_SCALE_MAX:10,SPLASH_MAX_PARTICLES:48,SPLASH_RIM:.95,SPLASH_CLEARANCE:.06,
 SPLASH_IMPACT_GAIN:.035,SPLASH_IMPACT_MAX:1.7,SPLASH_MIN_FALL:.8,
 SPLASH_WAKE_SPEED:.5,SPLASH_WAKE_SCALE:.5,SPLASH_WAKE_PARTICLES:4,
 NEAR_SIZE:144,NEAR_SEGMENTS:192,FAR_SEGMENTS:128,DEPTH_SIZE:512,NORMAL_SIZE:128,
 REFLECTION_SIZE:384,REFLECTION_INTERVAL:.12,REFLECTION_MAX_HEIGHT:28,NORMAL_REPEAT:.22,NORMAL_STRENGTH:.32,
 SHALLOW_ALPHA:.62,DEEP_ALPHA:.96,FOAM_OPACITY:.55,
 DEEP:0x073448,SHALLOW:0x459c98,FOAM:0xe4f5ec,FOAM_DEPTH:.6,ABSORPTION:.22,
 DENSITY:1000,MAX_BUOYANCY:3,DRAG:2.8,ANGULAR_DRAG:2,BUOYANCY_DAMPING:3,
 PROP_WAKE_SPEED:.3,PROP_WAKE_INTERVAL:.2,PROP_WAKE_RETENTION:2,SPLASH_THRESHOLD:2,WADE_SPEED:.2,
 MIN_DEPTH:.05,MAX_DEPTH:15,WAKE_INTERVAL:.15,WAKE_STRENGTH:.055,
 SWIM_SPEED:2.8,SWIM_FAST:4.1,SWIM_OFFSET:.1,SWIM_ENTER:.8,SWIM_DEPTH:.75,SWIM_RESPONSE:8,PADDLE_RATE:7,PADDLE_ANGLE:.8,
 SPLASH_COUNT:96,SPLASH_PARTICLES:12,SPLASH_SIZE:.045,SPLASH_LIFE:.8,SPLASH_SPEED:2.4,SPLASH_LIFT:3.5,
};

// M33: cooperative work slices keep streaming and large impacts responsive.
export const WORK_BUDGET = {MESH_MS:4,MESH_SLICES:2048,GENERATION_MS:3,GENERATION_SLICES:128,DAMAGE_MS:3,DAMAGE_SLICES:16,REPLAY_BATCH:256,MAX_COLUMN_QUEUE:8,MAX_DAMAGE_QUEUE:4,DAMAGE_BATCH:256};

export const GIANT_IMPACT = {
  MIN_RADIUS:8, ROLL_RADIUS:1.02, HEADBUTT_RADIUS:1.3, HEADBUTT_FORWARD:1,
  LUNGE_PER_RADIUS:1.8, MAX_LUNGE_SPEED:60, UPWARD_THRESHOLD:.2, AIM_LEAN:.7,
};
export const GROUND_CHANNEL = {
  WIDTH_RATIO:.78, MAX_HALF_WIDTH:30, DEPTH_RATIO:.18, MAX_DEPTH:6.5,
  MIN_TRAVEL:.1, MAX_SEGMENTS:64, CONTACT_SLOP:.3,
  FIELD_CELL:VOXEL.SIZE*4, FIELD_TEXTURE:512, FIELD_RECENTER:32, FIELD_WORK:2048,
  BANK_OUTER:1.45, BANK_HEIGHT:.32, ROUGHNESS:.08, ROUGH_SCALE:.7,
  DIRT_MATERIAL:8, DIRT_REVEAL:.35, DIRT_GRAIN:.24, DIRT_GRAIN_SCALE:9, EFFECT_SAMPLES:24,
  DUST_COUNT:96, DUST_PER_FRAME:2, DUST_LIFE:2.5, DUST_SIZE:2.8, DUST_SPEED:4, DUST_RISE:2.5, DUST_OPACITY:.32, DUST_COLOR:0x99836a,
  CLOD_COUNT:48, CLOD_LIFE:2, CLOD_SIZE:.55, CLOD_LIFT:6, CLOD_SPEED:7, CLOD_GRAVITY:14,
};

export const SUPPORT = {PROP_WORK:8, GAP:.35, FOOTPRINT:.8, PLANT_WORK:64, FALL_GRAVITY:18,
  CELL_VOXELS:4, WORK:256, PENDING:32, ACTIVE:1, DAMAGE_SHARE:4, SECTION_LIMIT:48, SECTION_CELLS:8, SECTION_VOXELS:512, SECTION_LIFE:20, SECTION_MASS:60, SECTION_MIN:.22, SECTION_DENSITY:900, SECTION_MASS_MIN:4, SECTION_MASS_MAX:2400, SECTION_SPIN:.35, SECTION_DROP:.6};

export const VOXEL_BATCH={VERTICES:262144,INSTANCES:128,RESERVE:1.125,GROUND_STEP:4,GROUND_ERROR:.025};

export const GRAPHICS={
 DEFAULT:'medium',STORAGE:'jimothy-graphics',UNLOAD_MARGIN:2,CONTACT_COLUMNS:1,FOG_START:.55,FOG_END:.94,ACTOR_RADIUS:2,CONTACT_MARGIN:10,
 PRESETS:{
  low:{DISTANCE:350,DETAIL:85,COLUMNS:1,FLY_COLUMNS:2,PIXEL_RATIO:1,SHADOW_SIZE:512,AI_DISTANCE:28,AI_INTERVAL:.12,MESH_MS:2,GEN_MS:1.5,DAMAGE_MS:1.5},
  medium:{DISTANCE:700,DETAIL:140,COLUMNS:2,FLY_COLUMNS:3,PIXEL_RATIO:1.5,SHADOW_SIZE:1024,AI_DISTANCE:40,AI_INTERVAL:.1,MESH_MS:2.5,GEN_MS:2,DAMAGE_MS:2},
  high:{DISTANCE:1400,DETAIL:220,COLUMNS:3,FLY_COLUMNS:5,PIXEL_RATIO:2,SHADOW_SIZE:2048,AI_DISTANCE:60,AI_INTERVAL:.08,MESH_MS:4,GEN_MS:3,DAMAGE_MS:3},
 }
};
export const LOD_BUILDINGS={BATCH_VERTICES:65536,BATCH_INSTANCES:512,CELL:128,ROOF_THICKNESS:.18,WINDOW_THICKNESS:.012};

// Milestone 34: caps and warnings keep the army local and readable.
export const MILITARY={
 TANK_TIER:5,GIANT_TIER:4,JET_TIER:5,GIANT_RADIUS:8,MAX_TANKS:2,MAX_JETS:1,
 TANK_INTERVAL:12,JET_INTERVAL:22,TANK_MIN_SPAWN:35,TANK_MAX_SPAWN:140,TANK_SPAWN:75,TANK_SEPARATION:22,
 TANK_SPEED:5,TANK_RANGE:110,TANK_APPROACH_SECONDS:1,TANK_WARNING:2.4,TANK_COOLDOWN:7,
 JET_GROUND_SAMPLES:7,JET_HEADING:2.4,JET_ALTITUDE:65,JET_APPROACH:300,JET_SPEED:58,JET_RELEASE:65,JET_EXIT:320,JET_CLIMB:.18,
 JET_PASS_MIN:22,JET_PASS_BODY:1.25,JET_DIVE_DISTANCE:100,JET_TERRAIN_CLEARANCE:18,
 TANK_BLAST:5,JET_BLAST:8,BREAK_RADIUS:6,MAX_PROJECTILES:6,SHELL_SECONDS:1.2,BOMB_SECONDS:1.1,SHELL_ARC:8,
 SHELL_SIZE:.22,SHELL_SEGMENTS:6,SHELL_COLOR:0xffdc8b,MUZZLE_HEIGHT:.4,
 WARNING_BODY_RADIUS:1.05,WARNING_INNER:.86,WARNING_SEGMENTS:40,WARNING_COLOR:0xff743d,WARNING_OPACITY:.8,WARNING_LIFT:.12,WARNING_PULSE:.05,WARNING_HZ:7,
 GROUND_SCAN:5,DESPAWN_DISTANCE:560,MASS:8000,WRECK_LIFE:24,MAX_WRECKAGE:24,
 PART_MIN:.12,PART_SPEED:5,PART_LIFT:6,PART_SPIN:2,PART_ANGLE:2.399963,
 LAUNCH_SPEED:18,LAUNCH_UP:12,LAUNCH_SECONDS:2.2,LAUNCH_SPIN:5,SIZE_RESISTANCE:.035,PLAYER_MASS:35,HIT_IMMUNITY:2.5,
};

// Milestone 35: shallow compaction keeps fine voxel destruction beneath it.
export const BEACH = {
  REGIONS: [[70,-700,180],[-420,580,180],[145,820,210],[660,90,210],[-590,-580,200]],
  REGION_MIN: .1, BAND: 32, BAND_VARIATION: 5, BAND_FREQUENCY: .025, MAX_HEIGHT: 4.5,
  WET_HEIGHT: .5, WET_BLEND_LOW: .1, WET_BLEND_HIGH: .9, TRACK_DARKEN: .28, DUNE_GRASS_SHARE: .12, DRY_MATERIAL: 12, WET_MATERIAL: 25,
  INNER_SHALLOWS: 12, OUTER_GRADE: .55, DUNE_HEIGHT: .35, DUNE_START: 12, DUNE_END: 38,
  CELL: .22, TEXTURE_SIZE: 256, RECENTER_MARGIN: 48,
  MAX_DEPTH: .16, MAX_RADIUS: 12, MAX_CELLS: 131072, MAX_JOBS: 8,
  WORK_CELLS: 768, SETTLE_CELLS: 256, SETTLE_RATE: .6, PERMANENCE: .72,
  FOOT_RADIUS: .23, FOOT_DEPTH: .045, FOOT_INTERVAL: .15,
  ROLL_DEPTH: .09, IMPACT_DEPTH: .16, MIN_SPEED: .3,
  GRAINS: 160, GRAINS_PER_STAMP: 4, GRAIN_SIZE: .023, GRAIN_LIFE: .55,
  GRAIN_SPEED: 1.3, GRAIN_LIFT: 1.7, GRAVITY: 9.8, GRAIN_COLOR: 0xd8c599,
  NOISE_SCALE: 28, NOISE_STRENGTH: .08,
};

export const OCEAN = {
  SITE_STEP:180, SITE_JITTER:80, SITE_GAP:145, REPEAT_GAP:300, SITE_DEPTH:5,
  SITE_SLOPE:.12, EDGE_MARGIN:70, SITE_RADIUS:18, MAX_RUIN_PIECES:72,
  STREAM_RADIUS:110, DESPAWN_RADIUS:150, MAX_SITES:3, STREAM_INTERVAL:.5,
  WRECKS:['wreck-rowboat','wreck-sloop','wreck-longboat'],
  RUINS:['temple','tidal-ring','sunken-quay','broken-gate'],
  STONE_MATERIALS:[6,10,13], BURIAL_MIN:.2, BURIAL_RANGE:.65, TILT:.8, WRECK_TILT_MIN:.22, WRECK_BURY_FRACTION:.32, WRECK_MISSING:.16, RUIN_MISSING:.18,
  MAX_PARTS:72, MAX_LOOSE:20, LOOSE_LIFE:28, BREAK_MIN:.35, PART_MIN:.1, PART_BREAK_RATIO:.3, CONTACT_MARGIN:.02,
  WOOD_DENSITY:180, STONE_DENSITY:2200, PART_SPEED:2, PART_LIFT:1.8, PART_SPIN:1,
  STONE_CHUNK:.65, ARTIFACTS:5, ARTIFACT_RING:7,
  DIVE_SPEED:2.7, ASCEND_SPEED:3.2, VERTICAL_RESPONSE:5, DIVE_BRAKE:16, SURFACE_SNAP:.12,
  CAMERA_HEIGHT:.8, CAMERA_PITCH_MIN:-1.1, CAMERA_WATER_MARGIN:.12,
  FOG_COLOR:0x205d69, NIGHT_FOG:0x061d2b, FOG_NEAR:2, FOG_FAR:48, NIGHT_FAR:22,
  DEPTH_DIM:.035, MIN_LIGHT:.28, SURFACE_COLOR:0x36838d, SURFACE_SHIMMER:.025,
  FISH:['fish-silver','fish-blue','fish-striped','manta','whale'],
  SCHOOL_COUNT:3, SCHOOL_SIZE:4, FISH_LIMIT:13, SCHOOL_RADIUS:10, FISH_SPEED:1,
  LARGE_SPEED:.75, FLEE_RADIUS:4, FLEE_SPEED:2.5, FISH_CLEARANCE:1.2, FISH_SURFACE:1,
  FISH_DESPAWN_RADIUS:60, FISH_BOB:.1, FISH_ANIMATE_DISTANCE:45, FISH_ANIMATE_INTERVAL:.2, FISH_TURN:1.8,
  PLANT_GRID:5, PLANT_RADIUS:48, PLANT_LIMIT:220, HABITAT_SHARE:.32, PLANT_BREAK_RATIO:.5,
  PLANT_REFRESH:16, PLANT_SCALE_MIN:.6, PLANT_SCALE_RANGE:1.1,
  CURRENT_SPEED:.6, CURRENT_BEND:.06, PLANT_BEND:.3,
  CREATURE_COUNT:10, CRAB_SPEED:.16, CRAB_RANGE:3,
  BUBBLES:160, BUBBLE_INTERVAL:.15, BUBBLE_SPEED:.65, BUBBLE_LIFE:12,
  BUBBLE_COLOR:0xb2e4df, BUBBLE_OPACITY:.65, BUBBLE_SCREEN_SCALE:800, BUBBLE_SIZE:.06, BUBBLE_DRIFT:.12, VENT_INTERVAL:.8,
  RAYS:7, RAY_RADIUS:2.2, RAY_OPACITY:.16, RAY_DAY_MIN:.08,
  RAY_SPREAD:22, RAY_FORWARD:12, RAY_FLOOR_FADE:1.2, RAY_DEPTH_MAX:14, RAY_LENGTH_MAX:24, RAY_SEGMENTS:32, RAY_COLOR:0x8cbdb7, RAY_START_MARGIN:.1,
  PREVIEW_OFFSET:12, PREVIEW_DEPTH:4, DEBRIS_FLOOR_MARGIN:2,
  RUIN_BLOCK:[1.1,.55,.85], COLUMN_RADIUS:.48,COLUMN_HEIGHT:3.6,
  TEMPLE_SPAN:4,TEMPLE_LENGTH:5, RING_RADIUS:5,QUAY_WIDTH:6, GATE_RADIUS:2.6,
};

// Authored ruin dimensions live with the other world tuning. Blender reads
// these same descriptors through OceanLayout rather than a second recipe.
OCEAN.RUIN_LAYOUTS=Object.fromEntries(OCEAN.RUINS.map(family=>{
 const site={family},C=OCEAN;
 const pieces=[],add=(x,y,z,sx,sy,sz,roll=0,shape='box')=>pieces.push({x,y,z,sx,sy,sz,roll,shape});
 const B=C.RUIN_BLOCK;
 if(site.family==='temple'){
  for(const x of [-C.TEMPLE_SPAN,C.TEMPLE_SPAN])for(const z of [-C.TEMPLE_LENGTH,0,C.TEMPLE_LENGTH]){
   add(x,C.COLUMN_HEIGHT/2,z,C.COLUMN_RADIUS*2,C.COLUMN_HEIGHT,C.COLUMN_RADIUS*2,0,'column');
   add(x,C.COLUMN_HEIGHT,z,1.5,.45,1.5);
  }
  for(const z of [-C.TEMPLE_LENGTH,C.TEMPLE_LENGTH])add(0,C.COLUMN_HEIGHT+.5,z,C.TEMPLE_SPAN*2+1,.7,1.3);
  for(let i=0;i<3;i++)add(0,.2+i*.25,-C.TEMPLE_LENGTH-1.5+i*.5,5,.4,1.6-i*.35);
 }else if(site.family==='tidal-ring'){
  for(let ring=0;ring<2;ring++)for(let i=0;i<18;i++){
   const a=i/18*Math.PI*2,r=C.RING_RADIUS;add(Math.cos(a)*r,ring*B[1]+B[1]/2,Math.sin(a)*r,B[0],B[1],B[2]);pieces.at(-1).yaw=-a;
  }
  for(let i=0;i<5;i++)add(Math.sin(i)*2,.5,Math.cos(i)*2,.7,1,.7,0,'column');
 }else if(site.family==='sunken-quay'){
  for(let x=-3;x<=3;x++)for(let level=0;level<3;level++)add(x*B[0],level*B[1]+B[1]/2,3,B[0],B[1],B[2]);
  for(let z=-2;z<=2;z++)for(const x of [-C.QUAY_WIDTH,C.QUAY_WIDTH])add(x,1.5,z*2,.7,3,.7,0,'column');
  for(let i=0;i<4;i++)add(0,.2+i*.35,-3+i,6,.4,1.3);
 }else{
  const r=C.GATE_RADIUS;
  for(const x of [-r,r])for(let i=0;i<3;i++)add(x,B[1]/2+i*B[1],0,B[2],B[1],1.2);
  for(let i=0;i<11;i++){const a=i/10*Math.PI;add(Math.cos(a)*r,3*B[1]+Math.sin(a)*r,0,B[2],B[0],1.2,a-Math.PI/2);}
  for(const x of [-r-2,r+2])for(let i=0;i<4;i++)add(x,.3+i*.6,0,2,.55,.85);
 }
 return [family,pieces];
}));

// M37: the pickup silhouette, displayed name and payout share one identity.
export const FOOD_MODELS = {
  IDS: ['pizza-slice','old-banana','cold-fries','mystery-meat','chicken-bone','burrito','wet-bread','half-hot-dog','expired-yogurt','fancy-garbage','whole-pizza','turkey-leg','lasagna','birthday-cake','family-roast','meatloaf'],
  LIMIT: 96, BOB_HEIGHT: .025, CLEARANCE: .035, SUPPORT_SCAN: .25,
  SUPPORT_INTERVAL: .25, REACH_HEIGHT: 1.15, SPIN_RATE: 3,
};

export const INTERIORS = {
  MODELS:['bedDouble','bedSingle','loungeSofa','loungeChair','table','tableRound','chair','chairDesk','desk','bookcaseOpen','kitchenFridge','kitchenStove','kitchenSink','kitchenCabinet','toilet','bathtub','bathroomSink','cardboardBoxClosed','cardboardBoxOpen','pottedPlant','lampRoundFloor','televisionVintage','cabinetTelevision','computerScreen','books','tableCoffee','rugRectangle'],
  RADIUS:55, VERTICAL_RADIUS:4, MAX_FLOORS:4, MAX_ITEMS:64, MAX_RESIDENTS:8, RESIDENTS_PER_FLOOR:2,
  FRAGMENTS:16, FRAGMENT_LIFE:18, REFRESH:1, RESIDENT_DISTANCE:38, NEAR_DISTANCE:12, BATCH_CAPACITY:112, BATCH_VERTICES:140000,
  MAX_DOORS:32, DOOR_GAP:.035, DOOR_DEPTH:.10, DOOR_OPEN:Math.PI/2, DOOR_SPEED:4.8, DOOR_REACH:2.4, DOOR_WAIT:3, DOOR_FLOOR_RANGE:.8,
  DOOR_MASS:22, DOOR_HINGE_HEIGHTS:[.44,1.54], DOOR_PANEL_INSET:.12, DOOR_PANEL_DEPTH:.025, DOOR_PANEL_Y:[.27,.7], DOOR_PANEL_HEIGHT:.3,
  DOOR_COLORS:[0x744630,0x45616c,0x987349], DOOR_INNER_COLOR:0xcdbb97, DOOR_ROUGHNESS:.7, DOOR_METAL_COLOR:0x9d8150, DOOR_PANEL_LIGHT:1.08, DOOR_METALNESS:.5, DOOR_MAIL_HEIGHT:.6,
  DOOR_HANDLE_INSET:.15, DOOR_HANDLE_HEIGHT:.48, DOOR_HANDLE_SIZE:[.14,.035,.07], DOOR_MAIL_SIZE:[.32,.06,.012],
  FLOOR_FURNISHINGS:['rugRectangle'],
  FURNISH_ANCHORS:[[0,0],[1,1],[0,1],[1,0],[.5,.5],[.25,1],[0,.5],[1,.5]],
  DECOR:{cabinetTelevision:"televisionVintage",desk:"computerScreen",table:"books",kitchenCabinet:"books"},
  DOOR_CLEARANCE:.28, DOOR_SUPPORT_INTERVAL:.5, DOOR_VISITOR_REFRESH:.1, DOOR_SIGHT_STEP:Math.PI/12, DECOR_CLEARANCE:.02,
  HALL:2.2, LANDING:1.54, STAIR_WIDTH:1.54, WALL_MARGIN:.55, ROOM_MIN:3.0,
  DOOR:1.54, WALL_MATERIAL:13, WALL_PALETTE:[13,14,15], FLOOR_MATERIAL:17, WET_FLOOR:6, STAIR_MATERIAL:17, SKIRT_MATERIAL:17,
  MIN_HEADROOM:2.2, ROOM_DEPTH:4.8, PLAN_CACHE:128, SPLITS:[.45,.5,.55], FURNITURE_INSET:.85, ROOM_CLEARANCE:.60, FURNITURE_GAP:.12,
  ROOM_NODE_RATIO:.5, COMPACT_NODE_RATIO:.28, CLEARANCE:.025, BODY_RADIUS:.22, BODY_HEIGHT:1.65, GROUND_SCAN:.28, MAX_STEP:.5, GRAVITY:12,
  PASS_DISTANCE:.9, PASS_STEP:.58, PASS_SECONDS:1.5, PASS_WAIT:.1,
  SPEED:.85, FLEE_SPEED:2.2, PAUSE:2.6, ARRIVE:.13, SCARE_RADIUS:5.5, FLEE_TIME:7,
  BREAK_RADIUS:1.1, IMPULSE:5, LIFT:3, SPIN:2, MASS:18, FRAGMENT_MIN:.06, BONK_SPEED:1.8,
  SUPPORT_INTERVAL:.5, MAX_FOOD_PER_FLOOR:2, PREVIEW_TYPES:['craftsman','apartment','shop','warehouse','tower'], PREVIEW_HEIGHT:1.65,
  FURNISHINGS: {
    studio:[['loungeSofa'],['kitchenFridge'],['kitchenStove','kitchenSink'],['cabinetTelevision'],['rugRectangle'],['tableCoffee']],
    living:[['loungeSofa'],['cabinetTelevision'],['pottedPlant','lampRoundFloor'],['tableCoffee'],['rugRectangle']],
    kitchen:[['kitchenStove','kitchenSink'],['kitchenFridge'],['kitchenCabinet','tableRound']],
    bedroom:[['bedDouble','bedSingle'],['bookcaseOpen','desk'],['lampRoundFloor','pottedPlant'],['chair'],['rugRectangle']],
    bathroom:[['toilet'],['bathroomSink'],['bathtub']],
    office:[['desk'],['bookcaseOpen'],['chairDesk']],
    shop:[['bookcaseOpen'],['kitchenCabinet','table'],['pottedPlant','chair']],
    cafe:[['tableRound','table'],['kitchenCabinet'],['chair','loungeChair']],
    stock:[['cardboardBoxClosed','cardboardBoxOpen'],['bookcaseOpen'],['cardboardBoxClosed']],
  },
};

export const COMET = {
  FALL_SECONDS:3, RECOVER_SECONDS:1.55, HEIGHT:82, OFFSET:[18,-8], ACCEL_POWER:1.65,
  CRATER_RADIUS:3.2, CRATER_DEPTH:1.05, IMPACT_RADIUS:5, EXPLOSION_RADIUS:6,
  PITCH:1.12, TUMBLE:.22, TUMBLE_RATE:7, TUCK:.9,
  CAMERA_FALL:[5,3,8], CAMERA_IMPACT:[7,7,15], CAMERA_LOOK:.85,
  FOV_RUSH:14, FOV_IMPACT:20, SHAKE:.026, SHAKE_RATE:48, SHAKE_SECONDS:.9,
  FIRE_COUNT:44, TRAIL_COUNT:100, DUST_COUNT:64, TEXTURE_SIZE:64, RING_SEGMENTS:64,
  FIRE_RADIUS:1.2, FIRE_SIZE:1.45, FIRE_FLICKER:17, FIRE_HEIGHT:.75, FIRE_OPACITY:.22, CORE_MIX:.18,
  EMBERS:12, EMBER_SIZE:.12, EMBER_RADIUS:2.4, EMBER_RISE:4,
  TRAIL_INTERVAL:.018, TRAIL_LIFE:1.1, TRAIL_SIZE:1.4, TRAIL_DRIFT:1.6, TRAIL_OPACITY:.5,
  WAKE_SIZE:1.8, WAKE_GROWTH:1.5, WAKE_OPACITY:.2,
  DUST_LIFE:3.4, DUST_SIZE:1.5, DUST_SPEED:4.8, DUST_RISE:1.3, DUST_OPACITY:.5,
  SHOCK_SECONDS:1.1, SHOCK_RADIUS:13, SHOCK_WIDTH:.08, SHOCK_HEIGHT:.15,
  FIRE_COLOR:0xff620d, CORE_COLOR:0xffedaa, SMOKE_COLOR:0x6e5743, SHOCK_COLOR:0xffcb79,
  LIGHT_INTENSITY:20, LIGHT_DISTANCE:24, FLASH_SECONDS:.22, FLASH_OPACITY:.65,
  SOUND_VOLUME:.24, RUSH_HZ:420, RUSH_END_HZ:1900, BOOM_HZ:95, BOOM_END_HZ:28,
  BOOM_SECONDS:1.5, NOISE_SECONDS:2, AUDIO_FADE:.03, AUDIO_FLOOR:.001,
};

// M43–44: costs spend food energy, never the fatness used for body/score.
export const TOOLS = {
 ENERGY_MAX:100,ENERGY_START:35,ENERGY_PER_FAT:8,LIMIT:24,EFFECT_LIMIT:96,STATUS_LIMIT:6,PAINT_LIMIT:24,
 PICKUP_REACH:2.5,HEIGHT_REACH:2,RENDER_DISTANCE:100,MODEL_SCALE:.85,MASS:8,CLEARANCE:.06,
 RAY_STEP:.22,CONTACT_PAD:.55,PERSON_HEIGHT:.85,TARGET_LIMIT:12,CONTACTS:8,
 HOLD_SIDE:.75,HOLD_FORWARD:.9,HOLD_HEIGHT:.12,HOLD_MIN_HEIGHT:.4,HOLD_SCALE_MAX:3,
 EFFECT_LIFE:.45,EFFECT_SIZE:.06,EFFECT_SPEED:8,EFFECT_SPREAD:.18,EFFECT_OPACITY:.62,
 BUBBLE_LIFE:3.5,BUBBLE_RISE:1.4,BUBBLE_RADIUS:1.2,BUBBLE_COLOR:0x8bdcf4,BUBBLE_OPACITY:.22,
 BUBBLE_ROUGHNESS:.1,PAINT_ROUGHNESS:.8,PAINT_BASE:0xffffff,
 PAINT_LIFE:12,PAINT_RADIUS:.18,PAINT_CLEARANCE:.02,CHAOS:1,FORCE_LIFT:.4,FORCE_MASS:40,BIN_SPIN:2.8,FOOD_PUSH_STEP:.2,
 SUCTION_SPEED:12,SUCTION_CLEARANCE:.35,PILE_DISTANCE:1.4,STATUS_WOBBLE:.12,STATUS_HZ:4,SIZE_REACH_MAX:2.5,
 SITE_STEP:6,SITE_RING:20,SITE_SCAN:24,SITE_SEPARATION:2.5,SPAWN_X:-6,SPAWN_Z:-16,
 GAMEPAD_PICKUP:4,GAMEPAD_DROP:1,GAMEPAD_USE:5,
 MOTION_RADIUS:3,MOTION_LIFE:.22,GLIDER_FALL:3.2,MOTION_ACCEL:140,
 STATUS_ICON:.18,STATUS_ICON_HEIGHT:2.15,STUN_LIFE:1.8,DANCE_HZ:8,DANCE_BEND:.16,DANCE_SWAY:.1,DANCE_ARM:.65,SICK_BEND:.6,SICK_ARM:1.1,SICK_COLOR:0xa7df36,SICK_PARTICLES:3,
 REPEL_SPEED:3.4,REPEL_STEP:.5,REPEL_LIFE:1.2,CLOUD_LIMIT:3,CLOUD_THROW:4,CLOUD_RADIUS:3,CLOUD_LIFE:6,STINK_COLOR:0x8aa837,
 GLOVE_RADIUS:1.6,GLOVE_POWER:1,PLUNGER_LIFE:5,PLUNGER_SPEED:.2,TOW_MASS:320,TOW_MASS_MAX:350,TOW_LIFE:5,TOW_RANGE:16,TOW_REST:1.5,TOW_SPEED:8,TOW_GAIN:3,
 DEVICE_LIMIT:6,DEVICE_FORWARD:3,DEVICE_LIFE:18,DEVICE_MASS:30,FOAM_HALF:[1.6,1.2,1.3],FOAM_COLOR:0xefffd9,PAD_HALF:[1.1,.15,1.1],PAD_MODEL_SCALE:1.8,PAD_FORCE:11,PAD_CONTACT:.65,PAD_COOLDOWN:.7,
 SHIELD_LIFE:2.5,SHIELD_PAD:.25,DIG_FORWARD:1,DIG_DEPTH:.15,DIG_RADIUS:1.15,
 PROJECTILE_LIMIT:8,PROJECTILE_OFFSET:.4,PROJECTILE_SPEED:18,PROJECTILE_LIFT:6,PROJECTILE_LIFE:1.5,PROJECTILE_GRAVITY:9,PROJECTILE_TRAIL:1,PROJECTILE_RADIUS:.12,PROJECTILE_LENGTH:.7,FIREWORK_RADIUS:2.8,FIREWORK_COLOR:0xffbd39,ROPE_COLOR:0xe4d5a4,

 CATALOG:[
  {id:'power-washer',name:'POWER WASHER',mode:'water',color:0x80dfff,range:14,cone:.94,cost:1.2,interval:.12,force:9,description:'Narrow water jet pushes light objects'},
  {id:'bubble-gun',name:'BUBBLE GUN',mode:'bubble',color:0x8bdcf4,range:13,cone:.9,cost:8,interval:.75,force:0,description:'Float a person in a bubble'},
  {id:'leaf-blower',name:'LEAF BLOWER',mode:'air',color:0xe8dcc0,range:9,cone:.65,cost:1.1,interval:.12,force:7,description:'Sweep light objects with a wide air cone'},
  {id:'vacuum',name:'VACUUM',mode:'suction',color:0x87acda,range:12,cone:.5,cost:1,interval:.12,force:0,description:'Suck loose food into a nearby pile'},
  {id:'food-magnet',name:'FOOD MAGNET',mode:'magnet',color:0xf57898,range:7,cone:-1,cost:3,interval:.35,force:0,description:'Gather food from every direction'},
  {id:'fire-extinguisher',name:'FIRE EXTINGUISHER',mode:'extinguisher',color:0xf4f4ed,range:8,cone:.65,cost:2,interval:.2,force:5,description:'White spray pushes objects and kicks you backwards'},
  {id:'paint-sprayer',name:'PAINT SPRAYER',mode:'paint',color:0xfe459a,range:12,cone:.86,cost:2,interval:.25,force:0,description:'Splat paint on people and props'},
  {id:'confetti-cannon',name:'CONFETTI CANNON',mode:'confetti',color:0xffd64d,range:8,cone:.25,cost:5,interval:.7,force:0,description:'Startle a crowd with a bright burst'},
  {id:'air-horn',name:'AIR HORN',mode:'stun',color:0xffc52b,range:10,cone:0.84,cost:7,interval:0.7,force:0,description:'Sonic blast briefly stuns people',life:1.8},
  {id:'disco-ray',name:'DISCO RAY',mode:'dance',color:0xef56ff,range:14,cone:0.93,cost:9,interval:0.7,force:0,description:'Turn a pursuer into a dancing distraction',life:4},
  {id:'sick-ray',name:'SICK RAY',mode:'sick',color:0xa7df36,range:12,cone:0.93,cost:9,interval:0.7,force:0,description:'Give someone a cartoon queasy pause',life:3.5},
  {id:'stink-sprayer',name:'STINK SPRAYER',mode:'stink',color:0x8aa837,range:7,cone:0.6,cost:12,interval:0.8,force:0,description:'Leave a lingering cloud people flee',life:0},
  {id:'spring-glove',name:'SPRING GLOVE',mode:'glove',color:0xfa4038,range:3,cone:0.65,cost:8,interval:0.7,force:16,description:'Punch one nearby target away',life:0},
  {id:'suction-grappler',name:'SUCTION GRAPPLER',mode:'grapple',color:0xdfb378,range:32,cone:0.98,cost:2,interval:0.12,force:15,description:'Hold toward solid scenery to reel yourself in',life:0},
  {id:'plunger-launcher',name:'PLUNGER LAUNCHER',mode:'plunger',color:0xff523d,range:18,cone:0.94,cost:8,interval:0.7,force:0,description:'Sticky plunger slows a moving car',life:0},
  {id:'tow-reel',name:'TOW REEL',mode:'tow',color:0xe4d5a4,range:12,cone:0.8,cost:7,interval:0.6,force:8,description:'Pull a light prop behind you; heavy cars resist',life:0},
  {id:'foam-cannon',name:'FOAM CANNON',mode:'foam',color:0xefffd9,range:7,cone:0.8,cost:12,interval:0.9,force:0,description:'Place a temporary physical traffic obstruction',life:0},
  {id:'trampoline-popper',name:'TRAMPOLINE POPPER',mode:'trampoline',color:0xfd3b68,range:5,cone:0.8,cost:12,interval:0.9,force:11,description:'Place a spring pad and step onto it',life:0},
  {id:'rocket-skates',name:'ROCKET SKATES',mode:'skates',color:0xffa22e,range:0,cone:1,cost:2,interval:0.12,force:16,description:'Hold to boost; compact bodies only',life:0},
  {id:'pogo-stick',name:'POGO STICK',mode:'pogo',color:0xffd532,range:0,cone:1,cost:5,interval:0.3,force:10,description:'Hold for repeated forward hops',life:0},
  {id:'umbrella-glider',name:'UMBRELLA GLIDER',mode:'glider',color:0xff5d53,range:0,cone:1,cost:1,interval:0.12,force:6,description:'Hold while airborne to slow falling',life:0},
  {id:'bubble-shield',name:'BUBBLE SHIELD',mode:'shield',color:0x70dffa,range:0,cone:1,cost:20,interval:3.5,force:0,description:'Briefly break an animal-control net hold',life:0},
  {id:'jackhammer',name:'JACKHAMMER',mode:'dig',color:0xbc9a68,range:3,cone:0.8,cost:3,interval:0.3,force:0,description:'Chew a small hole in ground ahead',life:0},
  {id:'firework-launcher',name:'FIREWORK LAUNCHER',mode:'firework',color:0xffbd39,range:30,cone:0.98,cost:12,interval:0.7,force:0,description:'Launch an arcing delayed blast',life:0},
 ]
};

export const LANDMARKS = {
 BASINS:[{id:'bandit-locks',offset:[0,0],halfX:5.5,halfZ:13,floor:-3,ramp:6}],
 MAP_KEY:'KeyM',MAP_FONT_SIZE:48,COMPASS_CONE:Math.PI/6,
 DETAIL_PARTS:[[[1.8,.22,.65],[0,.3,0],17],[[1.8,.6,.22],[0,.65,.35],17],[[.22,.7,.65],[-.6,0,0],31],[[.22,.7,.65],[.6,0,0],31]],
 PARCEL_MARGIN:4,PARCEL_BLEND:4,SITE_STEP:8,SEARCH_RADIUS:320,MAX_GRADE_SPAN:3,MIN_SEPARATION:85,APPROACH_MAX:80,PATH_HALF:2,MIN_SPAWN_DISTANCE:80,
 STREAM_RADIUS:75,DETAIL_LIMIT:24,FOOD_LIMIT:4,REFRESH:.5,PROP_MASS:24,PROP_LIFT:2,PROP_SPEED:5,PROP_SIZE:1.8,CACHE_GAP:2,MAP_SCALE:2000,
 MATERIAL_ROUGHNESS:.85,SIGN_WIDTH:4,SIGN_HEIGHT:1.2,SIGN_LIFT:3,MAP_COLOR:'#ffe1a0',MAP_WATER:'#183847',MAP_LAND:'#53785c',FOOD_IDS:['whole-pizza','old-banana','cold-fries','pizza-slice'],
 SITES:[
  {id:'space-noodle',name:'Space Noodle',preferred:[-150,-130]},
  {id:'picky-place',name:'Picky Place',preferred:[-365,80]},
  {id:'frumont-troll',name:'Frumont Troll',preferred:[-60,-430]},
  {id:'gas-guzzlers',name:'Gas Guzzlers Park',preferred:[140,-410]},
  {id:'bandit-locks',name:'Bandit Locks',preferred:[-370,-490]},
  {id:'ferry-fiasco',name:'Ferry Fiasco',preferred:[-375,200]},
  {id:'mono-rail-yard',name:'Mono-Rail Yard',preferred:[-190,20]},
  {id:'rainforest-bubbles',name:'Rainforest Bubbles',preferred:[-60,115]},
  {id:'smiff-tower',name:'Smiff Tower',preferred:[-250,210]},
  {id:'great-squeal',name:'Great Squeal',preferred:[-430,0]},
  {id:'museum-of-loud',name:'Museum of Loud',preferred:[-270,-115]},
  {id:'hat-stomps',name:'Hat & Stomps',preferred:[40,330]},
  {id:'volunteer-waterworks',name:'Volunteer Waterworks',preferred:[150,-170]},
  {id:'discovery-light',name:'Discovery Light',preferred:[-650,-270]},
  {id:'big-pinch-diner',name:'Big Pinch Diner',preferred:[-180,570]},
  {id:'banana-snacks',name:'Banana Republic of Snacks',preferred:[390,430]},
 ]
};

// M49: a bounded 2D view; no second render of the voxel city.
export const RADAR = {
 SIZE: 224, PIXEL_RATIO: 2, INTERVAL: 0.2, RANGE: 90, MAX_RANGE: 180, BODY_RANGE_GAIN: 4,
 GRID: 72, CACHE_MARGIN: 1.4, RECENTER: 20, RANGE_EPSILON: 1, CONE_STEPS: 12, SIGHT_STEP: 12, SIGHT_MAX_STEPS: 4, SLOPE_REFINE: 5, MAX_CONTACTS: 16, SIGHT_BUDGET_MS: 1, SIGHT_RAYS_PER_FRAME: 12,
 SIGHT_POSITION_EPS: .25, SIGHT_ANGLE_EPS: .035, SIGHT_RANGE_EPS: .5,
 MARKER: 4, PLAYER_SIZE: 7, NORTH_FONT: 12, NORTH_TOP: 16, LINE: 1.2, SEARCH_ALPHA: 0.09, CONE_ALPHA: 0.13,
 MAP_COLORS: ['#233b3a','#526c70','#455957','#2d5144','#68706a','#173749','#79918a'],
 UNDERGROUND: '#192329', TUNNEL: '#657977', BUILDING: '#82928b', BUILDING_EDGE: '#384b49',
 PLAYER: '#fff7d4', WAYPOINT: '#a9e4ff', TEXT: '#f0efdf', GRID_COLOR: '#d6e4db15',
 PATROL: '#83b7c9', NOTICE: '#ffde76', CHASE: '#ff766e', SEARCH: '#e9ad67', STRIKE: '#ee89c4',
 TANK_SIGHT: 110, TANK_SEARCH_SECONDS: 24, TANK_SEARCH_RADIUS: 28,
};

// M52: bound active contact and walking support independently of visual distance.
export const RUBBLE = {
 GRID:4, SURFACE_MASS:3, FLOOR_SPEED:1.5, EPSILON:1e-7, SKIN:.015,
 ACTOR_GROUP:8, ACTOR_MASK:7, ACTOR_LIMIT:160, ACTOR_RANGE:90, ACTOR_TELEPORT:6,
 HUMAN_HALF:[.3,.78,.25], HUMAN_OFFSET:[0,.84,0], ANIMAL_MIN:.1, ANIMAL_MAX:1.6,
 HIT_MASS:6, HIT_SPEED:2.5, HIT_MOMENTUM:45, HIT_COOLDOWN:1, HIT_POWER:.6,
 SPAWN_GRACE:.8, SPAWN_SEPARATION:.75, CLOD_MASS:8, CLOD_HALF:.32,
 PUSH_RATIO:.5, STACK_GAP:.08,
};
