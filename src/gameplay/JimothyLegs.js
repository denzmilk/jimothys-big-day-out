import * as THREE from 'three';
import { LEGS, PLAYER_CONFIG } from '../core/Constants.js';

// Adventure-Time stretchy-tube legs: hips are children of the body slot (so
// they inherit fatness width and jiggle), feet are planted world positions
// that spring-step to a new home when the body drifts too far. Diagonal pairs
// trot. During hops the feet stay planted and the tubes stretch — the joke
// implements itself.
export class JimothyLegs {
  constructor(scene, controller) {
    this.scene = scene;
    this.controller = controller;
    this.tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.tubeGeo.translate(0, -0.5, 0); // origin at the hip end
    this.mat = new THREE.MeshStandardMaterial({ color: 0x4a4148 });
    this.footGeo = new THREE.SphereGeometry(1, 8, 6);
    this._hipWorld = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._up = new THREE.Vector3(0, -1, 0);

    // FL, FR, RL, RR — diagonal trot pairs: FL+RR, FR+RL.
    const defs = [
      [-1, 1], [1, 1], [-1, -1], [1, -1],
    ];
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

  reset() {
    for (const leg of this.legs) {
      leg.planted = null;
      leg.step = null;
    }
  }

  update(delta) {
    const c = this.controller;
    const speedNorm = Math.min(1, c.speed / PLAYER_CONFIG.SPEED);
    // Scurrying shortens the trigger distance and quickens the step.
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
          leg.step = { fx: leg.planted.x, fz: leg.planted.z, tx: home.x, tz: home.z, t: 0 };
        }
      }
      if (leg.step) {
        leg.step.t += delta / stepSeconds;
        const t = Math.min(1, leg.step.t);
        // Keep chasing a live target so fast turns don't strand the foot.
        leg.step.tx = home.x;
        leg.step.tz = home.z;
        leg.planted.x = leg.step.fx + (leg.step.tx - leg.step.fx) * t;
        leg.planted.z = leg.step.fz + (leg.step.tz - leg.step.fz) * t;
        leg.planted.y = Math.sin(Math.PI * t) * LEGS.STEP_LIFT;
        if (t >= 1) {
          leg.step = null;
          leg.planted.y = 0;
        }
      }

      // Stretch the tube hip→foot.
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
    return this.legs.map((l) => ({
      x: +(l.planted?.x ?? 0).toFixed(2),
      z: +(l.planted?.z ?? 0).toFixed(2),
    }));
  }
}
