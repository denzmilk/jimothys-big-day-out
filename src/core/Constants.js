export const PLAYER_CONFIG = {
  SPEED: 6,
  SCURRY_SPEED: 10,
  TURN_SPEED: 8,
  HOP_FORCE: 6,
  WADDLE_BOB_HZ: 3.2,
  WADDLE_BOB_AMPLITUDE: 0.08,
};

export const HEAT = {
  MAX_TIER: 5,
  // Tier thresholds in heat points; tuned during development.
  TIER_THRESHOLDS: [0, 10, 25, 50, 90, 140],
  DECAY_PER_SECOND_HIDDEN: 2,
  PER_CAN_TIPPED: 4,
  PER_SNACK: 1,
  PER_TREE_LOOT: 3,
};

export const SCORE = {
  SNACK: 10,
  TREE_LOOT: 50,
  COMBO_WINDOW_SECONDS: 4,
  COMBO_MAX_MULTIPLIER: 10,
};

export const WORLD = {
  BLOCK_SIZE: 80,
  GRAVITY: 9.8,
};

export const CAMERA = {
  FOV: 60,
  NEAR: 0.1,
  FAR: 500,
  FOLLOW_DISTANCE: 7,
  FOLLOW_HEIGHT: 3.5,
};

export const COLORS = {
  SKY: 0xffd9a0,          // golden hour
  FOG: 0xf2c98c,
  AMBIENT: 0x8a7a9a,
  SUN: 0xffe3b3,
  GROUND: 0x5d8a4a,
  PLACEHOLDER_JIMOTHY: 0x6f6a72,
  PLACEHOLDER_TRASH_CAN: 0x3f6f5f,
};

export const ASSET_PATHS = {
  JIMOTHY_MODEL: '/assets/models/jimothy.glb',
};
