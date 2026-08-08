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
  RADIUS: 0.55,
  PICKUP_RADIUS: 1.0,
  BONK_MIN_SPEED: 2,
  WADDLE_BOB_HZ: 3.2,
  WADDLE_BOB_AMPLITUDE: 0.08,
};

export const INPUT = {
  DEADZONE: 0.15,
  GAMEPAD_HOP_BUTTON: 0,
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
  SCURRY: ['ShiftLeft', 'ShiftRight'],
  POINTER_LOCK: ['KeyL'],
  DEVTOOLS: ['Backquote'],
  RESTART: ['KeyR'],
  HEADBUTT: ['KeyB', 'KeyE'],
  ROLL: ['KeyC'],
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
    // Terrain is not a target — unless you point at it (milestone 20). A flat
    // headbutt cratering the road turned every swing into a hole he then had to
    // climb out of (playtest 2026-07-23), and this flag was the fix. It was
    // never "Jimothy cannot dig", it was "an unaimed dig is an accident".
    //
    // AIMABLE hands the decision to `DIG_ANGLE` instead: terrain is a target
    // only when the camera is looking more than this far below horizontal. The
    // default follow pitch is 0.47 rad, comfortably under it, so an ordinary
    // swing behaves exactly as it did.
    DIGS_TERRAIN: false,
    AIMABLE: true,
    // Measured from the RESTING camera pitch, not from the horizon. Roughly
    // half the available downward travel: past halfway is the dig.
    DIG_ANGLE: 0.5,
    // …and once he is THIS far under his own column's surface, terrain is a
    // target whatever the aim (JIM-40). DIG_ANGLE exists to stop a flat swing
    // cratering the street; there is no street down a tunnel, and the gate made
    // digging sideways impossible — measured at 0 voxels removed for a flat
    // swing against 11 for an aimed-down one, from the same spot in a sewer.
    // Deep enough that standing in a puddle of a crater does not count.
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
    // A roll scrapes what it passes; it does not bore a tunnel. Five ticks of
    // a fat blast radius trenched whole streets (playtest 2026-08-06).
    RADIUS_SCALE: 0.55,
    // …and it only inherits a slice of the fatness bonus, so getting fat makes
    // you a better demolisher without making the flop a bulldozer.
    FAT_BLAST_SHARE: 0.3,
    DIGS_TERRAIN: false,
    // Destruction ticks along the roll rather than one big sphere.
    TICKS: 5,
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
  // Fat units at which visual bulk reaches half its maximum (asymptotic).
  SOFTCAP: 25,
  MAX_WIDTH_GAIN: 0.9,
  MAX_HEIGHT_GAIN: 0.25,
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
  // …and how fast bushes stop fitting: effective hide radius shrinks by this
  // per unit of body-width gain, until the blob simply doesn't fit.
  HIDE_SQUEEZE: 2.5,
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
  FATNESS_MAX: 200,
  // Named stops, so "how fat is fat" is one click rather than a guess. The
  // numbers are the curve's own landmarks: SOFTCAP is where bulk reaches half
  // its maximum, and 90 is the fatness milestone 20 measured its 19.7 m shaft
  // at, so it is the one everything else in the docs is comparable to.
  FATNESS_PRESETS: [['Lean', 0], ['Chunky', 25], ['Gorged', 90], ['Absolute unit', 200]],
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
  // Tier thresholds in heat points; tiers 4-5 stay unreachable until
  // milestone 03 adds more chaos sources.
  TIER_THRESHOLDS: [0, 10, 20, 35, 60, 100],
  DECAY_PER_SECOND_HIDDEN: 2,
  PER_CAN_TIPPED: 5,
  PER_TREE_LOOT: 3,
  PER_SCARED_LOCAL: 3,
  PER_DEMOLITION: 0.4, // per voxel destroyed — levelling a house is chaos
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
  WANDER_RADIUS: 9,
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
  COUNT: 26,
  SPEED: 1.4,
  // Wander target reached → pick a new one.
  ARRIVE_RADIUS: 1.5,
  // Jimothy this close sends them fleeing (and that's chaos → heat).
  SCARE_RADIUS: 5,
  FLEE_SPEED: 4.2,
  FLEE_SECONDS: 3.5,
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
  // Orbit mode (pointer locked): mouse-driven yaw/pitch around Jimothy.
  MOUSE_SENS: 0.0025,
  PITCH_MIN: 0.05,
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
  // Chunky on purpose (playtest 2026-07-23: "voxel parts are very small").
  // Big blocks read as destruction from across the street and cost less to
  // mesh; fine detail is not the aesthetic here.
  SIZE: 0.55,
  // Chunks are WIDE and SHALLOW, not cubic. Draw calls scale with the
  // horizontal chunk count while the world is mostly flat, so a cube wastes
  // its height budget on empty sky. 64×12×64 holds the same voxel count as
  // the old 32³ (so re-mesh cost per blast is unchanged) while covering 4×
  // the ground area per draw call — which is what lets the city grow and the
  // voxels shrink at the same time.
  CHUNK_XZ: 64,
  CHUNK_Y: 12,
  // A skinny raccoon is not a wrecking ball. Base radius barely scratches
  // paint — real demolition is earned by eating (FATNESS.BLAST_PER_FAT).
  BLAST_RADIUS: 0.75,
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
    12: { name: 'sand', color: 0xc9b184 },
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
  // which matters because the sea is not a place you can swim yet.
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
  WIDTH: 3.6,
  HEIGHT: 2.9,
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
  SHAFT: 5,
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
  COUNT: 22,        // live at once, streamed around him like everything else
  SPEED: 1.7,
  SCUTTLE_SPEED: 4.4,
  // Jimothy this close and they scatter. They are not a threat and not a score
  // — play it straight and let the absurdity do the work.
  ALARM_RADIUS: 7,
  SCUTTLE_SECONDS: 3,
  SIZE: 0.34,
  COLOR: 0xc9502f,
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
  TUBE_RADIUS: 0.09,
  FOOT_RADIUS: 0.11,
  // Hip anchor offsets in bodySlot space [x, y, z] — mirrored for left/right.
  HIP_X: 0.32,
  HIP_Y: 0.35,
  HIP_Z: 0.38,
  // Step when the planted foot drifts this far from its home under the hip.
  STEP_THRESHOLD: 0.45,
  STEP_SECONDS: 0.13,
  STEP_LIFT: 0.22,
  // Feet lead the body by velocity × this, so the trot reads as walking.
  STRIDE_LEAD: 0.12,
  // Real-leg swing mode: crude diagonal-pair flailing, on purpose.
  SWING_HZ: 1.4,
  SWING_AMPLITUDE: 0.75,
  SWING_MIN: 0.06,
};
