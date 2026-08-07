import * as THREE from 'three';
import { VOXEL, STREAM, TERRAIN } from '../core/Constants.js';

// Chunked destructible voxel grid (ADR-0003).
//
// Three rules keep this fast enough to actually run, and all three cost about
// the same as doing it naively:
//   1. Geometry is built per CHUNK with hidden faces culled — never a mesh
//      per voxel (that measures ~19k draw calls; this is one per chunk).
//   2. Static structure gets no physics bodies at all. Jimothy is kinematic
//      and already hand-clamped, so he collides by grid lookup instead.
//   3. Ground is IMPLICIT (milestone 17). A voxel with nothing stored in it is
//      not empty — it defers to the terrain height field, which answers
//      "solid?" at any depth for free. Only a constant-thickness skin at the
//      surface is stored, because that is what the mesher draws, and more is
//      materialised only where a blast exposes it. So `TERRAIN.DEPTH` is free:
//      20 m and 200 m have the same boot cost and the same memory, and memory
//      tracks how much has been DUG rather than how deep the world is.
const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

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
    // The implicit ground, injected by installCity: { surfaceHeight(x,z),
    // topSolidVoxelY(x,z), materialAtVoxel(vx,vy,vz) }. Null means the old flat
    // world — every query then answers from stored voxels alone.
    this.terrain = null;
    this.generated = new Set(); // "cx,cz" of columns already built
    // Which chunks belong to a column. Chunks used to be assumed to live in a
    // fixed vertical band (STREAM.CY_MIN..CY_MAX) — true for a flat world, and
    // false the moment the ground runs from a seabed at -10 m to a hilltop at
    // 50 m, or the player digs 20 m down. Tracking what actually exists is
    // both correct and cheaper than widening the band.
    this.columnChunks = new Map(); // "cx,cz" -> Set(chunkKey)
    this.editChunks = new Map();   // "cx,cz" -> Set(chunkKey), for replay
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
      for (const key of this.columnChunks.get(this._colKey(cx + dx, cz + dz)) || []) {
        const n = this.chunks.get(key);
        if (n) n.dirty = true;
      }
    }
    return true;
  }

  _replayEdits(cx, cz) {
    const keys = this.editChunks.get(this._colKey(cx, cz));
    if (!keys) return;
    for (const key of keys) {
      const edits = this.edits.get(key);
      if (!edits) continue;
      const [ex, ey, ez] = key.split(',').map(Number);
      const chunk = this.chunks.get(key) || this._createChunk(ex, ey, ez);
      for (const [idx, mat] of edits) chunk.data[idx] = mat;
      chunk.dirty = true;
    }
    // A hole is a hole because of what SURROUNDS it. Below the stored skin the
    // rock is implicit — solid to every query, invisible to the mesher — so
    // replaying the edits alone brings the crater back as a black void with no
    // walls. Re-expose the faces it cut, exactly as the blast did.
    for (const key of keys) {
      const edits = this.edits.get(key);
      if (!edits) continue;
      const [ex, ey, ez] = key.split(',').map(Number);
      for (const [idx, mat] of edits) {
        if (mat !== VOXEL.EMPTY) continue;
        const CX = VOXEL.CHUNK_XZ;
        const lx = idx % CX;
        const ly = ((idx - lx) / CX) % VOXEL.CHUNK_Y;
        const lz = (idx - lx - ly * CX) / (CX * VOXEL.CHUNK_Y);
        this._materialiseAround(ex * CX + lx, ey * VOXEL.CHUNK_Y + ly, ez * CX + lz);
      }
    }
  }

  /** Drop a column's geometry and data. Its edits are deliberately kept. */
  unloadColumn(cx, cz) {
    const col = this._colKey(cx, cz);
    if (!this.generated.delete(col)) return false;
    for (const key of this.columnChunks.get(col) || []) {
      const chunk = this.chunks.get(key);
      if (!chunk) continue;
      if (chunk.mesh) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
      }
      this.chunks.delete(key);
    }
    this.columnChunks.delete(col);
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
    const centers = points.map(([x, z, radius = STREAM.LOAD_RADIUS]) => ({
      cx: Math.floor(x / C), cz: Math.floor(z / C), radius,
    }));
    this._centers = centers;

    // Nearest-first, so the ground under the player's feet is never the thing
    // still waiting on the budget.
    const wanted = [];
    const seen = new Set();
    for (const { cx, cz, radius: R } of centers) {
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

    // Hysteresis is a MARGIN on each centre's own radius, not a fixed ring:
    // with a fixed one, the fly camera's wider load disc would be unloaded the
    // frame after it was built, and the streamer would thrash forever.
    const margin = STREAM.UNLOAD_RADIUS - STREAM.LOAD_RADIUS;
    for (const key of [...this.generated]) {
      const [cx, cz] = key.split(',').map(Number);
      const near = centers.some(
        (c) => Math.abs(cx - c.cx) <= c.radius + margin
          && Math.abs(cz - c.cz) <= c.radius + margin,
      );
      if (!near) this.unloadColumn(cx, cz);
    }
  }

  _createChunk(cx, cy, cz) {
    const CX = VOXEL.CHUNK_XZ;
    const chunk = {
      cx, cy, cz, data: new Uint8Array(CX * VOXEL.CHUNK_Y * CX), mesh: null, dirty: true,
    };
    const key = this._key(cx, cy, cz);
    this.chunks.set(key, chunk);
    const col = this._colKey(cx, cz);
    let set = this.columnChunks.get(col);
    if (!set) this.columnChunks.set(col, set = new Set());
    set.add(key);
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
   *  the column being unloaded and regenerated.
   *
   *  Removal is recorded as VOXEL.EMPTY, never as 0. With implicit ground a 0
   *  means "nothing stored, ask the height field", so a hole written as 0 heals
   *  itself the next time anything looks at it. */
  setEdit(vx, vy, vz, mat) {
    const stored = mat === 0 ? VOXEL.EMPTY : mat;
    this.set(vx, vy, vz, stored);
    const CX = VOXEL.CHUNK_XZ;
    const cx = Math.floor(vx / CX);
    const cy = Math.floor(vy / VOXEL.CHUNK_Y);
    const cz = Math.floor(vz / CX);
    const key = this._key(cx, cy, cz);
    let edits = this.edits.get(key);
    if (!edits) this.edits.set(key, edits = new Map());
    edits.set(this._localIndex(vx, vy, vz), stored);
    const col = this._colKey(cx, cz);
    let keys = this.editChunks.get(col);
    if (!keys) this.editChunks.set(col, keys = new Set());
    keys.add(key);
  }

  /** The raw stored value: 0 means "nothing here", which is NOT the same as
   *  "empty" — see `get`. VOXEL.EMPTY means the player took it out. */
  storedAt(vx, vy, vz) {
    const chunk = this._chunkFor(vx, vy, vz);
    return chunk ? chunk.data[this._localIndex(vx, vy, vz)] : 0;
  }

  get(vx, vy, vz) {
    const stored = this.storedAt(vx, vy, vz);
    if (stored === VOXEL.EMPTY) return 0;
    if (stored) return stored;
    // Nothing stored: the ground answers for itself. This is what makes depth
    // free — the rock 40 m under a hill is solid to a collision query without
    // a byte of it existing anywhere.
    return this.terrain ? this.terrain.materialAtVoxel(vx, vy, vz) : 0;
  }

  /** Give the mesher something to draw where a blast has just cut into
   *  implicit ground.
   *
   *  Below the stored skin the rock is real to every query and invisible to
   *  the renderer, so a deep hole would come out as a black void. Storing only
   *  the faces a dig EXPOSES is what keeps memory tracking how much has been
   *  dug rather than how deep the world goes. */
  _materialiseAround(vx, vy, vz) {
    if (!this.terrain) return;
    for (const [dx, dy, dz] of NEIGHBOURS) {
      const nx = vx + dx;
      const ny = vy + dy;
      const nz = vz + dz;
      if (this.storedAt(nx, ny, nz)) continue; // already real, or already gone
      const mat = this.terrain.materialAtVoxel(nx, ny, nz);
      // `set`, not `setEdit`: this is the world revealing itself, not damage.
      // Recording it would grow the edit store with every metre dug for no
      // gain — regeneration re-derives it from the holes it already stores.
      if (mat) this.set(nx, ny, nz, mat);
    }
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
      (c) => Math.abs(cx - c.cx) <= c.radius && Math.abs(cz - c.cz) <= c.radius,
    )) return false;
    return this.ensureColumn(cx, cz);
  }

  /** The terrain's own surface, ignoring everything built on it or dug out of
   *  it. What anything that needs to START a ground scan should scan from —
   *  a fixed height only ever meant "grade", and grade is not a constant now. */
  terrainHeightAt(x, z) {
    return this.terrain ? this.terrain.surfaceHeight(x, z) : 0;
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
    const surface = this.terrain ? this.terrain.surfaceHeight(x, z) : 0;
    // Too far out to be worth building: report the terrain's own answer rather
    // than the dug-through-to-bedrock one the scan below would give for empty
    // space. A pedestrian out there would otherwise sink through the floor —
    // and before the height field existed this returned a literal 0, which
    // silently meant "grade" and is now only true at the waterline.
    if (!this.isLoadedAtWorld(x, z)) return surface;
    const s = VOXEL.SIZE;
    const [vx, , vz] = this.worldToVoxel(x, 0, z);
    const top = Math.floor((fromY + stepUp) / s);
    // Bedrock sits DEPTH below this column's own surface, not at a fixed y.
    // Clamped to `top`, so a caller that starts the scan below bedrock gets its
    // own start height back rather than an answer ABOVE where it asked — with
    // `top < bottom` the loop simply never ran, and this silently reported a
    // floor 30 m over the player's head.
    const bottom = Math.min(Math.floor((surface - TERRAIN.DEPTH) / s) - 2, top);
    // Which voxel the terrain's own surface was quantised into. Standing on
    // THAT one means standing on ground the mesher has smoothed, so the honest
    // floor is the height field itself — otherwise he floats or sinks by up to
    // half a voxel on every slope, against a surface he can see.
    //
    // Sampled at the VOXEL CENTRE, because that is where the generator and the
    // mesher sample it. Deriving it from `surface` — the height at the caller's
    // exact (x, z) — disagrees by a whole voxel near a voxel edge on a slope,
    // and the smoothing then silently does not apply there (measured: 0.30 m of
    // drift on a hillside, against 0.02 m once the two agree).
    const terrainTop = this.terrain
      ? this.terrain.topSolidVoxelY((vx + 0.5) * s, (vz + 0.5) * s)
      : NaN;
    for (let vy = top; vy >= bottom; vy--) {
      if (this.get(vx, vy, vz) === 0) continue;
      return vy === terrainTop ? surface : (vy + 1) * s;
    }
    return bottom * s; // dug clean through: fall to bedrock
  }

  /** Can a straight line from A to B reach it without passing through solid?
   *
   *  A DDA march (Amanatides & Woo) over the voxel grid rather than a physics
   *  raycast, because the world has no collision bodies at all — Jimothy is
   *  kinematic and collides by grid lookup (ADR-0003), so there is nothing for
   *  a physics ray to hit. Marching the grid is also exact and free of tuning:
   *  it respects buildings, the rubble he made a second ago, and tunnel walls,
   *  with no extra bookkeeping (milestone 19).
   *
   *  The endpoints' own voxels are skipped. An eye inside a wall and a target
   *  inside rubble are both states the game can legitimately be in, and neither
   *  should mean "blind". */
  hasLineOfSight(ax, ay, az, bx, by, bz) {
    const s = VOXEL.SIZE;
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    let [x, y, z] = this.worldToVoxel(ax, ay, az);
    const [ex, ey, ez] = this.worldToVoxel(bx, by, bz);
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const stepZ = Math.sign(dz);
    // Parametric distance (in t, where t = 1 is B) to the next grid plane on
    // each axis, and how much t one whole voxel costs.
    const boundary = (v, step) => (step > 0 ? (v + 1) * s : v * s);
    let tMaxX = dx === 0 ? Infinity : (boundary(x, stepX) - ax) / dx;
    let tMaxY = dy === 0 ? Infinity : (boundary(y, stepY) - ay) / dy;
    let tMaxZ = dz === 0 ? Infinity : (boundary(z, stepZ) - az) / dz;
    const tDeltaX = dx === 0 ? Infinity : Math.abs(s / dx);
    const tDeltaY = dy === 0 ? Infinity : Math.abs(s / dy);
    const tDeltaZ = dz === 0 ? Infinity : Math.abs(s / dz);

    // A hard iteration cap rather than trusting the loop to terminate: this
    // runs per pursuer per frame, and a degenerate ray must cost a bounded
    // amount rather than freezing the game.
    const maxSteps = Math.ceil((Math.abs(dx) + Math.abs(dy) + Math.abs(dz)) / s) + 3;
    for (let n = 0; n < maxSteps; n++) {
      if (x === ex && y === ey && z === ez) return true;
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        if (tMaxX > 1) return true;
        x += stepX; tMaxX += tDeltaX;
      } else if (tMaxY < tMaxZ) {
        if (tMaxY > 1) return true;
        y += stepY; tMaxY += tDeltaY;
      } else {
        if (tMaxZ > 1) return true;
        z += stepZ; tMaxZ += tDeltaZ;
      }
      if (x === ex && y === ey && z === ez) return true;
      if (this.get(x, y, z) !== 0) return false;
    }
    return true;
  }

  /** Clear voxels in a sphere. Returns the world-space centers removed so the
   *  caller can spawn debris where the wall actually was.
   *
   *  `digsTerrain: false` means "smash the house, spare the ground" — how the
   *  moves distinguish demolition from digging (MOVES.DIGS_TERRAIN).
   *
   *  It used to be an absolute voxel floor of 0, because terrain lived at y < 0
   *  and structures started at 0. On a height field that constant silently
   *  meant "the waterline": a headbutt on a 50 m hill would have been told to
   *  spare everything below y = 0 and cheerfully cratered the hillside. The
   *  floor is now the column's OWN surface, which is what the constant always
   *  meant. (Third constant of this family — see docs/STATE.md.) */
  damageSphere(cx, cy, cz, radius, { digsTerrain = true } = {}) {
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
      for (let z = bz - r; z <= bz + r; z++) {
        // One height lookup per COLUMN of the blast, not per voxel.
        const floor = digsTerrain || !this.terrain
          ? -Infinity
          : this.terrain.topSolidVoxelY((x + 0.5) * s, (z + 0.5) * s);
        const wx = (x + 0.5) * s;
        const wz = (z + 0.5) * s;
        for (let y = Math.max(by - r, floor + 1); y <= by + r; y++) {
          const mat = this.get(x, y, z);
          if (mat === 0 || mat === VOXEL.BEDROCK) continue;
          const wy = (y + 0.5) * s;
          if (Math.hypot(wx - cx, wy - cy, wz - cz) > radius) continue;
          // Recorded, not just written: this hole has to still be here when
          // the player walks away and comes back.
          this.setEdit(x, y, z, 0);
          removed.push({ x: wx, y: wy, z: wz, mat });
        }
      }
    }
    // Only after every removal, or a face exposed by one voxel would be
    // re-materialised and then removed again by the next.
    for (const cell of removed) {
      const [vx, vy, vz] = this.worldToVoxel(cell.x, cell.y, cell.z);
      this._materialiseAround(vx, vy, vz);
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

    // Face culling asks "is my neighbour solid?" six times per voxel, and with
    // implicit ground every one of those is a height-field sample. Answering
    // them through `get()` measured out at tens of thousands of bilinear
    // lookups per chunk. The surface only varies per COLUMN, so cache the
    // topmost solid terrain voxel once for the chunk plus a one-voxel skirt:
    // 4356 samples instead of ~60000, and the inner loop becomes an integer
    // compare.
    const P = CX + 2;
    const tops = new Int32Array(P * P);
    if (this.terrain) {
      for (let lz = -1; lz <= CX; lz++) {
        for (let lx = -1; lx <= CX; lx++) {
          tops[(lz + 1) * P + (lx + 1)] = this.terrain.topSolidVoxelY(
            (base[0] + lx + 0.5) * s, (base[2] + lz + 0.5) * s,
          );
        }
      }
    } else {
      tops.fill(-2147483648);
    }

    // --- smoothing (playtest 2026-08-07) -------------------------------------
    //
    // The height field is continuous; the voxels are 0.55 m. Quantising one
    // into the other terraces every hillside — a step roughly every metre on
    // Trash Panda Heights, which reads as a staircase rather than a hill.
    //
    // The fix costs no geometry: the top face of an UNDISTURBED ground voxel
    // has its four corners moved to the exact height field. Corners are lattice
    // points, so neighbouring voxels — and neighbouring CHUNKS — sample the same
    // world position and get the same answer. The surface comes out continuous
    // and watertight by construction rather than by tolerance.
    //
    // Only the top face, and only where nothing has happened to the ground.
    // Everything the player MAKES stays hard-edged: a crater's floor is no
    // longer the terrain's top voxel, so it drops out of this and renders
    // blocky. Smooth is what you found, voxel is what you did to it.
    //
    // Side walls are still emitted (never skipped): a step's wall ends up buried
    // under the tilted quad above it, and skipping them opens half-voxel cracks
    // wherever a smoothed column meets an unsmoothed one.
    const Q = CX + 3;
    const cornerH = new Float32Array(Q * Q);
    const intact = new Uint8Array(P * P);
    if (this.terrain) {
      for (let lz = -1; lz <= CX + 1; lz++) {
        for (let lx = -1; lx <= CX + 1; lx++) {
          // LATTICE corners, not voxel centres — that is what makes the value
          // shared between the voxels either side of it.
          cornerH[(lz + 1) * Q + (lx + 1)] = this.terrain.surfaceHeight(
            (base[0] + lx) * s, (base[2] + lz) * s,
          );
        }
      }
      for (let lz = -1; lz <= CX; lz++) {
        for (let lx = -1; lx <= CX; lx++) {
          const top = tops[(lz + 1) * P + (lx + 1)];
          const here = this.storedAt(base[0] + lx, top, base[2] + lz);
          const above = this.storedAt(base[0] + lx, top + 1, base[2] + lz);
          // Intact = the terrain's own top voxel is still there, with open air
          // over it. A dug column fails the first test; one with a building or a
          // foundation on it fails the second, and a wall must not be smeared
          // into the hillside it stands on.
          intact[(lz + 1) * P + (lx + 1)] =
            here && here !== VOXEL.EMPTY && (!above || above === VOXEL.EMPTY) ? 1 : 0;
        }
      }
    }
    const isTerrainTop = (lx, ly, lz) => this.terrain
      && intact[(lz + 1) * P + (lx + 1)] === 1
      && base[1] + ly === tops[(lz + 1) * P + (lx + 1)];
    const corner = (lx, lz) => cornerH[(lz + 1) * Q + (lx + 1)];
    // Vertex normal straight off the height field's gradient, which is where the
    // rest of the win is: flat-lit terraces band a hillside into stripes even
    // when the geometry underneath them is already smooth. Central differences
    // over corners that have been computed anyway, so it costs nothing.
    const slopeNormal = (lx, lz, out) => {
      const dx = (corner(lx + 1, lz) - corner(lx - 1, lz)) / (2 * s);
      const dz = (corner(lx, lz + 1) - corner(lx, lz - 1)) / (2 * s);
      const len = Math.hypot(dx, 1, dz);
      out[0] = -dx / len;
      out[1] = 1 / len;
      out[2] = -dz / len;
    };
    const nrm = [0, 1, 0];
    /** Occupancy for a voxel given in LOCAL coordinates, where lx/lz may be -1
     *  or CX and ly may be -1 or CY (the one-voxel skirt the faces need). */
    const occupied = (lx, ly, lz) => {
      const inside = lx >= 0 && lx < CX && ly >= 0 && ly < CY && lz >= 0 && lz < CX;
      const stored = inside
        ? chunk.data[lx + CX * (ly + CY * lz)]
        : this.storedAt(base[0] + lx, base[1] + ly, base[2] + lz);
      if (stored) return stored !== VOXEL.EMPTY;
      return base[1] + ly <= tops[(lz + 1) * P + (lx + 1)];
    };

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
          // EMPTY is a hole the player made, not a material to draw.
          if (!mat || mat === VOXEL.EMPTY) continue;
          const vx = base[0] + lx;
          const vy = base[1] + ly;
          const vz = base[2] + lz;
          const color = this._colors.get(mat) || this._colors.get(1);
          const smooth = isTerrainTop(lx, ly, lz);
          for (const f of FACES) {
            if (occupied(lx + f.d[0], ly + f.d[1], lz + f.d[2])) continue;
            // Undisturbed ground: every vertex on the voxel's TOP plane moves to
            // the real surface. That covers the top face and the upper edge of
            // any side wall in one rule, so the two always meet.
            const quad = f.v.map(([ox, oy, oz]) => [
              (vx + ox) * s,
              smooth && oy === 1 ? corner(lx + ox, lz + oz) : (vy + oy) * s,
              (vz + oz) * s,
            ]);
            const lit = smooth && f.d[1] === 1;
            for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
              for (const idx of [a, b, c]) {
                pos.push(quad[idx][0], quad[idx][1], quad[idx][2]);
                if (lit) {
                  slopeNormal(lx + f.v[idx][0], lz + f.v[idx][2], nrm);
                  norm.push(nrm[0], nrm[1], nrm[2]);
                } else {
                  norm.push(f.d[0], f.d[1], f.d[2]);
                }
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
    this.columnChunks.clear();
    this.generated.clear();
    // A new run gets a pristine city — damage is per-run, not persistent.
    this.edits.clear();
    this.editChunks.clear();
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
