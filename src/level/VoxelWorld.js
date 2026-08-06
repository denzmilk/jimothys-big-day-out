import * as THREE from 'three';
import { VOXEL } from '../core/Constants.js';

// Chunked destructible voxel grid (ADR-0003).
//
// Two rules keep this fast enough to actually run, and both cost about the
// same as doing it naively:
//   1. Geometry is built per CHUNK with hidden faces culled — never a mesh
//      per voxel (that measures ~19k draw calls; this is one per chunk).
//   2. Static structure gets no physics bodies at all. Jimothy is kinematic
//      and already hand-clamped, so he collides by grid lookup instead.
export class VoxelWorld {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map(); // key "cx,cy,cz" -> { mesh, dirty, data }
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true });
    this.removedCount = 0;
    this._colors = new Map(
      Object.entries(VOXEL.MATERIALS).map(([id, m]) => [Number(id), new THREE.Color(m.color)]),
    );
  }

  _key(cx, cy, cz) { return `${cx},${cy},${cz}`; }

  _chunkFor(vx, vy, vz, create = false) {
    const CX = VOXEL.CHUNK_XZ;
    const CY = VOXEL.CHUNK_Y;
    const cx = Math.floor(vx / CX);
    const cy = Math.floor(vy / CY);
    const cz = Math.floor(vz / CX);
    const key = this._key(cx, cy, cz);
    let chunk = this.chunks.get(key);
    if (!chunk && create) {
      chunk = {
        cx, cy, cz, data: new Uint8Array(CX * CY * CX), mesh: null, dirty: true,
      };
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  _localIndex(vx, vy, vz) {
    const CX = VOXEL.CHUNK_XZ;
    const CY = VOXEL.CHUNK_Y;
    const lx = ((vx % CX) + CX) % CX;
    const ly = ((vy % CY) + CY) % CY;
    const lz = ((vz % CX) + CX) % CX;
    return lx + CX * (ly + CY * lz);
  }

  set(vx, vy, vz, mat) {
    const chunk = this._chunkFor(vx, vy, vz, true);
    chunk.data[this._localIndex(vx, vy, vz)] = mat;
    chunk.dirty = true;
  }

  get(vx, vy, vz) {
    const chunk = this._chunkFor(vx, vy, vz);
    return chunk ? chunk.data[this._localIndex(vx, vy, vz)] : 0;
  }

  // --- world <-> voxel ---

  worldToVoxel(x, y, z) {
    const s = VOXEL.SIZE;
    return [Math.floor(x / s), Math.floor(y / s), Math.floor(z / s)];
  }

  solidAtWorld(x, y, z) {
    const [vx, vy, vz] = this.worldToVoxel(x, y, z);
    return this.get(vx, vy, vz) !== 0;
  }

  /** Height of the surface directly beneath `fromY` at (x,z).
   *
   *  Scanning must start just above the feet, NOT from a fixed ceiling —
   *  otherwise the highest voxel anywhere in the column wins and walking past
   *  a house snaps the player onto its roof (and re-hopping off that climbs
   *  him into the sky). `stepUp` is the small lip he's allowed to mount. */
  groundHeightAt(x, z, fromY = 0, stepUp = VOXEL.SIZE * 0.75) {
    const s = VOXEL.SIZE;
    const [vx, , vz] = this.worldToVoxel(x, 0, z);
    const top = Math.floor((fromY + stepUp) / s);
    const bottom = -VOXEL.GROUND_LAYERS - 2;
    for (let vy = top; vy >= bottom; vy--) {
      if (this.get(vx, vy, vz) !== 0) return (vy + 1) * s;
    }
    return bottom * s; // dug clean through: fall to bedrock
  }

  /** Clear voxels in a sphere. Returns the world-space centers removed so the
   *  caller can spawn debris where the wall actually was.
   *
   *  `minVoxelY` is the floor the blast will not reach below. Terrain occupies
   *  y < 0 (buildGround writes its strata at -1 and below) and structures
   *  start at 0, so passing 0 cleanly means "smash the house, spare the road"
   *  — which is how the moves distinguish demolition from digging. */
  damageSphere(cx, cy, cz, radius, minVoxelY = -Infinity) {
    const s = VOXEL.SIZE;
    const r = Math.ceil(radius / s);
    const [bx, by, bz] = this.worldToVoxel(cx, cy, cz);
    const removed = [];
    for (let x = bx - r; x <= bx + r; x++) {
      for (let y = Math.max(by - r, minVoxelY); y <= by + r; y++) {
        for (let z = bz - r; z <= bz + r; z++) {
          const mat0 = this.get(x, y, z);
          if (mat0 === 0 || mat0 === VOXEL.BEDROCK) continue;
          const wx = (x + 0.5) * s;
          const wy = (y + 0.5) * s;
          const wz = (z + 0.5) * s;
          if (Math.hypot(wx - cx, wy - cy, wz - cz) > radius) continue;
          const mat = this.get(x, y, z);
          this.set(x, y, z, 0);
          removed.push({ x: wx, y: wy, z: wz, mat });
        }
      }
    }
    this.removedCount += removed.length;
    return removed;
  }

  // --- meshing ---

  /** Rebuild dirty chunks. Only faces touching air are emitted, which is the
   *  bulk of the win over naive voxel meshes and is far simpler than full
   *  greedy merging. */
  remeshDirty() {
    let rebuilt = 0;
    for (const chunk of this.chunks.values()) {
      if (!chunk.dirty) continue;
      this._buildChunk(chunk);
      chunk.dirty = false;
      rebuilt++;
    }
    return rebuilt;
  }

  _buildChunk(chunk) {
    const CX = VOXEL.CHUNK_XZ;
    const CY = VOXEL.CHUNK_Y;
    const s = VOXEL.SIZE;
    const pos = [];
    const norm = [];
    const col = [];
    const base = [chunk.cx * CX, chunk.cy * CY, chunk.cz * CX];
    const FACES = [
      { d: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
      { d: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
      { d: [0, 1, 0], v: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
      { d: [0, -1, 0], v: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] },
      { d: [0, 0, 1], v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
      { d: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
    ];

    for (let lz = 0; lz < CX; lz++) {
      for (let ly = 0; ly < CY; ly++) {
        for (let lx = 0; lx < CX; lx++) {
          const mat = chunk.data[lx + CX * (ly + CY * lz)];
          if (!mat) continue;
          const vx = base[0] + lx;
          const vy = base[1] + ly;
          const vz = base[2] + lz;
          const color = this._colors.get(mat) || this._colors.get(1);
          for (const f of FACES) {
            if (this.get(vx + f.d[0], vy + f.d[1], vz + f.d[2]) !== 0) continue;
            const quad = f.v.map(([ox, oy, oz]) => [(vx + ox) * s, (vy + oy) * s, (vz + oz) * s]);
            for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
              for (const idx of [a, b, c]) {
                pos.push(quad[idx][0], quad[idx][1], quad[idx][2]);
                norm.push(f.d[0], f.d[1], f.d[2]);
                col.push(color.r, color.g, color.b);
              }
            }
          }
        }
      }
    }

    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    chunk.mesh = new THREE.Mesh(geo, this.material);
    this.scene.add(chunk.mesh);
  }

  clear() {
    for (const chunk of this.chunks.values()) {
      if (chunk.mesh) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
      }
    }
    this.chunks.clear();
    this.removedCount = 0;
  }

  stats() {
    let meshes = 0;
    for (const c of this.chunks.values()) if (c.mesh) meshes++;
    return { chunks: this.chunks.size, meshes, removed: this.removedCount };
  }
}
