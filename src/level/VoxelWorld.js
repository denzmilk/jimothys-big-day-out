import * as THREE from 'three';
import { VOXEL, STREAM } from '../core/Constants.js';

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

    // --- streaming (milestone 12) ---
    // Columns, not chunks, are the unit of generation: ground strata and a
    // building's full height belong together, and splitting them vertically
    // would mean generating the same building several times over.
    this.generator = null;     // (world, cx, cz) => void, set by the caller
    this.generated = new Set(); // "cx,cz" of columns already built
    // Player damage, kept SEPARATELY from chunk data so it survives an unload.
    // A regenerated chunk comes back pristine otherwise, healing every hole
    // Jimothy made — unacceptable in a game about destruction (Chris,
    // 2026-08-07). Stores EDITS, not chunks, so memory scales with how much
    // has been wrecked rather than with world size.
    this.edits = new Map();    // "cx,cy,cz" -> Map(localIndex -> material)
    // While generating a column, writes outside it are dropped. This is what
    // lets the building writers stay completely unaware of chunks: a house
    // straddling a seam is written in full by every column it touches, and
    // each keeps only its own share.
    this._writeColumn = null;
    // Last streamAround centres, in columns. Bounds where an on-demand query
    // is allowed to build the world — see _ensureAtWorld.
    this._centers = null;
  }

  _key(cx, cy, cz) { return `${cx},${cy},${cz}`; }

  _colKey(cx, cz) { return `${cx},${cz}`; }

  columnOf(vx, vz) {
    const C = VOXEL.CHUNK_XZ;
    return { cx: Math.floor(vx / C), cz: Math.floor(vz / C) };
  }

  /** Build a column if it has not been built yet, then re-apply any damage
   *  done to it before it was unloaded. */
  ensureColumn(cx, cz) {
    const key = this._colKey(cx, cz);
    if (this.generated.has(key) || !this.generator) return false;
    // Marked BEFORE generating: the generator queries the world as it writes,
    // and re-entering here would recurse forever.
    this.generated.add(key);
    this._writeColumn = { cx, cz };
    try {
      this.generator(this, cx, cz);
    } finally {
      this._writeColumn = null;
    }
    this._replayEdits(cx, cz);
    // A neighbour's seam faces were culled against air that is now solid (or
    // exposed against solid that is now gone), so its mesh is stale.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let cy = STREAM.CY_MIN; cy <= STREAM.CY_MAX; cy++) {
        const n = this.chunks.get(this._key(cx + dx, cy, cz + dz));
        if (n) n.dirty = true;
      }
    }
    return true;
  }

  _replayEdits(cx, cz) {
    for (let cy = STREAM.CY_MIN; cy <= STREAM.CY_MAX; cy++) {
      const edits = this.edits.get(this._key(cx, cy, cz));
      if (!edits) continue;
      const chunk = this.chunks.get(this._key(cx, cy, cz))
        || this._createChunk(cx, cy, cz);
      for (const [idx, mat] of edits) chunk.data[idx] = mat;
      chunk.dirty = true;
    }
  }

  /** Drop a column's geometry and data. Its edits are deliberately kept. */
  unloadColumn(cx, cz) {
    if (!this.generated.delete(this._colKey(cx, cz))) return false;
    for (let cy = STREAM.CY_MIN; cy <= STREAM.CY_MAX; cy++) {
      const key = this._key(cx, cy, cz);
      const chunk = this.chunks.get(key);
      if (!chunk) continue;
      if (chunk.mesh) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
      }
      this.chunks.delete(key);
    }
    return true;
  }

  /** Load what is near the player and drop what is not. Budgeted, because
   *  generating several columns in one frame is a visible hitch. */
  streamAround(worldX, worldZ) {
    this.streamAroundPoints([[worldX, worldZ]]);
  }

  /** The same, around SEVERAL centres.
   *
   *  A list rather than a point because the fly camera (milestone 17) detaches
   *  from Jimothy: streaming only around him leaves the camera over ground that
   *  was never generated, and streaming only around the camera pulls the floor
   *  out from under the raccoon. Both discs stay resident. */
  streamAroundPoints(points, budget = STREAM.COLUMNS_PER_FRAME) {
    const C = VOXEL.CHUNK_XZ * VOXEL.SIZE;
    const centers = points.map(([x, z]) => ({
      cx: Math.floor(x / C), cz: Math.floor(z / C),
    }));
    this._centers = centers;

    // Nearest-first, so the ground under the player's feet is never the thing
    // still waiting on the budget.
    const wanted = [];
    const seen = new Set();
    const R = STREAM.LOAD_RADIUS;
    for (const { cx, cz } of centers) {
      for (let dx = -R; dx <= R; dx++) {
        for (let dz = -R; dz <= R; dz++) {
          const key = this._colKey(cx + dx, cz + dz);
          if (this.generated.has(key) || seen.has(key)) continue;
          seen.add(key);
          wanted.push([dx * dx + dz * dz, cx + dx, cz + dz]);
        }
      }
    }
    wanted.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cz] of wanted) {
      if (budget-- <= 0) break;
      this.ensureColumn(cx, cz);
    }

    const U = STREAM.UNLOAD_RADIUS;
    for (const key of [...this.generated]) {
      const [cx, cz] = key.split(',').map(Number);
      const near = centers.some(
        (c) => Math.abs(cx - c.cx) <= U && Math.abs(cz - c.cz) <= U,
      );
      if (!near) this.unloadColumn(cx, cz);
    }
  }

  _createChunk(cx, cy, cz) {
    const CX = VOXEL.CHUNK_XZ;
    const chunk = {
      cx, cy, cz, data: new Uint8Array(CX * VOXEL.CHUNK_Y * CX), mesh: null, dirty: true,
    };
    this.chunks.set(this._key(cx, cy, cz), chunk);
    return chunk;
  }

  _chunkFor(vx, vy, vz, create = false) {
    const CX = VOXEL.CHUNK_XZ;
    const CY = VOXEL.CHUNK_Y;
    const cx = Math.floor(vx / CX);
    const cy = Math.floor(vy / CY);
    const cz = Math.floor(vz / CX);
    // Column filter: while a column is generating, a building that straddles
    // the seam writes far outside it. Dropping those writes here is what keeps
    // the builders chunk-unaware.
    if (create && this._writeColumn
      && (cx !== this._writeColumn.cx || cz !== this._writeColumn.cz)) return null;
    const key = this._key(cx, cy, cz);
    let chunk = this.chunks.get(key);
    if (!chunk && create) chunk = this._createChunk(cx, cy, cz);
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
    if (!chunk) return; // outside the column currently being generated
    chunk.data[this._localIndex(vx, vy, vz)] = mat;
    chunk.dirty = true;
  }

  /** A player-made change: written to the world AND recorded, so it survives
   *  the column being unloaded and regenerated. */
  setEdit(vx, vy, vz, mat) {
    this.set(vx, vy, vz, mat);
    const CX = VOXEL.CHUNK_XZ;
    const key = this._key(
      Math.floor(vx / CX), Math.floor(vy / VOXEL.CHUNK_Y), Math.floor(vz / CX),
    );
    let edits = this.edits.get(key);
    if (!edits) this.edits.set(key, edits = new Map());
    edits.set(this._localIndex(vx, vy, vz), mat);
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

  /** Generate the column under a world position if it does not exist yet.
   *
   *  Every gameplay query goes through this, which makes streaming a
   *  performance concern and never a correctness one. Without it an
   *  ungenerated column reads as empty, `groundHeightAt` returns bedrock
   *  depth, and the player falls through the world — the exact shape of
   *  JIM-19. The streamer normally gets there first, so this is a safety net
   *  that rarely fires rather than the hot path. */
  _ensureAtWorld(x, z) {
    const C = VOXEL.CHUNK_XZ * VOXEL.SIZE;
    const cx = Math.floor(x / C);
    const cz = Math.floor(z / C);
    // Only near the streaming centre. Without this bound, ANY query anywhere
    // builds the world there — and the 26 pedestrians each sample the ground
    // under themselves every frame, from wherever they happen to be. Measured:
    // the loaded set climbed 57 → 83 and kept going on a straight walk,
    // because the entities were re-generating the map faster than the unloader
    // could drop it. Distant queries fall back to grade instead (below), which
    // is right for a background prop and wrong only for the player — and the
    // player is always at the centre by construction.
    if (this._centers && !this._centers.some(
      (c) => Math.abs(cx - c.cx) <= STREAM.LOAD_RADIUS
        && Math.abs(cz - c.cz) <= STREAM.LOAD_RADIUS,
    )) return false;
    return this.ensureColumn(cx, cz);
  }

  /** Has the column covering this world position been built? */
  isLoadedAtWorld(x, z) {
    const C = VOXEL.CHUNK_XZ * VOXEL.SIZE;
    return this.generated.has(this._colKey(Math.floor(x / C), Math.floor(z / C)));
  }

  solidAtWorld(x, y, z) {
    this._ensureAtWorld(x, z);
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
    this._ensureAtWorld(x, z);
    // Too far out to be worth building: report grade rather than the
    // dug-through-to-bedrock answer the scan below would give for empty
    // space. A pedestrian out there would otherwise sink through the floor.
    if (!this.isLoadedAtWorld(x, z)) return 0;
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
    // A blast can straddle a seam into a column that has not been built yet;
    // without this the far half of the crater silently does nothing.
    for (const dx of [-radius, radius]) {
      for (const dz of [-radius, radius]) this._ensureAtWorld(cx + dx, cz + dz);
    }
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
          // Recorded, not just written: this hole has to still be here when
          // the player walks away and comes back.
          this.setEdit(x, y, z, 0);
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
    this.generated.clear();
    // A new run gets a pristine city — damage is per-run, not persistent.
    this.edits.clear();
    this.removedCount = 0;
  }

  stats() {
    let meshes = 0;
    for (const c of this.chunks.values()) if (c.mesh) meshes++;
    let edits = 0;
    for (const m of this.edits.values()) edits += m.size;
    return {
      chunks: this.chunks.size,
      meshes,
      removed: this.removedCount,
      columns: this.generated.size,
      edits,
    };
  }
}
