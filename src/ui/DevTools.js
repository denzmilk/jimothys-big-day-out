import { KEYBINDS } from '../core/Constants.js';
import { GROUPS, TUNABLES } from '../core/Tunables.js';
import { DevOverrides } from '../core/DevOverrides.js';
import { eventBus, Events } from '../core/EventBus.js';

// In-game tuning/debug panel. Talks to gameplay only via dev:* EventBus
// events; reads world state only through the render_game_to_text snapshot.
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
    for (const [id, label] of [['tune', 'Tune'], ['keys', 'Keys'], ['level', 'Level']]) {
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
    if (this.panel.classList.contains('hidden') || this.activeTab !== 'keys') return;
    this.debugTimer -= delta;
    if (this.debugTimer > 0) return;
    this.debugTimer = 0.1;
    const gp = this.input.gamepadInfo;
    this.debugEl.textContent = [
      `keys: ${[...this.input.codes].join(' ') || '—'}`,
      `move: ${this.input.moveX.toFixed(2)}, ${this.input.moveZ.toFixed(2)}  scurry: ${this.input.scurry}`,
      `gamepad: ${gp ? `${gp.id} axes ${gp.axes.join(', ')}` : 'none'}`,
      `pointer lock: ${this.input.pointerLocked}`,
    ].join('\n');
  }
}
