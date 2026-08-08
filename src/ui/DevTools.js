import { KEYBINDS, DEV, FATNESS, VOXEL, HIDE_SPOTS, PLAYER_CONFIG } from '../core/Constants.js';
import { GROUPS, TUNABLES } from '../core/Tunables.js';
import { DevOverrides } from '../core/DevOverrides.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { fatFactor } from '../core/MathUtils.js';

// In-game tuning/debug panel. Talks to gameplay only via dev:* EventBus
// events — it never writes to GameState or to a system directly. It READS
// live player state off `gameState`, the same way the HUD does; the snapshot
// is for anything that would mean walking the world (the can layout export).
export class DevTools {
  constructor(input) {
    this.input = input;
    this.debugTimer = 0;
    this._buildDom();

    eventBus.on(Events.DEV_CANS_CHANGED, ({ layout }) => {
      DevOverrides.saveCanLayout(layout);
      if (layout && this.layoutJson.value) {
        this.layoutJson.value = JSON.stringify(layout);
      }
    });

    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (KEYBINDS.DEVTOOLS.includes(e.code)) this.toggle();
    });
  }

  toggle() {
    const hidden = this.panel.classList.toggle('hidden');
    // A focused tuning field would otherwise keep swallowing gameplay keys
    // after the panel closes.
    if (hidden && this.panel.contains(document.activeElement)) document.activeElement.blur();
  }

  _buildDom() {
    this.panel = document.createElement('div');
    this.panel.id = 'devtools';
    this.panel.className = 'hidden';

    const head = document.createElement('div');
    head.className = 'dt-head';
    head.textContent = 'JIMOTHY DEV TOOLS';
    const close = document.createElement('button');
    close.textContent = '×';
    close.addEventListener('click', () => this.toggle());
    head.appendChild(close);
    this.panel.appendChild(head);

    const tabs = document.createElement('div');
    tabs.className = 'dt-tabs';
    this.sections = {};
    for (const [id, label] of [
      ['tune', 'Tune'], ['jimothy', 'Jimothy'], ['keys', 'Keys'], ['level', 'Level'],
    ]) {
      const btn = document.createElement('button');
      btn.dataset.tab = id;
      btn.textContent = label;
      btn.addEventListener('click', () => this._showTab(id));
      tabs.appendChild(btn);
      const section = document.createElement('div');
      section.className = 'dt-section';
      section.dataset.section = id;
      this.sections[id] = section;
    }
    this.panel.appendChild(tabs);
    for (const s of Object.values(this.sections)) this.panel.appendChild(s);

    this._buildTuneTab();
    this._buildJimothyTab();
    this._buildKeysTab();
    this._buildLevelTab();
    this._showTab('tune');

    document.body.appendChild(this.panel);

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'devtools-toggle';
    toggleBtn.textContent = '⚙';
    toggleBtn.title = 'Dev tools (`)';
    toggleBtn.addEventListener('click', () => this.toggle());
    document.body.appendChild(toggleBtn);
  }

  _showTab(id) {
    for (const [key, section] of Object.entries(this.sections)) {
      section.style.display = key === id ? '' : 'none';
    }
    this.activeTab = id;
  }

  // --- Tune ---

  _buildTuneTab() {
    const root = this.sections.tune;
    for (const { group, label, fields } of TUNABLES) {
      const fs = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = label;
      fs.appendChild(legend);
      for (const [key, [min, max]] of Object.entries(fields)) {
        fs.appendChild(this._tuneRow(group, key, min, max));
      }
      root.appendChild(fs);
    }

    const reset = document.createElement('button');
    reset.id = 'dt-reset-overrides';
    reset.textContent = 'Reset all overrides (reload)';
    reset.addEventListener('click', () => {
      DevOverrides.clearAll();
      location.reload();
    });
    root.appendChild(reset);
  }

  _tuneRow(group, key, min, max) {
    const row = document.createElement('div');
    row.className = 'dt-row';
    row.id = `dt-${group}-${key}`;
    const label = document.createElement('label');
    label.textContent = key;
    const range = document.createElement('input');
    range.type = 'range';
    const number = document.createElement('input');
    number.type = 'number';
    const step = max - min > 10 ? 0.5 : (max - min) / 200;
    for (const input of [range, number]) {
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = GROUPS[group][key];
    }
    const apply = (raw) => {
      if (!Number.isFinite(raw)) return;
      // Typed values bypass the range input's min/max — clamp or a stray 0
      // in SPEED/ACCEL bricks movement and persists.
      const val = Math.min(max, Math.max(min, raw));
      GROUPS[group][key] = val;
      range.value = val;
      number.value = val;
      DevOverrides.saveTuning(group, key, val);
      eventBus.emit(Events.DEV_TUNING_CHANGED, { group, key, value: val });
    };
    range.addEventListener('input', () => apply(parseFloat(range.value)));
    number.addEventListener('input', () => apply(parseFloat(number.value)));
    row.append(label, range, number);
    return row;
  }

  // --- Jimothy ---
  //
  // Live RUN state, which is why it is not in the Tune tab: those rows mutate
  // Constants and persist to localStorage, and a fatness that survived a reload
  // would be a save file nobody asked for. Chris, 2026-08-08: "add a fatness
  // scale so I can add power/fatness to Jimothy from the dev menu."

  _buildJimothyTab() {
    const root = this.sections.jimothy;

    const fs = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Fatness';
    fs.appendChild(legend);

    const row = document.createElement('div');
    row.className = 'dt-row';
    row.id = 'dt-fatness';
    const label = document.createElement('label');
    label.textContent = 'FAT';
    this.fatRange = document.createElement('input');
    this.fatRange.type = 'range';
    this.fatNumber = document.createElement('input');
    this.fatNumber.type = 'number';
    for (const input of [this.fatRange, this.fatNumber]) {
      input.min = 0;
      input.max = DEV.FATNESS_MAX;
      input.step = 1;
      input.value = gameState.player.fatness;
      input.addEventListener('input', () => this._setFatness(parseFloat(input.value)));
    }
    // Typing past the slider's max is allowed and deliberate: fatness has no
    // real ceiling, and JIM-24 ("as big as a house") is a live question about
    // what happens out there. The slider covers the range that still changes
    // something; the box does not stop you looking further.
    this.fatNumber.max = '';
    row.append(label, this.fatRange, this.fatNumber);
    fs.appendChild(row);

    const presets = document.createElement('div');
    presets.className = 'dt-row';
    presets.id = 'dt-fatness-presets';
    for (const [name, value] of DEV.FATNESS_PRESETS) {
      const btn = document.createElement('button');
      btn.className = 'dt-chip';
      btn.dataset.fatness = String(value);
      btn.textContent = name;
      btn.addEventListener('click', () => this._setFatness(value));
      presets.appendChild(btn);
    }
    fs.appendChild(presets);
    root.appendChild(fs);

    // What the number BUYS. Fatness is the game's whole power curve, and every
    // consequence is a different asymptote of the same factor — so a bare
    // "FAT 90" tells you nothing about whether 90 is a lot. Derived through
    // `fatFactor` rather than re-typed here, or this readout would be the fifth
    // copy of that formula and the one place a drift would be invisible.
    this.powerEl = document.createElement('pre');
    this.powerEl.id = 'dt-fatness-power';
    root.appendChild(this.powerEl);
    this._refreshFatness();
  }

  _setFatness(raw) {
    if (!Number.isFinite(raw)) return;
    eventBus.emit(Events.DEV_SET_FATNESS, { value: Math.max(0, raw) });
    this._refreshFatness();
  }

  /** Pull the controls back onto the real value. Called per frame while the tab
   *  is open, so eating a feast moves the slider instead of leaving it lying
   *  about what Jimothy currently is. */
  _refreshFatness() {
    const fat = gameState.player.fatness;
    // Skip while the box is focused, or reformatting mid-keystroke fights the
    // typist — "1" becomes "1" again the instant they reach for the 0.
    if (document.activeElement !== this.fatNumber) this.fatNumber.value = +fat.toFixed(1);
    if (document.activeElement !== this.fatRange) this.fatRange.value = fat;

    const f = fatFactor(fat);
    const width = 1 + f * FATNESS.MAX_WIDTH_GAIN;
    // Deliberately the UNCLAMPED squeeze. The controller clamps this at 0, and
    // at the top of the range the squeeze consumes the radius exactly — which
    // leaves a positive float crumb, so `> 0` reported "0.00 m radius" for a
    // bush that mathematically cannot hold him. The raw value is the one that
    // knows the difference between just fitting and not fitting at all.
    const hide = HIDE_SPOTS.RADIUS - (width - 1) * FATNESS.HIDE_SQUEEZE;
    this.powerEl.textContent = [
      `factor  ${f.toFixed(3)}  softcap ${FATNESS.SOFTCAP}`,
      `blast   ${(VOXEL.BLAST_RADIUS + f * FATNESS.BLAST_PER_FAT).toFixed(2)} m` +
        `  (lean ${VOXEL.BLAST_RADIUS})`,
      `width   x${width.toFixed(2)}`,
      `speed   ${(PLAYER_CONFIG.SPEED * (1 - f * FATNESS.SPEED_PENALTY_MAX)).toFixed(2)}` +
        `  (lean ${PLAYER_CONFIG.SPEED})`,
      `bush    ${hide > 0.01 ? `fits, ${hide.toFixed(2)} m radius` : 'NO — too fat to hide'}`,
    ].join('\n');
  }

  // --- Keys ---

  _buildKeysTab() {
    const root = this.sections.keys;
    this.debugEl = document.createElement('pre');
    this.debugEl.id = 'dt-input-debug';
    root.appendChild(this.debugEl);

    for (const action of Object.keys(KEYBINDS)) {
      const row = document.createElement('div');
      row.className = 'dt-row';
      const label = document.createElement('label');
      label.textContent = action;
      row.appendChild(label);
      KEYBINDS[action].forEach((code, i) => {
        const chip = document.createElement('button');
        chip.className = 'dt-chip';
        chip.dataset.action = action;
        chip.dataset.index = String(i);
        chip.textContent = code;
        chip.addEventListener('click', () => this._capture(chip, action, i));
        row.appendChild(chip);
      });
      root.appendChild(row);
    }
  }

  _capture(chip, action, index) {
    chip.textContent = 'press key…';
    // Capture phase beats the InputSystem's bubble listener on window.
    window.addEventListener(
      'keydown',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        KEYBINDS[action][index] = e.code;
        chip.textContent = e.code;
        DevOverrides.saveKeybinds();
      },
      { capture: true, once: true },
    );
  }

  // --- Level ---

  _buildLevelTab() {
    const root = this.sections.level;
    const mk = (id, label, fn) => {
      const btn = document.createElement('button');
      btn.id = id;
      btn.textContent = label;
      btn.addEventListener('click', fn);
      root.appendChild(btn);
      return btn;
    };
    mk('dt-spawn-can', 'Spawn can ahead', () => eventBus.emit(Events.DEV_SPAWN_CAN));
    mk('dt-remove-can', 'Remove nearest can', () => eventBus.emit(Events.DEV_REMOVE_CAN));
    mk('dt-reset-cans', 'Reset can layout', () => eventBus.emit(Events.DEV_RESET_CANS));
    // The other half of what Chris asked for (milestone 20): a way to go and
    // look at the underground without digging down to it first. The headbutt is
    // the GAME's answer; this is the inspection one.
    mk('dt-goto-sewer', 'Drop into the nearest sewer', () =>
      eventBus.emit(Events.DEV_GOTO_SEWER));
    mk('dt-export-layout', 'Copy layout JSON', () => {
      const snapshot = JSON.parse(window.render_game_to_text());
      const layout = snapshot.cans.map((c) => [c.x, c.z]);
      const json = JSON.stringify(layout);
      this.layoutJson.value = json;
      navigator.clipboard?.writeText(json).catch(() => {});
    });
    this.layoutJson = document.createElement('textarea');
    this.layoutJson.id = 'dt-layout-json';
    this.layoutJson.readOnly = true;
    this.layoutJson.placeholder = 'Layout JSON appears here — paste into TRASH_CAN.POSITIONS';
    root.appendChild(this.layoutJson);
  }

  // --- per-frame ---

  update(delta) {
    if (this.panel.classList.contains('hidden')) return;
    this.debugTimer -= delta;
    if (this.debugTimer > 0) return;
    this.debugTimer = 0.1;
    // Eating moves fatness, so the slider has to follow the game rather than
    // only ever push at it — otherwise it sits at whatever was last dialled in
    // and quietly misreports what Jimothy is.
    if (this.activeTab === 'jimothy') this._refreshFatness();
    if (this.activeTab !== 'keys') return;
    const gp = this.input.gamepadInfo;
    this.debugEl.textContent = [
      `keys: ${[...this.input.codes].join(' ') || '—'}`,
      `move: ${this.input.moveX.toFixed(2)}, ${this.input.moveZ.toFixed(2)}  scurry: ${this.input.scurry}`,
      `gamepad: ${gp ? `${gp.id} axes ${gp.axes.join(', ')}` : 'none'}`,
      `pointer lock: ${this.input.pointerLocked}`,
    ].join('\n');
  }
}
