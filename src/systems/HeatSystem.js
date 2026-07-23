import { HEAT } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

// Chaos in, wanted-stars out. SOURCES maps chaos events to the HEAT constant
// naming their point value — values are read at emit time so they stay
// dev-panel tunable, and future chaos (scared locals, powerup mischief) is
// one entry here plus one constant.
const SOURCES = {
  [Events.CAN_TIPPED]: 'PER_CAN_TIPPED',
};

export class HeatSystem {
  constructor() {
    for (const [event, key] of Object.entries(SOURCES)) {
      eventBus.on(event, () => {
        if (!gameState.game.isPlaying) return;
        gameState.heat.points += HEAT[key];
        this._retier();
      });
    }
  }

  _retier() {
    const { heat } = gameState;
    let tier = 0;
    while (
      tier < HEAT.MAX_TIER &&
      heat.points >= HEAT.TIER_THRESHOLDS[tier + 1]
    ) tier += 1;
    if (tier !== heat.tier) {
      heat.tier = tier;
      eventBus.emit(Events.HEAT_CHANGED, { points: heat.points, tier });
    }
  }

  update(delta) {
    if (!gameState.game.isPlaying) return;
    const { heat, player } = gameState;
    if (player.hidden && heat.points > 0) {
      heat.points = Math.max(0, heat.points - HEAT.DECAY_PER_SECOND_HIDDEN * delta);
      this._retier();
    }
  }
}
