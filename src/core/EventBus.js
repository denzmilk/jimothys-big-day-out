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
  PLAYER_TOOL_MOTION:'player:tool-motion', VEHICLE_TOOL_SLOW:'vehicle:tool-slow',
  FOOD_SHIFT:'food:shift', TOOL_FORCE:'tool:force', TOOL_CHAOS:'tool:chaos', TOOL_CHANGED:'tool:changed', HUMAN_IMPACT:'human:impact',
  FOOD_SPAWN:'food:spawn', FOOD_REMOVE:'food:remove', FOOD_TAKEN:'food:taken',
  DEV_GOTO_INTERIOR:'dev:goto-interior',
  PLAYER_EATING: 'player:eating',
  PLAYER_STUNNED: 'player:stunned',
  PLAYER_LAUNCHED: 'player:launched',
  PLAYER_BODY_READY:'player:body-ready',
  PLAYER_CONTROLLED:'player:controlled',
  PLAYER_CONTACT:'player:contact',
  PLAYER_RECOIL:'player:recoil',
  PLAYER_NETTED: 'player:netted',
  // can:*
  CAN_TIPPED: 'can:tipped',
  // local:*
  LOCAL_SCARED: 'local:scared',
  // world:*
  GRAPHICS_CHANGED:'graphics:changed',
  WORLD_TIME_CHANGED: 'world:time-changed',
  DEV_GOTO_OCEAN: 'dev:goto-ocean',
  SWIM_CONTACT: 'world:swim-contact',
  SWIM_CHANGED: 'player:swim-changed',
  WATER_SAMPLE: 'water:sample',
  WATER_DISTURB: 'water:disturb',
  WORLD_IMPACT: 'world:impact',
  WORLD_BLAST:'world:blast',
  EXPLOSION_SPAWN:'explosion:spawn',
  MILITARY_WARNING:'military:warning',
  GLASS_SHATTER: 'glass:shatter',
  CAR_EXPLODED: 'car:exploded',
  TRAFFIC_OBSTACLES: 'traffic:obstacles',
  ENTITY_LIST: 'entity:list',
  ENTITY_REGISTER: 'entity:register',
  ENTITY_UNREGISTER: 'entity:unregister',
  ENTITY_ATTACH: 'entity:attach',
  ENTITY_RELEASE: 'entity:release',
  PROP_CREATE: 'prop:create',
  PROP_REMOVE: 'prop:remove',
  PROP_POSE: 'prop:pose',
  PROP_IMPULSE: 'prop:impulse',
  PROP_SUSPEND: 'prop:suspend',
  PROP_RELEASE: 'prop:release',
  WORLD_DEMOLISHED: 'world:demolished',
  PROP_UNSUPPORTED: 'prop:unsupported',
  // underground:* (milestone 18)
  TREASURE_FOUND: 'treasure:found',
  CRAB_ALARMED: 'crab:alarmed',
  // heat:*
  HEAT_CHANGED: 'heat:changed',
  // score:*
  SCORE_CHANGED: 'score:changed',
  COMBO_CHANGED: 'combo:changed',
  // rig:*
  HUMAN_REGISTER: 'human:register',
  HUMAN_UNREGISTER: 'human:unregister',
  HUMAN_DOWN: 'human:down',
  RAGDOLL_CREATE: 'ragdoll:create',
  RAGDOLL_REMOVE: 'ragdoll:remove',
  CAPTURE_CHANGED: 'capture:changed',
  HUMAN_MODELS_READY: 'rig:humans-ready',
  RIG_LOADED: 'rig:loaded',
  // game:*
  GAME_START: 'game:start',
  SPAWN_POSE:'spawn:pose', SPAWN_IMPACT:'spawn:impact', SPAWN_COMPLETE:'spawn:complete',
  GAME_OVER: 'game:over',
  GAME_RESTART: 'game:restart',
  // dev:* — DevTools panel; gameplay modules subscribe, panel never imports them
  DEV_TUNING_CHANGED: 'dev:tuning-changed',
  DEV_SPAWN_CAN: 'dev:spawn-can',
  DEV_REMOVE_CAN: 'dev:remove-can',
  DEV_RESET_CANS: 'dev:reset-cans',
  DEV_CANS_CHANGED: 'dev:cans-changed',
  DEV_GOTO_BEACH: 'dev:goto-beach',
  DEV_GOTO_SEWER: 'dev:goto-sewer',
  DEV_SET_TIME: 'dev:set-time',
  DEV_SET_FATNESS: 'dev:set-fatness',
};
