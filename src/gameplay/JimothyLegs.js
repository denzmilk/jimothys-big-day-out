import * as THREE from 'three';
import { LEGS, MOVES, PLAYER_CONFIG } from '../core/Constants.js';

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

  /** Switch to swinging the skinned rig's leg BONES and retire the tubes.
   *  Separate from useRealLegs because the skinned model has leg bones, not
   *  leg objects — leaving the tubes up is the "eight legs" bug (2026-07-23). */
  useBones(rig) {
    this.rig = rig;
    this.mode = 'bones';
    for (const leg of this.legs) {
      leg.tube.visible = false;
      leg.foot.visible = false;
    }
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
   *  instead of being swallowed by the belly. `bodyBase` is the pivot the
   *  belly itself scales about — scaling the hips about anything else (the
   *  group origin, i.e. his feet) walks them off the body as he grows. Same
   *  root cause as the head/tail drift; see JimothyController.postUpdate. */
  applyFatness(widthScale, heightScale, bodyBase) {
    if (this.mode !== 'real' || !this.realLegs) return;
    for (const leg of this.realLegs) {
      if (!leg.home) continue;
      leg.pivot.position.set(
        bodyBase.x + (leg.home.x - bodyBase.x) * widthScale,
        bodyBase.y + (leg.home.y - bodyBase.y) * heightScale,
        bodyBase.z + (leg.home.z - bodyBase.z) * widthScale,
      );
    }
  }

  /** World positions of the four hip anchors, for the attachment check in
   *  render_game_to_text — "do the legs still meet the belly?" is otherwise
   *  only answerable by eye (milestone 08). */
  hipAnchors(out = new THREE.Vector3()) {
    const source = this.mode === 'real' && this.realLegs
      ? this.realLegs.map((l) => l.pivot)
      : this.legs.map((l) => l.hip);
    return source.map((o) => o.getWorldPosition(out.clone()));
  }

  reset() {
    this.phase = 0;
    for (const leg of this.legs) {
      leg.planted = null;
      leg.step = null;
    }
  }

  update(delta) {
    if (this.mode === 'bones') this._updateBones(delta);
    else if (this.mode === 'real') this._updateReal(delta);
    else this._updateTubes(delta);
  }

  // Bone axes, measured through rig.pose() with the bind orientation intact
  // (milestone 10): x pitches the limb fore/aft — the gait swing — z splays it
  // sideways, and y twists along the bone and is invisible. The same mapping
  // holds for head and tail, since every bone is built the same way.
  //
  // Still the crude diagonal-pair swing inherited from _updateReal. Planted
  // feet and terrain-aware IK are milestone 11 (JIM-22), and the logic for
  // them already exists in _updateTubes below — reconnect it, don't rewrite.
  _updateBones(delta) {
    const speedNorm = Math.min(1, this.controller.speed / PLAYER_CONFIG.SPEED);
    this.phase += delta * LEGS.SWING_HZ * (0.4 + speedNorm * 1.6) * Math.PI * 2;
    const amp = LEGS.SWING_MIN + speedNorm * LEGS.SWING_AMPLITUDE;
    const tuck = this.tuck || 0;
    ['leg_FL', 'leg_FR', 'leg_RL', 'leg_RR'].forEach((name, i) => {
      const diagonal = (i === 0 || i === 3) ? 1 : -1;
      const front = i < 2 ? 1 : -1;
      const swing = Math.sin(this.phase) * amp * diagonal;
      this.rig.pose(
        name,
        swing * (1 - tuck) + MOVES.ROLL.TUCK_LEG * front * tuck,
        0,
        Math.cos(this.phase) * amp * 0.25 * diagonal * (1 - tuck),
      );
    });
  }

  /** 0 = normal gait, 1 = fully tucked under him for the roll. Blended rather
   *  than switched so the legs gather up and sprawl back out. */
  setTuck(t) {
    this.tuck = t;
  }

  // Diagonal-pair trot: FL+RR swing together, opposed to FR+RL. Stride
  // amplitude and cadence both scale with speed, so a standing Jimothy's legs
  // settle and a scurrying one flails.
  _updateReal(delta) {
    const speedNorm = Math.min(1, this.controller.speed / PLAYER_CONFIG.SPEED);
    this.phase += delta * LEGS.SWING_HZ * (0.4 + speedNorm * 1.6) * Math.PI * 2;
    const amp = LEGS.SWING_MIN + speedNorm * LEGS.SWING_AMPLITUDE;
    const tuck = this.tuck || 0;
    this.realLegs.forEach((leg, i) => {
      const diagonal = (i === 0 || i === 3) ? 1 : -1;
      const swing = Math.sin(this.phase) * amp * diagonal;
      // Front and rear legs fold toward each other, which is what makes the
      // silhouette read as a ball rather than a spinning table.
      const front = i < 2 ? 1 : -1;
      leg.pivot.rotation.x = swing * (1 - tuck) + MOVES.ROLL.TUCK_LEG * front * tuck;
      // A touch of splay so he waddles rather than marching.
      leg.pivot.rotation.z = Math.cos(this.phase) * amp * 0.25 * diagonal * (1 - tuck);
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
