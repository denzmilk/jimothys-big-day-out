import { KEYBINDS } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';

export class GameOverScreen {
  constructor() {
    this.el = document.getElementById('game-over');
    this.finalEl = document.getElementById('final-score');
    this.bestEl = document.getElementById('best-score');

    eventBus.on(Events.GAME_OVER, ({ score, best }) => {
      this.finalEl.textContent = `FINAL FATNESS: ${score}`;
      this.bestEl.textContent = `PERSONAL BEST: ${best}`;
      this.el.classList.remove('hidden');
    });
    eventBus.on(Events.GAME_RESTART, () => this.el.classList.add('hidden'));

    document.getElementById('restart-btn').addEventListener('click', () => this._restart());
    window.addEventListener('keydown', (e) => {
      // R only restarts from the capture screen — never mid-run.
      if (!this.el.classList.contains('hidden') && KEYBINDS.RESTART.includes(e.code)) {
        this._restart();
      }
    });
  }

  _restart() {
    eventBus.emit(Events.GAME_RESTART);
  }
}
