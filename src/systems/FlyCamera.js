import * as THREE from 'three';
import { FLY } from '../core/Constants.js';

// Free camera, detached from Jimothy (milestone 17).
//
// The island is 2 km across and until this existed the only way to look at it
// was to walk. It lands FIRST in the milestone because the coastline, the hills
// and the districts that follow are all judged by eye.
//
// It takes the controls rather than sharing them: WASD, SCURRY and Space belong
// to the raccoon, so entering flight sets `input.suppressed` and reads raw key
// state instead. Sharing them would hop him off a roof while you looked at the
// map.
//
// `window.debugCamera` remains as the one-shot pose hook the specs use; this is
// the interactive version and owns `camera.rotation` while active.
const UP = new THREE.Vector3(0, 1, 0);

export class FlyCamera {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.active = false;
    this.multiplier = 1;
    this.yaw = 0;
    this.pitch = 0;
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  /** Enter flight from wherever the follow camera already is, keeping its
   *  heading. Teleporting to a fixed overview instead would lose the one thing
   *  you usually want: a look at what is right in front of you. */
  enter() {
    if (this.active) return;
    this.active = true;
    this.input.suppressed = true;
    this._euler.setFromQuaternion(this.camera.quaternion);
    this.yaw = this._euler.y;
    this.pitch = THREE.MathUtils.clamp(this._euler.x, -FLY.PITCH_LIMIT, FLY.PITCH_LIMIT);
    // Mouse-look needs the pointer captured. A keypress is a user gesture, so
    // this is allowed to ask; if the browser refuses, flight still works on
    // the keyboard.
    this.input.requestPointerLock();
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.input.suppressed = false;
    // Drain the look delta accumulated while flying, or the follow camera
    // inherits it as one enormous mouse flick on the next frame.
    this.input.consumeMouseDelta();
  }

  toggle() {
    if (this.active) this.exit();
    else this.enter();
  }

  update(delta) {
    if (this.input.pointerLocked) {
      const d = this.input.consumeMouseDelta();
      this.yaw -= d.x * FLY.MOUSE_SENS;
      // Screen-down (positive movementY) has to look down, and three's
      // rotation.x is positive UP — so this subtracts where the orbit camera,
      // which drives an elevation rather than a pitch, adds.
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - d.y * FLY.MOUSE_SENS, -FLY.PITCH_LIMIT, FLY.PITCH_LIMIT,
      );
    }

    const steps = this.input.consumeFlySpeedSteps();
    if (steps) {
      this.multiplier = THREE.MathUtils.clamp(
        this.multiplier * FLY.MULT_STEP ** steps, FLY.MULT_MIN, FLY.MULT_MAX,
      );
    }

    // Yaw before pitch, as everywhere else in this project: default XYZ would
    // apply the pitch about the world axis and roll the horizon as you turn.
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    let speed = FLY.SPEED * this.multiplier;
    if (this.input.held('SCURRY')) speed *= FLY.BOOST;
    if (this.input.held('FLY_SLOW')) speed *= FLY.PRECISE;

    let fwd = 0;
    let side = 0;
    let rise = 0;
    if (this.input.held('FORWARD')) fwd += 1;
    if (this.input.held('BACK')) fwd -= 1;
    if (this.input.held('RIGHT')) side += 1;
    if (this.input.held('LEFT')) side -= 1;
    if (this.input.held('FLY_UP')) rise += 1;
    if (this.input.held('FLY_DOWN')) rise -= 1;
    if (!fwd && !side && !rise) return;

    // Normalised, so diagonals aren't faster than the axes — the same rule
    // gameplay input follows.
    const len = Math.hypot(fwd, side, rise) || 1;
    const step = (speed * delta) / len;
    this.camera.getWorldDirection(this._fwd);
    this._right.crossVectors(this._fwd, UP).normalize();
    this.camera.position
      .addScaledVector(this._fwd, fwd * step)
      .addScaledVector(this._right, side * step);
    this.camera.position.y += rise * step;
  }

  snapshot() {
    return {
      active: this.active,
      multiplier: +this.multiplier.toFixed(3),
      yaw: +this.yaw.toFixed(3),
      pitch: +this.pitch.toFixed(3),
    };
  }
}
