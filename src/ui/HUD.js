import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

export class HUD {
  constructor() {
    this.scoreEl = document.getElementById('score');
    this.comboEl = document.getElementById('combo');
    this.popupsEl = document.getElementById('popups');
    this.render();
    eventBus.on(Events.SCORE_CHANGED, () => this.render());
    eventBus.on(Events.COMBO_CHANGED, () => this.render());
    eventBus.on(Events.PLAYER_PICKUP, ({ name }) => this.stinger(`JIMOTHY ACQUIRES ${name}`));
  }

  render() {
    this.scoreEl.textContent = `SCORE ${gameState.player.score}`;
    const c = gameState.player.combo;
    this.comboEl.textContent = c > 1 ? `COMBO x${c}` : '';
  }

  stinger(text) {
    if (!this.popupsEl) return;
    const el = document.createElement('div');
    el.className = 'stinger';
    el.textContent = text;
    // Slop: every popup lands slightly crooked, like it was slapped on.
    el.style.setProperty('--tilt', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
    this.popupsEl.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
}
