import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { DEBRIS, VOXEL } from '../core/Constants.js';

// Pooled, hard-capped voxel debris. One InstancedMesh covers every chunk of
// flying wall, and bodies are recycled rather than allocated — an uncapped
// debris system is how voxel destruction kills a frame rate.
export class Debris {
  constructor(scene, physics) {
    this.physics = physics;
    const s = VOXEL.SIZE;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(s, s, s),
      new THREE.MeshStandardMaterial({ vertexColors: false }),
      DEBRIS.MAX,
    );
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(DEBRIS.MAX * 3), 3,
    );
    this.mesh.frustumCulled = false;
    this.mesh.count = DEBRIS.MAX;
    scene.add(this.mesh);

    this._matrix = new THREE.Matrix4();
    this._quat = new THREE.Quaternion();
    this._scaleOne = new THREE.Vector3(1, 1, 1);
    this._hidden = new THREE.Vector3(0, -1000, 0);

    // Pre-allocate every body once; alive ones get re-positioned on spawn.
    this.slots = [];
    for (let i = 0; i < DEBRIS.MAX; i++) {
      const body = new CANNON.Body({
        mass: DEBRIS.MASS,
        shape: new CANNON.Box(new CANNON.Vec3(s / 2, s / 2, s / 2)),
        position: new CANNON.Vec3(0, -1000, 0),
        linearDamping: 0.1,
        angularDamping: 0.2,
      });
      body.sleepSpeedLimit = 0.4;
      physics.add(body);
      this.slots.push({ body, alive: false, ttl: 0, color: new THREE.Color() });
    }
    this.next = 0;
    this._syncAll();
  }

  spawnBurst(cells) {
    const take = Math.min(cells.length, DEBRIS.PER_BLAST);
    for (let i = 0; i < take; i++) {
      const cell = cells[Math.floor((i / take) * cells.length)];
      const slot = this.slots[this.next];
      this.next = (this.next + 1) % DEBRIS.MAX; // oldest recycles at the cap
      slot.alive = true;
      slot.ttl = DEBRIS.LIFETIME;
      slot.color.set(VOXEL.MATERIALS[cell.mat]?.color ?? 0x888888);
      slot.body.wakeUp(); // pooled bodies may have fallen asleep (ADR-0002)
      slot.body.position.set(cell.x, cell.y, cell.z);
      slot.body.quaternion.set(0, 0, 0, 1);
      const a = i * 2.399; // golden-angle spray, no RNG so tests stay stable
      slot.body.velocity.set(
        Math.cos(a) * DEBRIS.IMPULSE,
        DEBRIS.IMPULSE * 0.9,
        Math.sin(a) * DEBRIS.IMPULSE,
      );
      slot.body.angularVelocity.set(Math.cos(a) * 8, 6, Math.sin(a) * 8);
    }
  }

  update(delta) {
    for (const slot of this.slots) {
      if (!slot.alive) continue;
      slot.ttl -= delta;
      if (slot.ttl <= 0 || slot.body.position.y < -5) {
        slot.alive = false;
        slot.body.sleep();
        slot.body.position.set(0, -1000, 0);
      }
    }
    this._syncAll();
  }

  _syncAll() {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const p = slot.alive ? slot.body.position : this._hidden;
      this._quat.set(
        slot.body.quaternion.x, slot.body.quaternion.y,
        slot.body.quaternion.z, slot.body.quaternion.w,
      );
      this._matrix.compose(
        new THREE.Vector3(p.x, p.y, p.z), this._quat, this._scaleOne,
      );
      this.mesh.setMatrixAt(i, this._matrix);
      this.mesh.setColorAt(i, slot.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  reset() {
    for (const slot of this.slots) {
      slot.alive = false;
      slot.ttl = 0;
      slot.body.sleep();
      slot.body.position.set(0, -1000, 0);
      slot.body.velocity.set(0, 0, 0);
      slot.body.angularVelocity.set(0, 0, 0);
    }
    this.next = 0;
    this._syncAll();
  }

  get liveCount() {
    return this.slots.reduce((n, s) => n + (s.alive ? 1 : 0), 0);
  }
}
