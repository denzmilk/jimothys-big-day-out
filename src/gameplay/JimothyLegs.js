import * as THREE from 'three';
import { LEGS, PLAYER_CONFIG } from '../core/Constants.js';

// Jimothy's legs. Two modes:
//
//   real  — the model's own separated leg meshes (tools/prep_jimothy.py) swing
//           from hip pivots in diagonal pairs. Deliberately a crude swing
//           rather than planted-foot IK: the brief was "terrible animations",
//           and a raccoon on stilts flailing reads funnier than clean IK.
//   tubes — fallback stretchy cylinders when the model hasn't loaded, so the
//           game is never legless.
//
// Both never run at once — drawing tubes over the model's real legs is what
// gave him eight legs in the 2026-07-23 playtest.
export class JimothyLegs {
  constructor(scene, controller) {
    this.scene = scene;
    this.controller = controller;
    this.mode = 'tubes';
    this.realLegs = null;
    this.phase = 0;

    this.tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.tubeGeo.translate(0, -0.5, 0);
    this.mat = new THREE.MeshStandardMaterial({ color: 0x4a4148 });
    this.footGeo = new THREE.SphereGeometry(1, 8, 6);
    this._hipWorld = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._up = new THREE.Vector3(0, -1, 0);

    const defs = [[-1, 1], [1, 1], [-1, -1], [1, -1]]; // FL, FR, RL, RR
    this.legs = defs.map(([sx, sz]) => {
      const hip = new THREE.Object3D();
      controller.bodySlot.add(hip);
      const tube = new THREE.Mesh(this.tubeGeo, this.mat);
      const foot = new THREE.Mesh(this.footGeo, this.mat);
      foot.scale.setScalar(LEGS.FOOT_RADIUS);
      scene.add(tube, foot);
      return { sx, sz, hip, tube, foot, planted: null, step: null };
    });
    this.pairOf = (i) => this.legs[[3, 2, 1, 0][i]];
  }

  /** Switch to the model's real legs and retire the tubes. */
  useRealLegs(legMap) {
    if (!legMap || !Object.keys(legMap).length) return;
    this.realLegs = ['leg_FL', 'leg_FR', 'leg_RL', 'leg_RR'].map((n) => legMap[n]).filter(Boolean);
    if (!this.realLegs.length) return;
    this.mode = 'real';
    // Remember slim hip positions so fatness can splay them outward.
    for (const leg of this.realLegs) leg.home = leg.pivot.position.clone();
    for (const leg of this.legs) {
      leg.tube.visible = false;
      leg.foot.visible = false;
    }
  }

  /** Hips ride outward as he fattens so the legs stay on the body's edge
   *  instead of being swallowed by the belly. */
  applyFatness(widthScale, heightScale) {
    if (this.mode !== 'real' || !this.realLegs) return;
    for (const leg of this.realLegs) {
      if (!leg.home) continue;
      leg.pivot.position.set(
        leg.home.x * widthScale,
        leg.home.y * heightScale,
        leg.home.z * widthScale,
      );
    }
  }

  reset() {
    this.phase = 0;
    for (const leg of this.legs) {
      leg.planted = null;
      leg.step = null;
    }
  }

  update(delta) {
    if (this.mode === 'real') this._updateReal(delta);
    else this._updateTubes(delta);
  }

  // Diagonal-pair trot: FL+RR swing together, opposed to FR+RL. Stride
  // amplitude and cadence both scale with speed, so a standing Jimothy's legs
  // settle and a scurrying one flails.
  _updateReal(delta) {
    const speedNorm = Math.min(1, this.controller.speed / PLAYER_CONFIG.SPEED);
    this.phase += delta * LEGS.SWING_HZ * (0.4 + speedNorm * 1.6) * Math.PI * 2;
    const amp = LEGS.SWING_MIN + speedNorm * LEGS.SWING_AMPLITUDE;
    this.realLegs.forEach((leg, i) => {
      const diagonal = (i === 0 || i === 3) ? 1 : -1;
      leg.pivot.rotation.x = Math.sin(this.phase) * amp * diagonal;
      // A touch of splay so he waddles rather than marching.
      leg.pivot.rotation.z = Math.cos(this.phase) * amp * 0.25 * diagonal;
    });
  }

  _updateTubes(delta) {
    const c = this.controller;
    const speedNorm = Math.min(1, c.speed / PLAYER_CONFIG.SPEED);
    const threshold = LEGS.STEP_THRESHOLD * (1 - 0.4 * speedNorm);
    const stepSeconds = LEGS.STEP_SECONDS * (1 - 0.45 * speedNorm);

    this.legs.forEach((leg, i) => {
      leg.hip.position.set(leg.sx * LEGS.HIP_X, LEGS.HIP_Y, leg.sz * LEGS.HIP_Z);
      leg.hip.getWorldPosition(this._hipWorld);
      const home = {
        x: this._hipWorld.x + c.vel.x * LEGS.STRIDE_LEAD,
        z: this._hipWorld.z + c.vel.z * LEGS.STRIDE_LEAD,
      };
      if (!leg.planted) leg.planted = { x: home.x, y: 0, z: home.z };

      if (!leg.step) {
        const drift = Math.hypot(home.x - leg.planted.x, home.z - leg.planted.z);
        if (drift > threshold && !this.pairOf(i).step) {
          leg.step = { fx: leg.planted.x, fz: leg.planted.z, t: 0 };
        }
      }
      if (leg.step) {
        leg.step.t += delta / stepSeconds;
        const t = Math.min(1, leg.step.t);
        leg.planted.x = leg.step.fx + (home.x - leg.step.fx) * t;
        leg.planted.z = leg.step.fz + (home.z - leg.step.fz) * t;
        leg.planted.y = Math.sin(Math.PI * t) * LEGS.STEP_LIFT;
        if (t >= 1) { leg.step = null; leg.planted.y = 0; }
      }

      this._dir.set(
        leg.planted.x - this._hipWorld.x,
        leg.planted.y - this._hipWorld.y,
        leg.planted.z - this._hipWorld.z,
      );
      const len = Math.max(0.05, this._dir.length());
      leg.tube.position.copy(this._hipWorld);
      leg.tube.quaternion.setFromUnitVectors(this._up, this._dir.normalize());
      leg.tube.scale.set(LEGS.TUBE_RADIUS, len, LEGS.TUBE_RADIUS);
      leg.foot.position.set(leg.planted.x, leg.planted.y + LEGS.FOOT_RADIUS * 0.6, leg.planted.z);
    });
  }

  snapshot() {
    if (this.mode === 'real') {
      const p = this.controller.group.position;
      return this.realLegs.map(() => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2) }));
    }
    return this.legs.map((l) => ({
      x: +(l.planted?.x ?? 0).toFixed(2),
      z: +(l.planted?.z ?? 0).toFixed(2),
    }));
  }
}
