import * as THREE from 'three';
import { PEDESTRIANS as PED, WORLD, COLORS } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

// Seattle locals going about their day until a raccoon ruins it. Rendered
// through two InstancedMeshes (bodies + heads) so a crowded street costs two
// draw calls rather than one per person. No physics bodies — they steer and
// distance-check, same as Pursuers, which keeps them deterministic.
export class Pedestrians {
  constructor(scene, jimothy, voxels) {
    this.jimothy = jimothy;
    this.voxels = voxels;
    const n = PED.COUNT;
    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.7, 4, 8);
    const headGeo = new THREE.SphereGeometry(0.2, 10, 8);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true });
    this.bodies = new THREE.InstancedMesh(bodyGeo, mat, n);
    this.heads = new THREE.InstancedMesh(headGeo, mat, n);
    for (const m of [this.bodies, this.heads]) {
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      m.frustumCulled = false;
      scene.add(m);
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);
    this._c = new THREE.Color();

    // Deterministic layout — no Math.random, so restarts and tests match.
    let seed = 90210;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
    this.people = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = 12 + rnd() * (WORLD.BOUNDS - 20);
      return {
        x: Math.cos(a) * r, z: Math.sin(a) * r,
        tx: Math.cos(a) * r, tz: Math.sin(a) * r,
        flee: 0, scaredRecently: false,
        hue: 0.05 + rnd() * 0.9, rnd,
      };
    });
    this._sync();
  }

  _pickTarget(p) {
    const b = WORLD.BOUNDS - 6;
    p.tx = THREE.MathUtils.clamp(p.x + (p.rnd() - 0.5) * 40, -b, b);
    p.tz = THREE.MathUtils.clamp(p.z + (p.rnd() - 0.5) * 40, -b, b);
  }

  update(delta) {
    if (!gameState.game.isPlaying) return;
    const jp = this.jimothy.group.position;
    for (const p of this.people) {
      const dj = Math.hypot(p.x - jp.x, p.z - jp.z);
      if (dj < PED.SCARE_RADIUS && !gameState.player.hidden) {
        if (!p.scaredRecently) {
          p.scaredRecently = true;
          // Scaring locals is chaos, and chaos is heat (gameplan).
          eventBus.emit(Events.LOCAL_SCARED, { x: p.x, z: p.z });
        }
        p.flee = PED.FLEE_SECONDS;
      } else if (dj > PED.SCARE_RADIUS * 2) {
        p.scaredRecently = false;
      }

      let speed = PED.SPEED;
      if (p.flee > 0) {
        p.flee -= delta;
        speed = PED.FLEE_SPEED;
        // Run directly away from the raccoon.
        const inv = 1 / (dj || 1);
        p.tx = p.x + (p.x - jp.x) * inv * 20;
        p.tz = p.z + (p.z - jp.z) * inv * 20;
      }

      const dx = p.tx - p.x;
      const dz = p.tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < PED.ARRIVE_RADIUS) {
        if (p.flee <= 0) this._pickTarget(p);
      } else {
        const stepLen = Math.min(speed * delta, d);
        p.x += (dx / d) * stepLen;
        p.z += (dz / d) * stepLen;
        p.yaw = Math.atan2(dx, dz);
      }
      const b = WORLD.BOUNDS - 2;
      p.x = THREE.MathUtils.clamp(p.x, -b, b);
      p.z = THREE.MathUtils.clamp(p.z, -b, b);
    }
    this._sync();
  }

  _sync() {
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i];
      // Scan from just above THIS column's own surface. The literal 0.5 that
      // used to be here meant "a bit above grade", which was true only while
      // the world was flat — on a 50 m hill the scan started 50 m underground,
      // found nothing, and buried the pedestrian at bedrock (milestone 17).
      const surface = this.voxels ? this.voxels.terrainHeightAt(p.x, p.z) : 0;
      const groundY = this.voxels
        ? this.voxels.groundHeightAt(p.x, p.z, surface + 0.5)
        : 0;
      // Panic wobble so fleeing reads as slapstick, not a jog.
      const lean = p.flee > 0 ? Math.sin(p.flee * 22) * 0.25 : 0;
      this._q.setFromEuler(new THREE.Euler(lean, p.yaw || 0, lean * 0.6));
      this._m.compose(new THREE.Vector3(p.x, groundY + 0.75, p.z), this._q, this._s);
      this.bodies.setMatrixAt(i, this._m);
      this._m.compose(new THREE.Vector3(p.x, groundY + 1.35, p.z), this._q, this._s);
      this.heads.setMatrixAt(i, this._m);
      this._c.setHSL(p.hue, 0.45, p.flee > 0 ? 0.7 : 0.5);
      this.bodies.setColorAt(i, this._c);
      this.heads.setColorAt(i, this._c.clone().offsetHSL(0, -0.2, 0.15));
    }
    for (const m of [this.bodies, this.heads]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  reset() {
    for (const p of this.people) {
      p.flee = 0;
      p.scaredRecently = false;
    }
    this._sync();
  }

  get fleeingCount() {
    return this.people.reduce((n, p) => n + (p.flee > 0 ? 1 : 0), 0);
  }
}
