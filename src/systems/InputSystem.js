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
    // Set by the fly camera (milestone 17). The camera and the raccoon share
    // WASD, SCURRY and Space, so flight has to TAKE the controls rather than
    // read them alongside him — otherwise inspecting the map hops him off a
    // roof. Raw key state (`held`) is deliberately still readable, since that
    // is what the fly camera steers by.
    this.suppressed = false;
    // Test seam — see the `pointerLocked` getter. Production never writes it.
    this.forcePointerLock = false;
    this._hopQueued = false;
    this._gpHopHeld = false;
    this._flyQueued = false;
    this._flySteps = 0;
    this._mouseDX = 0;
    this._mouseDY = 0;

    this._onDown = (e) => {
      this.everKeydown = true;
      // Don't let typing in DevTools fields drive the raccoon.
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (KEYBINDS.HOP.includes(e.code)) {
        // e.repeat filters the OS key-repeat storm from a held Space —
        // otherwise every repeat queues another hop and he stair-steps into
        // the sky the moment anything makes him grounded again.
        if (!e.repeat) this._hopQueued = true;
        e.preventDefault(); // Space must never scroll/click
      }
      if (KEYBINDS.POINTER_LOCK.includes(e.code)) this.togglePointerLock();
      if (!e.repeat && KEYBINDS.HEADBUTT.includes(e.code)) this._headbuttQueued = true;
      if (!e.repeat && KEYBINDS.ROLL.includes(e.code)) this._rollQueued = true;
      // Fly toggle and speed steps survive suppression — they are the controls
      // OF the suppressor, so gating them on it would lock you in the sky.
      if (!e.repeat && KEYBINDS.FLY_TOGGLE.includes(e.code)) this._flyQueued = true;
      if (KEYBINDS.FLY_FASTER.includes(e.code)) this._flySteps += 1;
      if (KEYBINDS.FLY_SLOWER.includes(e.code)) this._flySteps -= 1;
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
    // The override exists for the specs (milestone 21). Pointer lock is not
    // reliably grantable headless, and aiming only happens while locked — so
    // without it every aim spec would have to drive a parallel code path
    // instead of the one the player uses, which is how a mechanic ships broken
    // with a green suite. Nothing in the game ever sets it.
    return this.forcePointerLock || !!document.pointerLockElement;
  }

  togglePointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
    else this.canvas.requestPointerLock?.();
  }

  requestPointerLock() {
    if (document.pointerLockElement) return;
    // Chrome returns a promise that REJECTS whenever the document isn't
    // eligible (embedded previews, an unfocused host). Unhandled, that logs a
    // console error — and the console being error-free is the first step of
    // every live-iterate pass. Flight works on the keyboard without the lock.
    this.canvas.requestPointerLock?.()?.catch?.(() => {});
  }

  _pressed(action) {
    return KEYBINDS[action].some((c) => this.codes.has(c));
  }

  /** Raw held state for an action, ignoring suppression. The fly camera reads
   *  this; gameplay reads the analog fields below. */
  held(action) {
    return this._pressed(action);
  }

  update() {
    // Suppressed: the analog interface reads dead and every queued one-shot is
    // dropped, so nothing the player does to the camera reaches the raccoon.
    if (this.suppressed) {
      this.moveX = 0;
      this.moveZ = 0;
      this.scurry = false;
      this._hopQueued = false;
      this._headbuttQueued = false;
      this._rollQueued = false;
      this._gpHopHeld = false;
      return;
    }
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

  consumeHeadbutt() {
    const b = this._headbuttQueued;
    this._headbuttQueued = false;
    return b;
  }

  consumeRoll() {
    const r = this._rollQueued;
    this._rollQueued = false;
    return r;
  }

  consumeFlyToggle() {
    const f = this._flyQueued;
    this._flyQueued = false;
    return f;
  }

  /** Net -/= presses since the last read. Steps, not a level, so the fly camera
   *  owns the multiplier and this stays a pure input edge. */
  consumeFlySpeedSteps() {
    const s = this._flySteps;
    this._flySteps = 0;
    return s;
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
