class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    this.on(event, wrapper);
  }

  off(event, callback) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      cbs.delete(callback);
      if (cbs.size === 0) this.listeners.delete(event);
    }
  }

  emit(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs) cbs.forEach(cb => {
      try { cb(data); } catch (e) { console.error(`EventBus error [${event}]:`, e); }
    });
  }

  clear(event) {
    event ? this.listeners.delete(event) : this.listeners.clear();
  }
}

export const eventBus = new EventBus();

// Define ALL events as constants — use domain:action naming
export const Events = {
  // player:*
  PLAYER_PICKUP: 'player:pickup',
  PLAYER_EATING: 'player:eating',
  PLAYER_STUNNED: 'player:stunned',
  PLAYER_LAUNCHED: 'player:launched',
  PLAYER_NETTED: 'player:netted',
  // can:*
  CAN_TIPPED: 'can:tipped',
  // local:*
  LOCAL_SCARED: 'local:scared',
  // world:*
  WORLD_DEMOLISHED: 'world:demolished',
  // underground:* (milestone 18)
  TREASURE_FOUND: 'treasure:found',
  CRAB_ALARMED: 'crab:alarmed',
  // heat:*
  HEAT_CHANGED: 'heat:changed',
  // score:*
  SCORE_CHANGED: 'score:changed',
  COMBO_CHANGED: 'combo:changed',
  // rig:*
  RIG_LOADED: 'rig:loaded',
  // game:*
  GAME_START: 'game:start',
  GAME_OVER: 'game:over',
  GAME_RESTART: 'game:restart',
  // dev:* — DevTools panel; gameplay modules subscribe, panel never imports them
  DEV_TUNING_CHANGED: 'dev:tuning-changed',
  DEV_SPAWN_CAN: 'dev:spawn-can',
  DEV_REMOVE_CAN: 'dev:remove-can',
  DEV_RESET_CANS: 'dev:reset-cans',
  DEV_CANS_CHANGED: 'dev:cans-changed',
};
