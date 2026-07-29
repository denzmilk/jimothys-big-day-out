export const PLAYER_CONFIG = {
  SPEED: 6,
  SCURRY_SPEED: 10,
  ACCEL: 30,
  TURN_SPEED: 8,
  HOP_FORCE: 7,
  HOP_GRAVITY: 20,
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
  // Hand-placed block layout (gameplan: dense, hand-placed, one block).
  POSITIONS: [
    [6, -4], [10, 3], [-7, 6], [-12, -8], [3, 12],
    [-3, -14], [14, -12], [-16, 4], [9, 16], [-11, 14],
  ],
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
};

export const PAPARAZZI = {
  SPEED: 3.5,
  COUNT_TIER1: 2,
  COUNT_TIER2: 4,
  // They stop at photo range and loiter; tier 2+ they flash.
  FLASH_RANGE: 5,
  FLASH_COOLDOWN: 3,
  MIN_TIER_FLASH: 2,
  STUN_SECONDS: 0.8,
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

export const HIDE_SPOTS = {
  RADIUS: 2,
  POSITIONS: [[-20, -20], [18, 8], [-6, 18], [22, -18]],
};

export const SCORE = {
  // Per-food points live on FOODS; combo behavior lives here.
  TREE_LOOT: 50,
  COMBO_WINDOW_SECONDS: 4,
  COMBO_MAX_MULTIPLIER: 10,
};

export const WORLD = {
  BLOCK_SIZE: 80,
  // Playable square: Jimothy is clamped here; physics walls sit just outside.
  BOUNDS: 26,
  GRAVITY: 9.8,
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
  JIMOTHY_MODEL: '/assets/models/jimothy.glb',
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
};
