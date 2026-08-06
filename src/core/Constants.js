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
    // Terrain is not a target. A flat headbutt cratering the road turned every
    // swing into a hole he then had to climb out of; digging becomes something
    // you deliberately AIM at once the aimable headbutt lands (backlog).
    DIGS_TERRAIN: false,
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
  // Fraction of waddle speed lost at the fat asymptote…
  SPEED_PENALTY_MAX: 0.45,
  // …and how fast bushes stop fitting: effective hide radius shrinks by this
  // per unit of body-width gain, until the blob simply doesn't fit.
  HIDE_SQUEEZE: 2.5,
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
};

export const ANIMAL_CONTROL = {
  SPEED: 5,
  NET_RANGE: 1.1,
  MIN_TIER: 3,
};

// Shared by all pursuer types, round-robin — deterministic for tests.
export const PURSUER_SPAWN_POINTS = [
  [-25, -25], [25, -25], [25, 25], [-25, 25],
  [0, -25], [25, 0], [0, 25], [-25, 0],
];

// Hiding is the only pressure valve, so bushes have to be reachable from
// anywhere. Four of them clustered near spawn was fine on a 50 m block and
// useless once the city grew to 500 m — spread across the district on the
// block grid, with a couple kept close to spawn and the den.
export const HIDE_SPOTS = {
  RADIUS: 2,
  POSITIONS: (() => {
    const spots = [[-20, -20], [18, 8], [-6, 18], [22, -18]];
    for (let x = -220; x <= 220; x += 68) {
      for (let z = -220; z <= 220; z += 68) {
        if (Math.hypot(x, z) < 40) continue; // spawn area already covered
        spots.push([x + 4, z - 4]);
      }
    }
    return spots;
  })(),
};

export const SCORE = {
  // Per-food points live on FOODS; combo behavior lives here.
  TREE_LOOT: 50,
  COMBO_WINDOW_SECONDS: 4,
  COMBO_MAX_MULTIPLIER: 10,
};

export const WORLD = {
  BLOCK_SIZE: 1200,
  // Playable square: Jimothy is clamped here; physics walls sit just outside.
  // 250 = ~5× the AREA of the previous district (110 → 250 is 2.3× per side).
  // 5× per SIDE was measured and rejected for now: 19 s boot, 1007 draw calls,
  // 3.5 GB heap, because undamaged ground voxels are allocated up front for
  // the whole map. Streaming/virtual ground (see docs/roadmap.md) is the
  // prerequisite for going bigger; this is the largest size that boots fast.
  BOUNDS: 250,
  GRAVITY: 9.8,
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
  // Downtown rises toward the middle; the edges stay residential.
  DOWNTOWN_RADIUS: 45,
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
  NEAR: 0.1,
  FAR: 500,
  FOLLOW_DISTANCE: 7,
  FOLLOW_HEIGHT: 3.5,
  LOOK_HEIGHT: 0.8,
  FOLLOW_LERP: 4,
  // Orbit mode (pointer locked): mouse-driven yaw/pitch around Jimothy.
  MOUSE_SENS: 0.0025,
  PITCH_MIN: 0.05,
  PITCH_MAX: 1.35,
};

export const COLORS = {
  SKY: 0xffd9a0,          // golden hour
  FOG: 0xf2c98c,
  AMBIENT: 0x8a7a9a,
  SUN: 0xffe3b3,
  GROUND: 0x5d8a4a,
  WALL: 0x8d8578,
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
};

// Runtime model splitter (milestone 06): one full Meshy GLB cut into
// head/body/tail at load time — no Blender, no rigging.
export const RIG = {
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
  // Ground is a real voxel slab so craters are possible, not a flat plane.
  // Two layers: diggable dirt over indestructible bedrock.
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
  },
  // Bedrock can't be destroyed. Without a floor, a roll digs straight through
  // every ground layer and leaves Jimothy stranded metres below grade in a
  // pit he can't climb (playtest 2026-07-23).
  BEDROCK: 7,
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
