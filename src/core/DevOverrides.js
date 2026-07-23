import { GROUPS, TUNABLES } from './Tunables.js';
import { KEYBINDS } from './Constants.js';

// [min, max] lookup for sanitising stored values — a zeroed SPEED that
// slipped into storage once froze movement on one machine forever.
const RANGES = {};
for (const { group, fields } of TUNABLES) {
  RANGES[group] = fields;
}

// Pristine defaults captured at module load, before apply() ever mutates the
// live map — the fallback when stored binds are empty or corrupted.
const DEFAULT_KEYBINDS = JSON.parse(JSON.stringify(KEYBINDS));

// Runtime tuning/keybind/layout overrides, persisted so a reload doesn't lose
// an in-progress tuning session. Constants.js remains the source of truth for
// defaults — DevTools' "copy JSON" is the path for baking values back in.
const STORAGE_KEY = 'jimothy-dev';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const DevOverrides = {
  // Mutates the live Constants objects in place — call before systems construct.
  // Only keys registered in TUNABLES are applied, clamped to their ranges, so
  // corrupted/out-of-range storage self-heals instead of breaking the game.
  apply() {
    const data = load();
    for (const [group, fields] of Object.entries(data.tuning || {})) {
      if (!GROUPS[group] || !RANGES[group]) continue;
      for (const [key, val] of Object.entries(fields)) {
        const range = RANGES[group][key];
        if (!range || typeof GROUPS[group][key] !== 'number' || !Number.isFinite(val)) continue;
        GROUPS[group][key] = Math.min(range[1], Math.max(range[0], val));
      }
    }
    for (const [action, codes] of Object.entries(data.keybinds || {})) {
      if (!Array.isArray(KEYBINDS[action]) || !Array.isArray(codes)) continue;
      // Keep only plausible key codes; an action must never end up bind-less,
      // or the key stays dead across every refresh.
      const valid = codes.filter((c) => typeof c === 'string' && c.length > 0 && c.length < 32);
      const next = valid.length ? valid : DEFAULT_KEYBINDS[action];
      KEYBINDS[action].splice(0, KEYBINDS[action].length, ...next);
    }
  },

  saveTuning(group, key, value) {
    const data = load();
    data.tuning = data.tuning || {};
    data.tuning[group] = data.tuning[group] || {};
    data.tuning[group][key] = value;
    save(data);
  },

  saveKeybinds() {
    const data = load();
    data.keybinds = Object.fromEntries(
      Object.entries(KEYBINDS).map(([a, codes]) => [a, [...codes]]),
    );
    save(data);
  },

  saveCanLayout(layout) {
    const data = load();
    data.cans = layout;
    save(data);
  },

  getCanLayout() {
    const layout = load().cans;
    return Array.isArray(layout) && layout.length ? layout : null;
  },

  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
