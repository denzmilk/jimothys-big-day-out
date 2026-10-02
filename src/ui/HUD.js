import { eventBus, Events } from '../core/EventBus.js';
import {GRAPHICS} from '../core/Constants.js';
import { gameState } from '../core/GameState.js';

export class HUD {
  constructor() {
    const quality=document.getElementById('graphics-quality');
    for(const [name,preset]of Object.entries(GRAPHICS.PRESETS)){const option=document.createElement('option');option.value=name;option.textContent=`${name[0].toUpperCase()+name.slice(1)} · ${preset.DISTANCE} m`;quality.appendChild(option);}
    quality.value=gameState.world.graphics?.preset||GRAPHICS.DEFAULT;
    quality.addEventListener('change',()=>eventBus.emit(Events.GRAPHICS_CHANGED,{preset:quality.value}));
    const military=document.getElementById('military-warning');
    eventBus.on(Events.MILITARY_WARNING,({warning})=>{military.textContent=warning;military.hidden=!warning;});
    this.scoreEl = document.getElementById('score');
    this.fatEl = document.getElementById('fat');
    this.heatEl = document.getElementById('heat');
    this.comboEl = document.getElementById('combo');
    this.popupsEl = document.getElementById('popups');
    this.flashEl = document.getElementById('flash');
    this.clockEl = document.getElementById('world-clock');
    const renderClock=()=>{this.clockEl.textContent=gameState.world.timeLabel??'';};
    eventBus.on(Events.WORLD_TIME_CHANGED,renderClock);renderClock();
    eventBus.on(Events.CAPTURE_CHANGED,c=>{
      const meter=document.getElementById('capture-meter');
      meter.hidden=c.progress<=0&&c.phase!=='windup'&&c.phase!=='swing';
      meter.setAttribute('aria-valuenow',String(Math.round(c.progress*100)));
      document.getElementById('capture-fill').style.width=`${c.progress*100}%`;
      document.getElementById('capture-label').textContent=c.holding?'BREAK FREE — ROLL OR HEADBUTT!':c.progress>0?'GET CLEAR OF THE NET!':'NET INCOMING — MOVE!';
    });
    this.render();
    eventBus.on(Events.SCORE_CHANGED, () => this.render());
    eventBus.on(Events.COMBO_CHANGED, () => this.render());
    eventBus.on(Events.HEAT_CHANGED, () => this.render());
    eventBus.on(Events.GAME_RESTART, () => this.render());
    eventBus.on(Events.PLAYER_PICKUP, ({ name }) => this.stinger(`JIMOTHY ACQUIRES ${name}`));
    eventBus.on(Events.PLAYER_EATING, () => this.stinger('NOM NOM NOM…'));
    eventBus.on(Events.PLAYER_STUNNED, () => this.cameraFlash());
    eventBus.on(Events.PLAYER_LAUNCHED, () => this.cameraFlash());
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
