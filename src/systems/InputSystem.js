import { INPUT, KEYBINDS } from '../core/Constants.js';

// Merges keyboard + gamepad into one analog interface (threejs-game input
// pattern): gameplay reads moveX/moveZ (-1..1), scurry, and consumeHop(),
// and never knows the source. Keys are matched by physical code (e.code) via
// the rebindable KEYBINDS map — keyboard layout can't break movement.
export class InputSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.codes = new Set();
    this.moveX = 0;
    this.moveZ = 0;
    this.scurry = false;
    this.gamepadInfo = null; // surfaced by the DevTools input debug view
    // Liveness flags for the diag strip / keyboard hint: has the page EVER
    // received a key / pointer event? Distinguishes "game broken" from
    // "events not reaching the page" (embedded previews, focus loss).
    this.everKeydown = false;
    this.everPointer = false;
    this._hopQueued = false;
    this._gpHopHeld = false;
    this._mouseDX = 0;
    this._mouseDY = 0;

    this._onDown = (e) => {
      this.everKeydown = true;
      // Don't let typing in DevTools fields drive the raccoon.
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (KEYBINDS.HOP.includes(e.code)) {
        this._hopQueued = true;
        e.preventDefault(); // Space must never scroll/click
      }
      if (KEYBINDS.POINTER_LOCK.includes(e.code)) this.togglePointerLock();
      this.codes.add(e.code);
    };
    this._onUp = (e) => this.codes.delete(e.code);
    this._onMouseMove = (e) => {
      if (document.pointerLockElement) {
        this._mouseDX += e.movementX;
        this._mouseDY += e.movementY;
      }
    };
    this._onPointerDown = (e) => {
      this.everPointer = true;
      // Webview/iframe hosts only deliver key events to a focused document —
      // claim focus explicitly on any click into the game.
      if (e.target === this.canvas) {
        window.focus();
        this.canvas.focus({ preventScroll: true });
      }
    };
    // tabindex makes the canvas a legitimate focus target inside webviews.
    this.canvas.tabIndex = 0;
    this.canvas.style.outline = 'none';
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('pointerdown', this._onPointerDown);
  }

  get pointerLocked() {
    return !!document.pointerLockElement;
  }

  togglePointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
    else this.canvas.requestPointerLock?.();
  }

  _pressed(action) {
    return KEYBINDS[action].some((c) => this.codes.has(c));
  }

  update() {
    let x = 0;
    let z = 0;
    if (this._pressed('LEFT')) x -= 1;
    if (this._pressed('RIGHT')) x += 1;
    if (this._pressed('FORWARD')) z -= 1;
    if (this._pressed('BACK')) z += 1;
    let scurry = this._pressed('SCURRY');

    // Keyboard wins while any direction key is held (threejs-game input
    // pattern) — a drifting/stuck gamepad stick must never cancel it.
    const keyboardActive = x !== 0 || z !== 0;

    const pads = navigator.getGamepads?.() || [];
    const gp = [...pads].find((g) => g && g.connected !== false);
    if (gp) {
      const gx = gp.axes?.[0] ?? 0;
      const gz = gp.axes?.[1] ?? 0;
      if (!keyboardActive) {
        if (Math.abs(gx) > INPUT.DEADZONE) x += gx;
        if (Math.abs(gz) > INPUT.DEADZONE) z += gz;
      }
      const hop = !!gp.buttons?.[INPUT.GAMEPAD_HOP_BUTTON]?.pressed;
      if (hop && !this._gpHopHeld) this._hopQueued = true;
      this._gpHopHeld = hop;
      if (gp.buttons?.[INPUT.GAMEPAD_SCURRY_BUTTON]?.pressed) scurry = true;
      this.gamepadInfo = {
        id: gp.id,
        axes: (gp.axes || []).map((a) => +a.toFixed(2)),
      };
    } else {
      this.gamepadInfo = null;
    }

    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    this.moveX = x;
    this.moveZ = z;
    this.scurry = scurry;
  }

  consumeHop() {
    const h = this._hopQueued;
    this._hopQueued = false;
    return h;
  }

  consumeMouseDelta() {
    const d = { x: this._mouseDX, y: this._mouseDY };
    this._mouseDX = 0;
    this._mouseDY = 0;
    return d;
  }

  dispose() {
    window.removeEventListener('keydown', this._onDown);
    window.removeEventListener('keyup', this._onUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('pointerdown', this._onPointerDown);
  }
}
