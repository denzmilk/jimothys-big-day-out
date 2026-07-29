import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

export class HUD {
  constructor() {
    this.scoreEl = document.getElementById('score');
    this.fatEl = document.getElementById('fat');
    this.heatEl = document.getElementById('heat');
    this.comboEl = document.getElementById('combo');
    this.popupsEl = document.getElementById('popups');
    this.flashEl = document.getElementById('flash');
    this.render();
    eventBus.on(Events.SCORE_CHANGED, () => this.render());
    eventBus.on(Events.COMBO_CHANGED, () => this.render());
    eventBus.on(Events.HEAT_CHANGED, () => this.render());
    eventBus.on(Events.GAME_RESTART, () => this.render());
    eventBus.on(Events.PLAYER_PICKUP, ({ name }) => this.stinger(`JIMOTHY ACQUIRES ${name}`));
    eventBus.on(Events.PLAYER_EATING, () => this.stinger('NOM NOM NOM…'));
    eventBus.on(Events.PLAYER_STUNNED, () => this.cameraFlash());
  }

  render() {
    this.scoreEl.textContent = `SCORE ${gameState.player.score}`;
    this.fatEl.textContent = `FAT ${gameState.player.fatness}`;
    const tier = gameState.heat.tier;
    this.heatEl.textContent = `HEAT ${'★'.repeat(tier)}${'☆'.repeat(5 - tier)}`;
    const c = gameState.player.combo;
    this.comboEl.textContent = c > 1 ? `COMBO x${c}` : '';
  }

  cameraFlash() {
    if (!this.flashEl) return;
    this.flashEl.classList.remove('flashing');
    // Force a reflow so back-to-back flashes restart the animation.
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('flashing');
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
