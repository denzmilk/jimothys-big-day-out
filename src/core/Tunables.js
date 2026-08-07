import {
  PLAYER_CONFIG, CAMERA, TRASH_CAN, SCORE, WORLD,
  HEAT, PAPARAZZI, ANIMAL_CONTROL, FATNESS, RIG, LEGS, TERRAIN, FLY, STREAM,
} from './Constants.js';

// Registry of what the DevTools Tune tab exposes: group → {field: [min, max]}.
// Groups reference the live Constants objects, so slider changes mutate the
// same objects gameplay reads every frame.
export const GROUPS = {
  PLAYER_CONFIG, CAMERA, TRASH_CAN, SCORE, WORLD,
  HEAT, PAPARAZZI, ANIMAL_CONTROL, FATNESS, RIG, LEGS, TERRAIN, FLY, STREAM,
};

export const TUNABLES = [
  {
    group: 'PLAYER_CONFIG',
    label: 'Player',
    fields: {
      SPEED: [1, 20], SCURRY_SPEED: [1, 25], ACCEL: [5, 100], TURN_SPEED: [1, 20],
      HOP_FORCE: [1, 20], HOP_GRAVITY: [5, 60], PICKUP_RADIUS: [0.3, 3],
    },
  },
  {
    group: 'CAMERA',
    label: 'Camera',
    fields: {
      FOV: [30, 110], FOLLOW_DISTANCE: [2, 20], FOLLOW_HEIGHT: [0.5, 12],
      LOOK_HEIGHT: [0, 3], FOLLOW_LERP: [0.5, 15],
      MOUSE_SENS: [0.0005, 0.01],
    },
  },
  {
    group: 'TRASH_CAN',
    label: 'Trash cans',
    fields: {
      MASS: [1, 40], BONK_IMPULSE: [5, 100], BONK_LIFT: [0, 15],
      TIP_UP_DOT: [0.2, 0.95], BONK_COOLDOWN_SECONDS: [0.05, 2],
    },
  },
  {
    group: 'SCORE',
    label: 'Scoring',
    fields: {
      COMBO_WINDOW_SECONDS: [1, 10], COMBO_MAX_MULTIPLIER: [2, 25],
    },
  },
  {
    group: 'FATNESS',
    label: 'Fatness',
    fields: {
      SOFTCAP: [5, 100], MAX_WIDTH_GAIN: [0.2, 2], MAX_HEIGHT_GAIN: [0, 1],
      JIGGLE_HZ: [2, 20], JIGGLE_DAMPING: [1, 12], KICK_FEAST: [0.05, 0.6],
      JELLY: [0, 0.2], SPEED_PENALTY_MAX: [0, 0.8], HIDE_SQUEEZE: [0, 8],
    },
  },
  {
    group: 'WORLD',
    label: 'World',
    // The range used to be [10, 38] — the old 250-unit map's slider, left
    // behind when BOUNDS became 1000 (milestone 12). Any stored override was
    // being CLAMPED to 38 on load, which would have collapsed the island to a
    // 76 m square with no warning: the same family of bug as the pursuer
    // spawns and the hide-spot grid. JIM-33.
    fields: { BOUNDS: [100, 2000], GRAVITY: [2, 30] },
  },
  {
    group: 'TERRAIN',
    label: 'Terrain',
    // DEPTH's range goes to 250 deliberately: milestone 17's central claim is
    // that boot cost and memory do not move with it, and the spec that asserts
    // that needs a supported way to boot the game at 200 m.
    fields: {
      DEPTH: [5, 250], LAND_GRADE: [0.5, 12], SEABED_DEPTH: [2, 40],
      SHORE_RUN: [8, 120], FLATTEN_RUN: [20, 300], SKIN: [2, 10],
    },
  },
  {
    group: 'FLY',
    label: 'Fly camera',
    fields: { SPEED: [5, 200], BOOST: [1, 20], MOUSE_SENS: [0.0005, 0.01] },
  },
  {
    group: 'STREAM',
    label: 'Streaming',
    // How much of the island is in frame while flying is a judgement, not a
    // constant — and it is the one dial that decides whether the map can be
    // inspected at all. LOAD_RADIUS stays out: raising it changes gameplay
    // memory, which is milestone 12's guarantee and not a slider.
    fields: { FLY_LOAD_RADIUS: [3, 10], FLY_COLUMNS_PER_FRAME: [1, 16] },
  },
  {
    group: 'HEAT',
    label: 'Heat',
    fields: { PER_CAN_TIPPED: [1, 60], DECAY_PER_SECOND_HIDDEN: [0.5, 30] },
  },
  {
    group: 'PAPARAZZI',
    label: 'Paparazzi',
    fields: {
      SPEED: [0.5, 8], FLASH_RANGE: [2, 12], FLASH_COOLDOWN: [0.5, 10],
      STUN_SECONDS: [0.1, 3],
    },
  },
  {
    group: 'ANIMAL_CONTROL',
    label: 'Animal control',
    fields: { SPEED: [0.5, 10], NET_RANGE: [0.5, 3] },
  },
  {
    group: 'RIG',
    label: 'Jimothy rig',
    fields: {
      TARGET_LENGTH: [1, 3], NECK_FRAC: [0.1, 0.5], TAIL_FRAC: [0.03, 0.4],
    },
  },
  {
    group: 'LEGS',
    label: 'Legs',
    fields: {
      TUBE_RADIUS: [0.03, 0.25], HIP_X: [0.1, 0.6], HIP_Z: [0.1, 0.7],
      STEP_THRESHOLD: [0.15, 1.2], STEP_SECONDS: [0.05, 0.4],
      STEP_LIFT: [0, 0.6], STRIDE_LEAD: [0, 0.4],
    },
  },
];
