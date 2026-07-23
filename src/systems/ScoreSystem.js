import { SCORE } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

export class ScoreSystem {
  constructor() {
    this.comboTimer = 0;
    eventBus.on(Events.GAME_RESTART, () => { this.comboTimer = 0; });
    eventBus.on(Events.PLAYER_PICKUP, () => {
      if (!gameState.game.isPlaying) return;
      const p = gameState.player;
      // Combo only chains while the window is live; a cold pickup starts at x1.
      p.combo = this.comboTimer > 0 ? Math.min(p.combo + 1, SCORE.COMBO_MAX_MULTIPLIER) : 1;
      this.comboTimer = SCORE.COMBO_WINDOW_SECONDS;
      p.score += SCORE.SNACK * p.combo;
      p.snacksEaten += 1;
      eventBus.emit(Events.SCORE_CHANGED, { score: p.score });
      eventBus.emit(Events.COMBO_CHANGED, { combo: p.combo });
    });
  }

  update(delta) {
    if (this.comboTimer <= 0) return;
    this.comboTimer -= delta;
    if (this.comboTimer <= 0) {
      this.comboTimer = 0;
      if (gameState.player.combo !== 1) {
        gameState.player.combo = 1;
        eventBus.emit(Events.COMBO_CHANGED, { combo: 1 });
      }
    }
  }
}
