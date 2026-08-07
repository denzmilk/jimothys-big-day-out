import * as THREE from 'three';
import { CRABS, SEWER, VOXEL, STREAM } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import * as Layout from '../level/Layout.js';

// The crab people (milestone 18).
//
// An underground faction with their own territory, going about their business
// and reacting badly to a raccoon. Deliberately NOT a heat tier: they are a
// separate ecology that does not care about your wanted level, which is what
// makes going down there a change of situation rather than a safer version of
// the surface. Animal control wants you; the crab people just want you to leave.
//
// Tone check from the milestone: this is meme-slop, and crab people are already
// a joke that exists. Play it straight and let the absurdity do the work — they
// have somewhere to be and you are in the way of it.
//
// Instanced, streamed and physics-free, exactly like the pedestrians: they live
// only where the sewer does, which is the cheapest possible statement of
// "territory" and also a true one.
export class CrabPeople {
  constructor(scene, jimothy, voxels) {
    this.scene = scene;
    this.jimothy = jimothy;
    this.voxels = voxels;
    this.crabs = [];
    this.elapsed = 0;
    this.alarmed = 0;

    // A shell and two eyes on stalks. Enough silhouette to read as a crab
    // person in a torchlit tunnel, which is the only place they are ever seen.
    const mat = new THREE.MeshStandardMaterial({ color: CRABS.COLOR, roughness: 0.55 });
    const shell = new THREE.SphereGeometry(CRABS.SIZE, 10, 7);
    shell.scale(1.35, 0.62, 1);
    this.bodies = new THREE.InstancedMesh(shell, mat, CRABS.COUNT);
    this.eyes = new THREE.InstancedMesh(
      new THREE.SphereGeometry(CRABS.SIZE * 0.22, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0xf6e6c8, emissive: 0x3a2a10 }),
      CRABS.COUNT,
    );
    for (const m of [this.bodies, this.eyes]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);
    this._v = new THREE.Vector3();
  }

  /** Somewhere on the sewer centreline near him, at tunnel-floor height. */
  _spawnSpot(seed) {
    const jp = this.jimothy.group.position;
    const R = STREAM.LOAD_RADIUS * VOXEL.CHUNK_XZ * VOXEL.SIZE;
    for (let n = 0; n < 24; n++) {
      let h = (Math.imul(seed + n, 374761393) ^ 0x9e3779b9) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      h = (h ^ (h >>> 16)) >>> 0;
      const x = jp.x + (((h & 1023) / 1024) * 2 - 1) * R;
      const z = jp.z + ((((h >>> 10) & 1023) / 1024) * 2 - 1) * R;
      if (!Layout.Masterplan.isSewerLine(x, z)) continue;
      return { x, z, y: this.voxels.terrainHeightAt(x, z) - SEWER.DEPTH };
    }
    return null;
  }

  update(delta) {
    if (!gameState.game.isPlaying) return;
    this.elapsed += delta;
    const jp = this.jimothy.group.position;
    const R = STREAM.LOAD_RADIUS * VOXEL.CHUNK_XZ * VOXEL.SIZE;
    // Only while he is down there. They have their own lives when he isn't, and
    // simulating them from the surface would be a draw call and a lie.
    const below = this.voxels.terrainHeightAt(jp.x, jp.z) - jp.y > SEWER.BELOW;

    // Drop the ones he has walked away from, then top up.
    this.crabs = this.crabs.filter(
      (c) => below && Math.max(Math.abs(c.x - jp.x), Math.abs(c.z - jp.z)) < R * 1.4,
    );
    if (below) {
      while (this.crabs.length < CRABS.COUNT) {
        const spot = this._spawnSpot(this.crabs.length + Math.floor(this.elapsed * 10));
        if (!spot) break;
        this.crabs.push({
          ...spot, yaw: 0, alarm: 0, seed: this.crabs.length * 977 + 13, step: 0,
          tx: spot.x, tz: spot.z,
        });
      }
    }

    this.alarmed = 0;
    for (const c of this.crabs) {
      const d = Math.hypot(jp.x - c.x, jp.z - c.z);
      if (d < CRABS.ALARM_RADIUS && Math.abs(jp.y - c.y) < 4) {
        if (c.alarm <= 0) eventBus.emit(Events.CRAB_ALARMED, { x: c.x, z: c.z });
        c.alarm = CRABS.SCUTTLE_SECONDS;
      }
      let speed = CRABS.SPEED;
      if (c.alarm > 0) {
        c.alarm -= delta;
        this.alarmed += 1;
        speed = CRABS.SCUTTLE_SPEED;
        // Straight away from the raccoon, along the tunnel if it can.
        const inv = 1 / (d || 1);
        c.tx = c.x + (c.x - jp.x) * inv * 14;
        c.tz = c.z + (c.z - jp.z) * inv * 14;
      }

      const dx = c.tx - c.x;
      const dz = c.tz - c.z;
      const td = Math.hypot(dx, dz);
      if (td < 1.2) {
        // Somewhere else to be. Deterministic, like every other wander in this
        // project — advanceTime has to reproduce it.
        c.step += 1;
        let h = (Math.imul(c.seed, 668265263) ^ Math.imul(c.step, 374761393)) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        const th = (((h ^ (h >>> 16)) >>> 0) & 1023) / 1024 * Math.PI * 2;
        c.tx = c.x + Math.cos(th) * 12;
        c.tz = c.z + Math.sin(th) * 12;
      } else {
        const step = Math.min(speed * delta, td);
        const nx = c.x + (dx / td) * step;
        const nz = c.z + (dz / td) * step;
        // They stay in the pipe. Walking into the wall is what a crab person
        // would do least.
        if (!this.voxels.solidAtWorld(nx, c.y + 0.6, nz)) {
          c.x = nx;
          c.z = nz;
          c.yaw = Math.atan2(dx, dz);
        } else {
          c.tx = c.x;
          c.tz = c.z;
        }
      }
      c.y = this.voxels.groundHeightAt(c.x, c.z, c.y + 1.5);
    }
    this._sync();
  }

  _sync() {
    const n = this.crabs.length;
    this.bodies.count = n;
    this.eyes.count = n;
    for (let i = 0; i < n; i++) {
      const c = this.crabs[i];
      // A sideways scuttle, because of course it is.
      const bob = Math.sin(this.elapsed * 9 + c.seed) * (c.alarm > 0 ? 0.08 : 0.02);
      this._q.setFromEuler(new THREE.Euler(0, c.yaw + Math.PI / 2, bob));
      this._m.compose(this._v.set(c.x, c.y + CRABS.SIZE * 0.6, c.z), this._q, this._s);
      this.bodies.setMatrixAt(i, this._m);
      this._m.compose(
        this._v.set(c.x, c.y + CRABS.SIZE * 1.25, c.z), this._q, this._s,
      );
      this.eyes.setMatrixAt(i, this._m);
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    this.eyes.instanceMatrix.needsUpdate = true;
  }

  reset() {
    this.crabs = [];
    this.alarmed = 0;
    this._sync();
  }

  snapshot() {
    return { count: this.crabs.length, alarmed: this.alarmed };
  }
}
