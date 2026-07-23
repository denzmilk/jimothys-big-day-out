import {
  PLAYER_CONFIG, CAMERA, TRASH_CAN, SCORE, WORLD,
  HEAT, PAPARAZZI, ANIMAL_CONTROL,
} from './Constants.js';

// Registry of what the DevTools Tune tab exposes: group → {field: [min, max]}.
// Groups reference the live Constants objects, so slider changes mutate the
// same objects gameplay reads every frame.
export const GROUPS = {
  PLAYER_CONFIG, CAMERA, TRASH_CAN, SCORE, WORLD,
  HEAT, PAPARAZZI, ANIMAL_CONTROL,
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
      SNACK: [1, 100], COMBO_WINDOW_SECONDS: [1, 10], COMBO_MAX_MULTIPLIER: [2, 25],
    },
  },
  {
    group: 'WORLD',
    label: 'World',
    fields: { BOUNDS: [10, 38], GRAVITY: [2, 30] },
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
];
