import * as THREE from 'three';
import {eventBus,Events} from '../core/EventBus.js';
import {VoxelBatches} from '../core/VoxelBatches.js';
import {supportTask} from '../core/VoxelSupport.js';
import {DamagedGround} from './DamagedGround.js';
import { VOXEL, STREAM, TERRAIN, PAVING, VOXEL_BATCH, BEACH, GROUND_CHANNEL, SUPPORT, WORK_BUDGET as W, GLAZING as G } from '../core/Constants.js';

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
    this.glassMaterial = new THREE.MeshPhysicalMaterial({color:G.COLOR,roughness:G.ROUGHNESS,transmission:G.TRANSMISSION,thickness:G.THICKNESS,ior:G.IOR,side:THREE.DoubleSide});
    this.renderBatches=new VoxelBatches(scene,[this.material,this.glassMaterial]);
    this.removedCount = 0;
    this.damageQueue = [];
    this.damageTurn = 0;
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
    this.dugSurface=new DamagedGround(this);
    // While generating a column, writes outside it are dropped. This is what
    // lets the building writers stay completely unaware of chunks: a house
    // straddling a seam is written in full by every column it touches, and
    // each keeps only its own share.
    this._writeColumn = null;
    // Last streamAround centres, in columns. Bounds where an on-demand query
    // is allowed to build the world — see _ensureAtWorld.
    this._meshWork = null;
    this._columnWork = new Map();
    this.lastMeshSlices = 0;
    this.lastMeshMs = 0;
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
    if(this.generated.has(this._colKey(cx,cz))||!this.generator)return false;
    const work=this.queueColumn(cx,cz);
    while(work&&!this.generated.has(work.key))this._stepColumn(work);
    return true;
  }

  queueColumn(cx,cz){
    const key=this._colKey(cx,cz);
    if(this.generated.has(key)||!this.generator)return null;
    if(this._columnWork.has(key))return this._columnWork.get(key);
    const work={cx,cz,key,phase:'generate'};
    work.task=this._columnTask(work);this._columnWork.set(key,work);return work;
  }

  *_columnTask(work){
    const generated=this.generator(this,work.cx,work.cz);
    if(generated?.next)yield*generated;
    work.phase='edits';this._writeColumn=null;yield;
    yield*this._replayEditsTask(work.cx,work.cz);
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]])for(const key of this.columnChunks.get(this._colKey(work.cx+dx,work.cz+dz))||[]){
      const neighbour=this.chunks.get(key);if(neighbour)this._markDirty(neighbour);
    }
  }

  _stepColumn(work){
    this._writeColumn=work.phase==='generate'?{cx:work.cx,cz:work.cz}:null;
    let result;
    try{result=work.task.next();}finally{this._writeColumn=null;}
    if(result.done){this.generated.add(work.key);this._columnWork.delete(work.key);}
    return result.done;
  }

  processGeneration({maxMilliseconds=Infinity,maxSlices=Infinity}={}){
    const started=performance.now();let slices=0;
    while(slices<maxSlices&&performance.now()-started<maxMilliseconds&&this._columnWork.size){
      let work=null,distance=Infinity;
      for(const candidate of this._columnWork.values()){
        const d=this._centers?.length?Math.min(...this._centers.map(c=>(candidate.cx-c.cx)**2+(candidate.cz-c.cz)**2)):0;
        if(d<distance){distance=d;work=candidate;}
      }
      this._stepColumn(work);slices++;
    }
    this.lastGenerationMs=performance.now()-started;return slices;
  }

  *_replayEditsTask(cx, cz) {

    const keys = this.editChunks.get(this._colKey(cx, cz));
    if (!keys) return;
    for (const key of keys) {
      const edits = this.edits.get(key);
      if (!edits) continue;
      const [ex, ey, ez] = key.split(',').map(Number);
      const chunk = this.chunks.get(key) || this._createChunk(ex, ey, ez);
      let replayed=0;
      for (const [idx,mat]of edits){this._updateOccupancy(chunk,idx,mat);if(++replayed%W.REPLAY_BATCH===0)yield;}
      this._markDirty(chunk);
    }
    // A hole is a hole because of what SURROUNDS it. Below the stored skin the
    // rock is implicit — solid to every query, invisible to the mesher — so
    // replaying the edits alone brings the crater back as a black void with no
    // walls. Re-expose the faces it cut, exactly as the blast did.
    for (const key of keys) {
      const edits = this.edits.get(key);
      if (!edits) continue;
      const [ex, ey, ez] = key.split(',').map(Number);
      let revealed=0;
      for (const [idx, mat] of edits) {
        if(++revealed%W.REPLAY_BATCH===0)yield;
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
    const resident=this.generated.delete(col),pending=this._columnWork.delete(col);
    if(!resident&&!pending)return false;
    this.dugSurface.clear();
    for (const key of this.columnChunks.get(col) || []) {
      const chunk = this.chunks.get(key);
      if (!chunk) continue;
      if (chunk.mesh) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
      }
      this.renderBatches.remove(chunk);
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
          if (this.generated.has(key) || this._columnWork.has(key) || seen.has(key)) continue;
          seen.add(key);
          wanted.push([dx * dx + dz * dz, cx + dx, cz + dz]);
        }
      }
    }
    wanted.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cz] of wanted) {
      if (budget-- <= 0) break;
      if(this.incrementalStreaming){
        if(this._columnWork.size>=W.MAX_COLUMN_QUEUE)break;
        this.queueColumn(cx,cz);
      }else this.ensureColumn(cx, cz);
    }

    // Hysteresis is a MARGIN on each centre's own radius, not a fixed ring:
    // with a fixed one, the fly camera's wider load disc would be unloaded the
    // frame after it was built, and the streamer would thrash forever.
    const margin = STREAM.UNLOAD_RADIUS - STREAM.LOAD_RADIUS;
    for (const key of new Set([...this.generated,...this._columnWork.keys()])) {
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
      cx, cy, cz, data: new Uint8Array(CX * VOXEL.CHUNK_Y * CX), rowCounts:new Uint16Array(CX*VOXEL.CHUNK_Y),solidCount:0,damageColumns:new Map(),terrainTops:new Int32Array(CX*CX).fill(-2147483648), mesh: null, dirty: true, revision: 0,
    };
    const key = this._key(cx, cy, cz);
    this.chunks.set(key, chunk);
    const col = this._colKey(cx, cz);
    let set = this.columnChunks.get(col);
    if (!set) this.columnChunks.set(col, set = new Set());
    set.add(key);
    return chunk;
  }

  _updateOccupancy(chunk,index,mat){
    const C=VOXEL.CHUNK_XZ,CY=VOXEL.CHUNK_Y,x=index%C,row=Math.floor(index/C),y=row%CY,z=Math.floor(row/CY),column=x+C*z;
    const old=chunk.data[index],delta=Number(!!mat&&mat!==VOXEL.EMPTY)-Number(!!old&&old!==VOXEL.EMPTY);
    chunk.rowCounts[row]+=delta;chunk.solidCount+=delta;chunk.data[index]=mat;
    let floor=chunk.terrainTops[column];
    if(floor===-2147483648){floor=this.terrain?this.terrain.topSolidVoxelY((chunk.cx*C+x+.5)*VOXEL.SIZE,(chunk.cz*C+z+.5)*VOXEL.SIZE):-2147483647;chunk.terrainTops[column]=floor;}
    let bits=chunk.damageColumns.get(column)||0;
    if(mat&&mat!==VOXEL.EMPTY&&chunk.cy*CY+y>floor)bits|=1<<y;else bits&=~(1<<y);
    if(bits)chunk.damageColumns.set(column,bits>>>0);else chunk.damageColumns.delete(column);
  }

  _markDirty(chunk) { chunk.dirty = true; chunk.revision = (chunk.revision || 0) + 1; this.dugSurface?.clear(); }

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
    const index=this._localIndex(vx,vy,vz);this._updateOccupancy(chunk,index,mat);
    this._markDirty(chunk);
    if(!this._writeColumn){
      // A shared ground corner also belongs to the diagonal chunk. Its
      // supporting floor can sit two rows below an edited border voxel.
      const C=VOXEL.CHUNK_XZ,Y=VOXEL.CHUNK_Y,r=TERRAIN.DUG_SMOOTH_RISE;
      for(let cx=Math.floor((vx-1)/C);cx<=Math.floor((vx+1)/C);cx++)
        for(let cy=Math.floor((vy-r)/Y);cy<=Math.floor((vy+r)/Y);cy++)
          for(let cz=Math.floor((vz-1)/C);cz<=Math.floor((vz+1)/C);cz++){
            const neighbour=this.chunks.get(this._key(cx,cy,cz));if(neighbour&&neighbour!==chunk)this._markDirty(neighbour);
          }
    }
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
    const chunk=this._chunkFor(vx,vy,vz),index=this._localIndex(vx,vy,vz);
    // Saved holes remain real while a streamed column is only partly rebuilt.
    // Deferring this overlay until generation finishes briefly heals craters.
    if(this.edits.size){
      const key=chunk?this._key(chunk.cx,chunk.cy,chunk.cz):this._key(Math.floor(vx/VOXEL.CHUNK_XZ),Math.floor(vy/VOXEL.CHUNK_Y),Math.floor(vz/VOXEL.CHUNK_XZ));
      const edit=this.edits.get(key)?.get(index);if(edit!==undefined)return edit;
    }
    return chunk?chunk.data[index]:0;
  }

  get(vx, vy, vz) {
    const stored = this.storedAt(vx, vy, vz);
    if (stored === VOXEL.EMPTY) return 0;
    if(this.channels?.cells&&this.terrain){
      const x=(vx+.5)*VOXEL.SIZE,z=(vz+.5)*VOXEL.SIZE,offset=this.channels.sample(x,z);
      if(offset){
        const oldTop=this.terrain.topSolidVoxelY(x,z),top=Math.ceil((this.terrain.surfaceHeight(x,z)+offset)/VOXEL.SIZE)-1;
        if(vy>top&&vy<=oldTop)return 0;
        if(vy>oldTop&&vy<=top)return GROUND_CHANNEL.DIRT_MATERIAL;
      }
    }
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
    if(this.incrementalStreaming){if(this._columnWork.size<W.MAX_COLUMN_QUEUE)this.queueColumn(cx,cz);return false;}
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

  sandOffsetAt(x,z) {
    const offset=this.sand?.sample(x,z)||0;
    if(!offset||!this.terrain?.sandAt?.(x,z))return 0;
    const s=VOXEL.SIZE,vx=Math.floor(x/s),vz=Math.floor(z/s),top=this.terrain.topSolidVoxelY((vx+.5)*s,(vz+.5)*s);
    const mat=this.get(vx,top,vz);
    return (mat===BEACH.DRY_MATERIAL||mat===BEACH.WET_MATERIAL)&&!this.get(vx,top+1,vz)?offset:0;
  }

  solidAtWorld(x, y, z) {
    this._ensureAtWorld(x, z);
    const surface=this.terrainHeightAt(x,z)+(this.channels?.sample(x,z)||0),offset=this.sandOffsetAt(x,z);
    if(offset && Math.abs(y-surface)<=VOXEL.SIZE+BEACH.MAX_DEPTH)return y<=surface+offset;
    const [vx, vy, vz] = this.worldToVoxel(x, y, z),s=VOXEL.SIZE;
    if(this.dugSurface.nearby(vx,vz))for(let q=vy+TERRAIN.DUG_SMOOTH_RISE;q>=vy-TERRAIN.DUG_SMOOTH_RISE;q--){
      const patch=this.dugSurface.patch(vx,q,vz);if(!patch)continue;
      const height=this.dugSurface.height(x,z,patch),top=this.terrain.topSolidVoxelY((vx+.5)*s,(vz+.5)*s);
      const original=q===top?surface:(q+1)*s;
      if(y>=Math.min(original,height)&&y<=Math.max(original,height))return y<=height;
    }
    if(this.terrain&&Math.abs(y-surface)<=s){
      const cx=(vx+.5)*s,cz=(vz+.5)*s,channel=this.channels?.sample(cx,cz)||0;
      const top=channel?Math.ceil((this.terrain.surfaceHeight(cx,cz)+channel)/s)-1:this.terrain.topSolidVoxelY(cx,cz);
      // M55/JIM-93: rendered terrain crosses the storage-cell boundary. Raw
      // occupancy catches the uphill body probe on an invisible square lip.
      // Only an intact, exposed ground cap may replace that cell's contact.
      if(TERRAIN.SMOOTH_CONTACT_MATERIALS.includes(this.get(vx,top,vz))&&!this.get(vx,top+1,vz))return y<=surface;
    }
    return this.get(vx, vy, vz) !== 0;
  }

  /** Height of the surface directly beneath `fromY` at (x,z).
   *
   *  Scanning must start just above the feet, NOT from a fixed ceiling —
   *  otherwise the highest voxel anywhere in the column wins and walking past
   *  a house snaps the player onto its roof (and re-hopping off that climbs
   *  him into the sky). `stepUp` is the small lip he's allowed to mount. */
  physicalGroundHeightAt(x,z,fromY=0,stepUp=VOXEL.SIZE*.75){
    let height=this.groundHeightAt(x,z,fromY,stepUp);
    eventBus.emit(Events.PHYSICAL_GROUND,{x,z,fromY,stepUp,receive:y=>{height=Math.max(height,y);}});
    return height;
  }

  physicalSolidAtWorld(x,y,z){
    if(this.solidAtWorld(x,y,z))return true;
    let solid=false;eventBus.emit(Events.PHYSICAL_OBSTACLE,{x,y,z,receive:hit=>{solid ||= hit;}});return solid;
  }

  groundHeightAt(x, z, fromY = 0, stepUp = VOXEL.SIZE * 0.75) {
    this._ensureAtWorld(x, z);
    const channel=this.channels?.sample(x,z)||0;
    const surface = (this.terrain ? this.terrain.surfaceHeight(x, z) : 0)+channel+this.sandOffsetAt(x,z);
    // Too far out to be worth building: report the terrain's own answer rather
    // than the dug-through-to-bedrock one the scan below would give for empty
    // space. A pedestrian out there would otherwise sink through the floor —
    // and before the height field existed this returned a literal 0, which
    // silently meant "grade" and is now only true at the waterline.
    const column=this.columnOf(Math.floor(x/VOXEL.SIZE),Math.floor(z/VOXEL.SIZE));
    if(!this.isLoadedAtWorld(x,z)&&!this.editChunks.has(this._colKey(column.cx,column.cz)))return surface;
    const s = VOXEL.SIZE;
    const [vx, , vz] = this.worldToVoxel(x, 0, z);
    const top = Math.floor((fromY + stepUp) / s);
    if(this.dugSurface.nearby(vx,vz))for(let q=top+TERRAIN.DUG_SMOOTH_RISE;q>top;q--){
      const patch=this.dugSurface.patch(vx,q,vz);if(!patch)continue;
      const height=this.dugSurface.height(x,z,patch);if(height<=fromY+stepUp)return height;
    }
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
      ? this.channels?.sample((vx+.5)*s,(vz+.5)*s)
        ?Math.ceil((this.terrain.surfaceHeight((vx+.5)*s,(vz+.5)*s)+this.channels.sample((vx+.5)*s,(vz+.5)*s))/s)-1
        :this.terrain.topSolidVoxelY((vx + 0.5) * s, (vz + 0.5) * s)
      : NaN;
    if(this.terrain&&fromY+stepUp>=surface&&this.get(vx,terrainTop,vz)!==0){
      // Traffic probes used to march dozens of known-empty air cells per
      // wheel/look-ahead sample. The damage index already stores every solid
      // above grade. Holes and underground queries keep the exact scan below.
      const C=VOXEL.CHUNK_XZ,CY=VOXEL.CHUNK_Y,lx=vx-column.cx*C,lz=vz-column.cz*C;let support=terrainTop;
      for(const key of this.columnChunks.get(this._colKey(column.cx,column.cz))||[]){
        const chunk=this.chunks.get(key);if(!chunk)continue;
        const ceiling=Math.min(CY-1,top-chunk.cy*CY);if(ceiling<0)continue;
        let mask=((chunk.damageColumns.get(lx+C*lz)||0)&(2**(ceiling+1)-1))>>>0;
        while(mask){
          const y=31-Math.clz32(mask),vy=chunk.cy*CY+y;
          if(vy<=support)break;
          if(this.get(vx,vy,vz)!==0){support=vy;break;}
          mask=(mask&~(1<<y))>>>0;
        }
      }
      const patch=this.dugSurface.patch(vx,support,vz);
      return patch?this.dugSurface.height(x,z,patch):support===terrainTop&&TERRAIN.SMOOTH_CONTACT_MATERIALS.includes(this.get(vx,support,vz))?surface:(support+1)*s;
    }
    for (let vy = top; vy >= bottom; vy--) {
      if (this.get(vx, vy, vz) === 0) continue;
      const patch=this.dugSurface.patch(vx,vy,vz);
      return patch?this.dugSurface.height(x,z,patch):vy===terrainTop&&TERRAIN.SMOOTH_CONTACT_MATERIALS.includes(this.get(vx,vy,vz))?surface:(vy+1)*s;
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
  _clearDynamicSight(ax,ay,az,bx,by,bz){
    const line={ax,ay,az,bx,by,bz,fraction:1};eventBus.emit(Events.WORLD_OCCLUSION,line);return line.fraction>=1;
  }

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
      if (x === ex && y === ey && z === ez) return this._clearDynamicSight(ax,ay,az,bx,by,bz);
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        if (tMaxX > 1) return this._clearDynamicSight(ax,ay,az,bx,by,bz);
        x += stepX; tMaxX += tDeltaX;
      } else if (tMaxY < tMaxZ) {
        if (tMaxY > 1) return this._clearDynamicSight(ax,ay,az,bx,by,bz);
        y += stepY; tMaxY += tDeltaY;
      } else {
        if (tMaxZ > 1) return this._clearDynamicSight(ax,ay,az,bx,by,bz);
        z += stepZ; tMaxZ += tDeltaZ;
      }
      if (x === ex && y === ey && z === ez) return this._clearDynamicSight(ax,ay,az,bx,by,bz);
      if (this.get(x, y, z) !== 0) return false;
    }
    return this._clearDynamicSight(ax,ay,az,bx,by,bz);
  }

  /** The first solid cell a ray enters, with the face normal of the side it
   *  came in through — or null if it reaches `maxDist` through open air.
   *
   *  Same Amanatides & Woo traversal as `hasLineOfSight`, and for the same
   *  reason: the world has no collision bodies at all (ADR-0003), so there is
   *  nothing for a physics raycast to hit. Marching the grid also gets implicit
   *  ground, buildings, tunnel walls and the rubble he made a second ago for
   *  free, because they are all just `get`.
   *
   *  Two callers, both from milestone 21: the aiming reticle, which has to land
   *  ON what you point at rather than hang at a fixed range (JIM-39), and the
   *  camera boom, which has to stop before it ends up inside the rock (JIM-41).
   *
   *  The ORIGIN's own voxel is skipped, exactly as in `hasLineOfSight`. An eye
   *  clipped a few centimetres into a wall is a state the game can be in, and
   *  reporting a hit at zero distance there pins the camera to his nose.
   *
   *  No `_ensureAtWorld` in the loop: both callers march tens of metres, well
   *  inside the streamed disc, and generating a column mid-march would turn a
   *  per-frame query into a frame hitch. Unstored cells still answer correctly
   *  for ground, because that is what implicit ground means. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    const len = Math.hypot(dx, dy, dz);
    if (!len || !(maxDist > 0)) return null;
    const s = VOXEL.SIZE;
    const ux = dx / len;
    const uy = dy / len;
    const uz = dz / len;
    let [x, y, z] = this.worldToVoxel(ox, oy, oz);
    const stepX = Math.sign(ux);
    const stepY = Math.sign(uy);
    const stepZ = Math.sign(uz);
    const boundary = (v, step) => (step > 0 ? (v + 1) * s : v * s);
    // Distance (in world units, since the direction is unit-length) to the next
    // grid plane on each axis, and what one whole voxel costs.
    let tMaxX = ux === 0 ? Infinity : (boundary(x, stepX) - ox) / ux;
    let tMaxY = uy === 0 ? Infinity : (boundary(y, stepY) - oy) / uy;
    let tMaxZ = uz === 0 ? Infinity : (boundary(z, stepZ) - oz) / uz;
    const tDeltaX = ux === 0 ? Infinity : Math.abs(s / ux);
    const tDeltaY = uy === 0 ? Infinity : Math.abs(s / uy);
    const tDeltaZ = uz === 0 ? Infinity : Math.abs(s / uz);
    // A hard cap rather than trusting termination: this runs per frame, and a
    // degenerate ray must cost a bounded amount rather than freezing the game.
    // Three axes can each be crossed once per voxel of travel.
    const maxSteps = Math.ceil((maxDist / s) * 3) + 3;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let n = 0; n < maxSteps; n++) {
      let t;
      // The normal is the face just crossed, which is the axis that advanced,
      // pointing back the way the ray came.
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        t = tMaxX; x += stepX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        t = tMaxY; y += stepY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
      } else {
        t = tMaxZ; z += stepZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
      if (t > maxDist) return null;
      if (this.get(x, y, z) === 0) continue;
      return {
        t, nx, ny, nz, vx: x, vy: y, vz: z,
        x: ox + ux * t, y: oy + uy * t, z: oz + uz * t,
      };
    }
    return null;
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
    const result=[];
    for(const batch of this._damageSphereTask({cx,cy,cz,radius,digsTerrain}))result.push(...batch);
    return result;
  }

  queueDamageSphere(cx,cy,cz,radius,{digsTerrain=false,key=null}={}){
    if(!(radius>0))return false;
    const job={cx,cy,cz,radius,digsTerrain,key,started:false};
    const replacement=key?this.damageQueue.findIndex(j=>j.key===key&&!j.started):-1;
    if(replacement>=0)this.damageQueue[replacement]=job;
    else if(this.damageQueue.length<W.MAX_DAMAGE_QUEUE)this.damageQueue.push(job);
    else return false;
    return true;
  }

  queueGroundChannel(from,to,radius,depth){
    if(!(radius>0&&depth>0)||!this.terrain)return false;
    if(this.channels)return this.channels.queue(from,to,radius,depth);
    let job=this.damageQueue.find(j=>j.kind==='channel');
    if(!job){
      if(this.damageQueue.length>=W.MAX_DAMAGE_QUEUE)return false;
      job={kind:'channel',segments:[],started:false};this.damageQueue.push(job);
    }
    if(job.segments.length>=GROUND_CHANNEL.MAX_SEGMENTS)return false;
    job.segments.push({from:{...from},to:{...to},radius,depth});
    Object.assign(job,{cx:to.x,cy:to.y,cz:to.z});return true;
  }

  *_groundChannelTask(job){
    const s=VOXEL.SIZE;let removed=[],visited=0;
    while(job.segments.length){
      const {from,to,radius,depth}=job.segments[0],dx=to.x-from.x,dz=to.z-from.z,length2=dx*dx+dz*dz,r2=radius*radius;
      const minX=Math.floor((Math.min(from.x,to.x)-radius)/s),maxX=Math.floor((Math.max(from.x,to.x)+radius)/s);
      const minZ=Math.floor((Math.min(from.z,to.z)-radius)/s),maxZ=Math.floor((Math.max(from.z,to.z)+radius)/s);
      for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
        if(++visited%W.DAMAGE_BATCH===0){yield removed;removed=[];}
        const wx=(x+.5)*s,wz=(z+.5)*s,t=length2?Math.max(0,Math.min(1,((wx-from.x)*dx+(wz-from.z)*dz)/length2)):0;
        const distance2=(wx-from.x-dx*t)**2+(wz-from.z-dz*t)**2;if(distance2>=r2)continue;
        const surface=this.terrain.surfaceHeight(wx,wz),feet=from.y+(to.y-from.y)*t;
        if(Math.abs(surface-feet)>depth+s)continue;
        // The original grade caps excavation. Repeated trips deepen neither
        // the trench nor the queue, and the banks taper into untouched ground.
        const bottom=Math.ceil((surface-depth*(1-distance2/r2))/s-.5),top=this.terrain.topSolidVoxelY(wx,wz);
        for(let y=top;y>=bottom;y--){
          if(++visited%W.DAMAGE_BATCH===0){yield removed;removed=[];}
          const mat=this.get(x,y,z);if(mat===VOXEL.BEDROCK)break;if(!mat)continue;
          this.setEdit(x,y,z,0);this._materialiseAround(x,y,z);this.removedCount++;
          removed.push({x:wx,y:(y+.5)*s,z:wz,mat});
        }
      }
      job.segments.shift();
      if(removed.length){yield removed;removed=[];}
    }
  }

  processDamage({maxMilliseconds=Infinity,maxSlices=Infinity}={}){
    const started=performance.now(),reports=[];let slices=0;
    while(this.damageQueue.length&&slices<maxSlices&&performance.now()-started<maxMilliseconds){
      // Alternate ground and structural work so a large building cannot
      // postpone the physical rolling floor until several streets later.
      const channel=this.damageQueue.findIndex(j=>j.kind==='channel');
      const impact=this.damageQueue.findIndex(j=>j.kind!=='channel'&&j.kind!=='support'),support=this.damageQueue.findIndex(j=>j.kind==='support');
      this.supportTurn=(this.supportTurn||0)+1;
      const structure=support>=0&&(impact<0||this.supportTurn%SUPPORT.DAMAGE_SHARE===0)?support:impact;
      const index=channel>=0&&(this.damageTurn++%2===0||structure<0)?channel:Math.max(0,structure);
      const job=this.damageQueue[index];job.started=true;job.task??=job.kind==='channel'?this._groundChannelTask(job):this._damageSphereTask(job);
      const batch=job.task.next();slices++;
      if(batch.value?.length){
        let report=reports.find(r=>r.job===job);if(!report){report={job,cells:[]};reports.push(report);}
        report.cells.push(...batch.value);
      }
      if(batch.done)this.damageQueue.splice(index,1);
    }
    this.lastDamageMs=performance.now()-started;return reports;
  }

  supportTask(bounds){return supportTask(this,bounds);}

  queueSupport(bounds,key){
    const active=this.damageQueue.find(j=>j.kind==='support'&&j.key===key);
    if(active){
      for(let i=0;i<3;i++){active.bounds.min[i]=Math.min(active.bounds.min[i],bounds.min[i]);active.bounds.max[i]=Math.max(active.bounds.max[i],bounds.max[i]);}
      active.bounds.revision++;return true;
    }
    if(this.damageQueue.length>=W.MAX_DAMAGE_QUEUE)return false;
    const area={min:[...bounds.min],max:[...bounds.max],revision:0};
    this.damageQueue.push({kind:'support',key,bounds:area,cx:(area.min[0]+area.max[0])/2,cy:area.min[1],cz:(area.min[2]+area.max[2])/2,task:this.supportTask(area)});return true;
  }

  *_damageSphereTask({cx,cy,cz,radius,digsTerrain}){
    const s=VOXEL.SIZE,r2=radius*radius;let removed=[],visited=0;
    const remove=(x,y,z,mat)=>{
      const first=removed.length;
      if(mat===G.MATERIAL_ID)this.shatterPane(x,y,z,removed);
      else{this.setEdit(x,y,z,0);removed.push({x:(x+.5)*s,y:(y+.5)*s,z:(z+.5)*s,mat});}
      this.removedCount+=removed.length-first;
      if(digsTerrain)for(let i=first;i<removed.length;i++)this._materialiseAround(...this.worldToVoxel(removed[i].x,removed[i].y,removed[i].z));
    };
    if(!digsTerrain){
      // Occupied Y bits skip empty rooms and implicit ground. Giant contact
      // costs stored surfaces, rather than a cubic scan of a 70-metre ball.
      const CX=VOXEL.CHUNK_XZ,CY=VOXEL.CHUNK_Y;
      for(const chunk of [...this.chunks.values()]){
        const bx=chunk.cx*CX,by=chunk.cy*CY,bz=chunk.cz*CX;
        if((bx+CX)*s<cx-radius||bx*s>cx+radius||(bz+CX)*s<cz-radius||bz*s>cz+radius||(by+CY)*s<cy-radius||by*s>cy+radius)continue;
        for(const [column,bits]of chunk.damageColumns){
          if(++visited%W.DAMAGE_BATCH===0){yield removed;removed=[];}
          if(this.chunks.get(this._key(chunk.cx,chunk.cy,chunk.cz))!==chunk)break;
          let mask=bits;const x=column%CX,z=Math.floor(column/CX);
          const wx=(bx+x+.5)*s,wz=(bz+z+.5)*s,flat=(wx-cx)**2+(wz-cz)**2;if(flat>r2)continue;
          while(mask){
            if(++visited%W.DAMAGE_BATCH===0){yield removed;removed=[];}
            const bit=mask&-mask;mask=(mask&~bit)>>>0;const y=31-Math.clz32(bit),vy=by+y;
            if(flat+((vy+.5)*s-cy)**2>r2)continue;
            const mat=this.get(bx+x,vy,bz+z);if(!mat||mat===VOXEL.BEDROCK)continue;
            remove(bx+x,vy,bz+z,mat);
          }
        }
      }
    }else{
      const [bx,by,bz]=this.worldToVoxel(cx,cy,cz),r=Math.ceil(radius/s);
      for(let x=bx-r;x<=bx+r;x++)for(let z=bz-r;z<=bz+r;z++){
        const flat=((x+.5)*s-cx)**2+((z+.5)*s-cz)**2;if(flat>r2)continue;
        for(let y=by-r;y<=by+r;y++){
          if(++visited%W.DAMAGE_BATCH===0){yield removed;removed=[];}
          if(flat+((y+.5)*s-cy)**2>r2)continue;
          const mat=this.get(x,y,z);if(!mat||mat===VOXEL.BEDROCK)continue;remove(x,y,z,mat);
        }
      }
    }
    if(removed.length)yield removed;
  }

  shatterPane(x, y, z, removed) {
    // Connectivity stops at mullions. Recording every cell keeps a window
    // broken across chunk seams and subsequent streaming (milestone 27).
    const pending = [[x,y,z]], s = VOXEL.SIZE;
    let count = 0;
    while (pending.length && count < G.MAX_PANE_CELLS) {
      const [vx,vy,vz] = pending.pop();
      this._ensureAtWorld((vx+.5)*s,(vz+.5)*s);
      if (this.get(vx,vy,vz) !== G.MATERIAL_ID) continue;
      this.setEdit(vx,vy,vz,0);
      removed.push({x:(vx+.5)*s,y:(vy+.5)*s,z:(vz+.5)*s,mat:G.MATERIAL_ID});
      count++;
      for (const [dx,dy,dz] of NEIGHBOURS) pending.push([vx+dx,vy+dy,vz+dz]);
    }
  }

  // --- meshing ---

  /** Yield inside a chunk: limiting chunk count alone still allowed a single
   *  160-cell column to stall the frame for hundreds of milliseconds (M33).
   *  Old geometry stays visible until its replacement is complete. */
  remeshDirty({maxMilliseconds = Infinity, maxSlices = Infinity} = {}) {
    const started=performance.now();let rebuilt=0,slices=0;
    while(slices<maxSlices && performance.now()-started<maxMilliseconds){
      let work=this._meshWork;
      if(work && this.chunks.get(work.key)!==work.chunk){this._meshWork=null;work=null;}
      if(!work){
        let nearest=null,distance=Infinity;
        for(const chunk of this.chunks.values()){
          if(!chunk.dirty||this._columnWork.has(this._colKey(chunk.cx,chunk.cz)))continue;
          const d=this._centers?.length?Math.min(...this._centers.map(c=>(chunk.cx-c.cx)**2+(chunk.cz-c.cz)**2)):0;
          if(d<distance){nearest=chunk;distance=d;}
        }
        if(!nearest)break;
        const snapshot={...nearest,data:nearest.data.slice(),rowCounts:nearest.rowCounts.slice()};
        work=this._meshWork={chunk:nearest,key:this._key(nearest.cx,nearest.cy,nearest.cz),revision:nearest.revision,task:this._buildChunkTask(snapshot)};
      }
      const result=work.task.next();slices++;
      if(result.done){
        this._applyChunk(work.chunk,result.value);
        work.chunk.dirty=work.chunk.revision!==work.revision;
        this._meshWork=null;rebuilt++;
      }
    }
    this.lastMeshSlices=slices;this.lastMeshMs=performance.now()-started;
    return rebuilt;
  }

  *_buildChunkTask(chunk) {
    if(!chunk.solidCount)return null;
    const CX = VOXEL.CHUNK_XZ;
    const CY = VOXEL.CHUNK_Y;
    const s = VOXEL.SIZE;
    const glassPos=[],glassNorm=[],glassCol=[];
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
        yield;
        for (let lx = -1; lx <= CX; lx++) {
          tops[(lz + 1) * P + (lx + 1)] = this.terrain.topSolidVoxelY(
            (base[0] + lx + 0.5) * s, (base[2] + lz + 0.5) * s,
          );
        }
      }
    } else {
      tops.fill(-2147483648);
    }

    // Undamaged ground follows its authored surface. M28 samples each side of a street boundary independently
    // so a kerb has a vertical face instead of blending into the road.
    const Q = CX + 3;
    const cornerH = new Float32Array(Q * Q);
    const cornerXZ = new Float64Array(Q * Q * 2);
    const fitted = new Uint8Array(Q * Q);
    const cornerIndex=(lx,lz)=>(lz+1)*Q+lx+1;
    const cornerX=(lx,lz)=>cornerXZ[cornerIndex(lx,lz)*2];
    const cornerZ=(lx,lz)=>cornerXZ[cornerIndex(lx,lz)*2+1];
    const intact = new Uint8Array(P * P);
    if (this.terrain) {
      for (let lz = -1; lz <= CX + 1; lz++) {
        yield;
        for (let lx = -1; lx <= CX + 1; lx++) {
          // LATTICE corners, not voxel centres — that is what makes the value
          // shared between the voxels either side of it.
          const x=(base[0]+lx)*s,z=(base[2]+lz)*s,k=cornerIndex(lx,lz);
          const point=this.terrain.cornerPosition?.(x,z);
          cornerXZ[k*2]=point?.[0]??x;cornerXZ[k*2+1]=point?.[1]??z;fitted[k]=point?1:0;
          cornerH[k] = this.terrain.surfaceHeight(cornerXZ[k*2],cornerXZ[k*2+1]);
        }
      }
      for (let lz = -1; lz <= CX; lz++) {
        yield;
        for (let lx = -1; lx <= CX; lx++) {
          const top = tops[(lz + 1) * P + (lx + 1)];
          const here = this.storedAt(base[0] + lx, top, base[2] + lz);
          const above = this.storedAt(base[0] + lx, top + 1, base[2] + lz);
          // Intact = the terrain's own top voxel is still there, with open air
          // over it. A dug column fails the first test; one with a building or a
          // foundation on it fails the second, and a wall must not be smeared
          // into the hillside it stands on.
          intact[(lz + 1) * P + (lx + 1)] =
            TERRAIN.SMOOTH_CONTACT_MATERIALS.includes(here) && (!above || above === VOXEL.EMPTY) ? 1 : 0;
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
    const sided = this.terrain?.cornerHeight;
    const surfaceCorners = new Float32Array(P * P * 4);
    if (sided) for (let lz=-1;lz<=CX;lz++) {yield;for (let lx=-1;lx<=CX;lx++) {
      if (!intact[(lz+1)*P+lx+1]) continue;
      for (let oz=0;oz<=1;oz++) for (let ox=0;ox<=1;ox++) {
        surfaceCorners[((lz+1)*P+lx+1)*4+oz*2+ox]=sided(
          cornerX(lx+ox,lz+oz),cornerZ(lx+ox,lz+oz),(base[0]+lx+.5)*s,(base[2]+lz+.5)*s);
      }
    }
    }
    const surfaceCorner=(lx,lz,ox,oz)=>sided
      ?surfaceCorners[((lz+1)*P+lx+1)*4+oz*2+ox]:corner(lx+ox,lz+oz);
    const sandWeights=[],terrainWeights=[];
    const emitQuad=(quad,color,normal=null,sand=false,terrain=false)=>{

      for (const ids of [[0,1,2],[0,2,3]]) {
        let n=normal;
        if (!n) {
          const [a,b,c]=ids.map(i=>quad[i]),u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
          n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
          const length=Math.hypot(...n)||1;n=n.map(v=>v/length);
        }
        for (const i of ids) {if(sand)sandWeights[pos.length/3]=1;if(terrain)terrainWeights[pos.length/3]=1;pos.push(...quad[i]);norm.push(...n);col.push(color.r,color.g,color.b);}
      }
    };
    const nrm = [0, 1, 0];
    /** Occupancy for a voxel given in LOCAL coordinates, where lx/lz may be -1
     *  or CX and ly may be -1 or CY (the one-voxel skirt the faces need). */
    const occupied = (lx, ly, lz, current) => {
      const inside = lx >= 0 && lx < CX && ly >= 0 && ly < CY && lz >= 0 && lz < CX;
      const stored = inside
        ? chunk.data[lx + CX * (ly + CY * lz)]
        : this.storedAt(base[0] + lx, base[1] + ly, base[2] + lz);
      if (stored === G.MATERIAL_ID && current !== G.MATERIAL_ID) return false;
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

    const coarse=new Uint8Array(CX*CX),stride=VOXEL_BATCH.GROUND_STEP;
    if(this.terrain)for(let z=0;z<CX;z+=stride){yield;for(let x=0;x<CX;x+=stride){
      const top=tops[(z+1)*P+x+1],ly=top-base[1];
      if(ly<0||ly>=CY)continue;
      const mat=chunk.data[x+CX*(ly+CY*z)];
      if(!mat||[BEACH.DRY_MATERIAL,BEACH.WET_MATERIAL,PAVING.SLAB_MATERIAL,PAVING.SLAB_VARIANT,PAVING.KERB_MATERIAL].includes(mat))continue;
      const sample=(dx,dz)=>surfaceCorner(x+Math.min(stride-1,dx),z+Math.min(stride-1,dz),dx===stride?1:0,dz===stride?1:0);
      const h00=sample(0,0),h10=sample(stride,0),h01=sample(0,stride),h11=sample(stride,stride);
      let safe=true;
      for(let dz=0;dz<stride&&safe;dz++)for(let dx=0;dx<stride;dx++){
        const cy=tops[(z+dz+1)*P+x+dx+1]-base[1];
        if(cy<0||cy>=CY||!intact[(z+dz+1)*P+x+dx+1]||chunk.data[x+dx+CX*(cy+CY*(z+dz))]!==mat
          ||this.dugSurface.patch(base[0]+x+dx,base[1]+cy,base[2]+z+dz)){safe=false;break;}
      }
      for(let dz=0;dz<=stride&&safe;dz++)for(let dx=0;dx<=stride;dx++){
        // A coarse square cannot cover a kerb fitted to a diagonal street.
        if(fitted[cornerIndex(x+dx,z+dz)]){safe=false;break;}
        // Match the two rendered triangles, including their diagonal. Fine
        // cells remain where curvature, kerbs or damage exceed this error.
        const u=dx/stride,v=dz/stride,h=v>=u?h00+(h01-h00)*v+(h11-h01)*u:h00+(h10-h00)*u+(h11-h10)*v;
        if(Math.abs(sample(dx,dz)-h)>VOXEL_BATCH.GROUND_ERROR){safe=false;break;}
      }
      if(!safe)continue;
      const color=this._colors.get(mat)||this._colors.get(1),corners=[[x,z,h00],[x,z+stride,h01],[x+stride,z+stride,h11],[x+stride,z,h10]];
      if(mat===PAVING.ROAD_MATERIAL)emitQuad(corners.map(([xx,zz,h])=>[(base[0]+xx)*s,h,(base[2]+zz)*s]),color,null,false,true);
      else for(const i of [0,1,2,0,2,3]){const [xx,zz,h]=corners[i];terrainWeights[pos.length/3]=1;pos.push((base[0]+xx)*s,h,(base[2]+zz)*s);slopeNormal(xx,zz,nrm);norm.push(...nrm);col.push(color.r,color.g,color.b);}
      for(let dz=0;dz<stride;dz++)coarse.fill(1,(z+dz)*CX+x,(z+dz)*CX+x+stride);
    }}

    const planes = new Map();
    const mergeFace = (fi, lx, ly, lz, mat, flatHeight = null, terrain = false) => {
      const axis = Math.floor(fi / 2), local = [lx, ly, lz];
      const u = axis === 0 ? 2 : 0, v = axis === 1 ? 2 : 1;
      const width = u === 1 ? CY : CX, height = v === 1 ? CY : CX;
      const key = `${fi}:${local[axis]}:${flatHeight ?? ''}:${terrain}`;
      let plane = planes.get(key);
      if (!plane) {
        plane = { fi, axis, u, v, width, height, slice: local[axis], flatHeight, terrain, mask: new Uint8Array(width * height) };
        planes.set(key, plane);
      }
      plane.mask[local[u] + local[v] * width] = mat;
    };
    for (let lz = 0; lz < CX; lz++) {
      for (let ly = 0; ly < CY; ly++) {
        // Empty rooms and demolished space used thousands of scheduled slices
        // while the stale building stayed visible (JIM-48).
        if(!chunk.rowCounts[ly+CY*lz])continue;
        yield;
        for (let lx = 0; lx < CX; lx++) {
          const mat = chunk.data[lx + CX * (ly + CY * lz)];
          // EMPTY is a hole the player made, not a material to draw.
          if (!mat || mat === VOXEL.EMPTY) continue;
          const vx = base[0] + lx;
          const vy = base[1] + ly;
          const vz = base[2] + lz;
          const color = this._colors.get(mat) || this._colors.get(1);
          const smooth = isTerrainTop(lx, ly, lz);
          const terrainCell=!!this.terrain&&vy<=tops[(lz+1)*P+lx+1];
          const sand=smooth&&(mat===BEACH.DRY_MATERIAL||mat===BEACH.WET_MATERIAL);
          for (let fi = 0; fi < FACES.length; fi++) {
            if(fi===2&&coarse[lz*CX+lx]&&isTerrainTop(lx,ly,lz))continue;
            const f = FACES[fi];
            const nx=lx+f.d[0],nz=lz+f.d[2];
            if (sided && f.d[1]===0 && intact[(lz+1)*P+lx+1] && intact[(nz+1)*P+nx+1]
                && vy<=tops[(lz+1)*P+lx+1]
                && (vy>=tops[(nz+1)*P+nx+1]||occupied(nx,ly,nz,mat))) {
              // A retaining face can be taller than the stored terrain skin.
              // Emit it once from the top column. Air pockets below grade
              // still use voxel faces, so this cannot erase a tunnel wall.
              if (smooth) {
                let exposed=false;
                const wall=f.v.map(([ox,oy,oz])=>{
                  const top=surfaceCorner(lx,lz,ox,oz),adjacent=surfaceCorner(nx,nz,ox-f.d[0],oz-f.d[2]);
                  if(top>adjacent+1e-6)exposed=true;
                  return [cornerX(lx+ox,lz+oz),oy?top:Math.min(top,adjacent),cornerZ(lx+ox,lz+oz)];
                });
                if(exposed)emitQuad(wall,color,f.d,sand,true);
              }
              continue;
            }
            if (occupied(nx, ly + f.d[1], nz, mat)) {
              // JIM-65: a smoothed neighbour can end below its voxel ceiling.
              // Keep the exposed strip on a rigid wall instead of culling it
              // against ground that no longer reaches that height visually.
              if(!smooth&&f.d[1]===0&&intact[(nz+1)*P+nx+1]&&vy===tops[(nz+1)*P+nx+1]){
                let exposed=false;
                const wall=f.v.map(([ox,oy,oz])=>{
                  const top=(vy+1)*s,bottom=Math.max(vy*s,surfaceCorner(nx,nz,ox-f.d[0],oz-f.d[2]));
                  if(top>bottom+1e-6)exposed=true;
                  return[(vx+ox)*s,oy?top:Math.min(top,bottom),(vz+oz)*s];
                });
                if(exposed)emitQuad(wall,color,f.d,false,terrainCell);
              }
              continue;
            }
            // Undisturbed ground: every vertex on the voxel's TOP plane moves to
            // the real surface. That covers the top face and the upper edge of
            // any side wall in one rule, so the two always meet.
            const quad = f.v.map(([ox, oy, oz]) => [
              smooth ? cornerX(lx+ox,lz+oz) : (vx + ox) * s,
              smooth && oy === 1 ? surfaceCorner(lx,lz,ox,oz) : (vy + oy) * s,
              smooth ? cornerZ(lx+ox,lz+oz) : (vz + oz) * s,
            ]);
            if(terrainCell&&this.dugSurface.nearby(vx,vz)&&this.dugSurface.natural(mat)&&fi!==3){
              let deformed=false;
              const patch=fi===2?this.dugSurface.patch(vx,vy,vz):null;
              for(let i=0;i<f.v.length;i++){
                const [ox,oy,oz]=f.v[i];
                const height=patch?patch[oz*2+ox]:fi===2?null:this.dugSurface.corner(vx+ox,vy+oy-1,vz+oz);
                if(height!==null){deformed ||= Math.abs(quad[i][1]-height)>1e-6;quad[i][1]=height;}
              }
              if(deformed){
                if(fi===2&&quad.every(q=>Math.abs(q[1]-quad[0][1])<1e-6))mergeFace(fi,lx,ly,lz,mat,quad[0][1],true);
                else emitQuad(quad,color,null,false,true);
                continue;
              }
            }
            const paving=mat===PAVING.SLAB_MATERIAL||mat===PAVING.SLAB_VARIANT||mat===PAVING.KERB_MATERIAL;
            if (smooth && fi===2 && paving && sided) {
              const mod=n=>((n%PAVING.SLAB_CELLS)+PAVING.SLAB_CELLS)%PAVING.SLAB_CELLS;
              const inset=(n,offset)=>offset===0?(mod(n)===0?PAVING.JOINT_HALF:0)
                :(mod(n)===PAVING.SLAB_CELLS-1?-PAVING.JOINT_HALF:0);
              const inner=f.v.map(([ox,,oz])=>{
                const u=ox+inset(vx,ox)/s,v=oz+inset(vz,oz)/s;
                const sample=fn=>(fn(lx,lz)*(1-u)+fn(lx+1,lz)*u)*(1-v)+(fn(lx,lz+1)*(1-u)+fn(lx+1,lz+1)*u)*v;
                const x=sample(cornerX),z=sample(cornerZ);
                return [x,sided(x,z,(vx+.5)*s,(vz+.5)*s),z];
              });
              emitQuad(inner,color,null,false,true);
              for(let i=0;i<4;i++) {
                const j=(i+1)%4;
                if(inner[i][0]!==quad[i][0]||inner[i][2]!==quad[i][2]||inner[j][0]!==quad[j][0]||inner[j][2]!==quad[j][2])
                  emitQuad([quad[i],quad[j],inner[j],inner[i]],color,null,false,true);
              }
              continue;
            }
            // Terrain slopes keep their sampled corners; only genuinely planar
            // faces merge, so reducing cells cannot flatten a hill (JIM-34).
            const flat = smooth && fi === 2 && quad.every(q => Math.abs(q[1] - quad[0][1]) < 1e-6);
            const fittedFace=smooth&&f.v.some(([ox,,oz])=>fitted[cornerIndex(lx+ox,lz+oz)]);
            if (!smooth || (flat&&!sand&&!fittedFace)) {
              mergeFace(fi, lx, ly, lz, mat, flat ? quad[0][1] : null,terrainCell);
              continue;
            }
            if (sided && smooth && fi===2 && mat===PAVING.ROAD_MATERIAL) {emitQuad(quad,color,null,false,true);continue;}
            const lit = smooth && f.d[1] === 1;
            for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
              for (const idx of [a, b, c]) {
                if(sand&&f.v[idx][1]===1)sandWeights[pos.length/3]=1;
                if(terrainCell)terrainWeights[pos.length/3]=1;
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

    for (const plane of planes.values()) {
      yield;
      const {mask,width,height,u,v,axis,slice,fi,flatHeight,terrain} = plane;
      const f = FACES[fi];
      for (let row=0; row<height; row++) for (let colIdx=0; colIdx<width;) {
        const material = mask[row*width+colIdx];
        if (!material) {colIdx++; continue;}
        let run=1, rows=1;
        while(colIdx+run<width && (!terrain||run<VOXEL_BATCH.GROUND_STEP) && mask[row*width+colIdx+run]===material) run++;
        outer: while(row+rows<height&&(!terrain||rows<VOXEL_BATCH.GROUND_STEP)) {
          for(let k=0;k<run;k++) if(mask[(row+rows)*width+colIdx+k]!==material) break outer;
          rows++;
        }
        const origin=[0,0,0]; origin[axis]=slice; origin[u]=colIdx; origin[v]=row;
        const size=[1,1,1];size[u]=run;size[v]=rows;
        const color=this._colors.get(material)||this._colors.get(1);
        const quad=f.v.map(c=>c.map((n,i)=>(base[i]+origin[i]+n*size[i])*s));
        if(flatHeight!==null) for(const q of quad) q[1]=flatHeight;
        const pp=material===G.MATERIAL_ID?glassPos:pos,nn=material===G.MATERIAL_ID?glassNorm:norm,cc=material===G.MATERIAL_ID?glassCol:col;
        for(const i of [0,1,2,0,2,3]) {if(terrain)terrainWeights[pp.length/3]=1;pp.push(...quad[i]);nn.push(...f.d);cc.push(color.r,color.g,color.b);}
        for(let j=0;j<rows;j++) mask.fill(0,(row+j)*width+colIdx,(row+j)*width+colIdx+run);
        colIdx+=run;
      }
    }

    const opaqueCount=pos.length/3;
    for(const v of glassPos)pos.push(v);for(const v of glassNorm)norm.push(v);for(const v of glassCol)col.push(v);
    if (!pos.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.addGroup(0,opaqueCount,0);
    if(glassPos.length)geo.addGroup(opaqueCount,glassPos.length/3,1);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('sandWeight',new THREE.Float32BufferAttribute(Array.from({length:pos.length/3},(_,i)=>sandWeights[i]||0),1));
    geo.setAttribute('terrainWeight',new THREE.Float32BufferAttribute(Array.from({length:pos.length/3},(_,i)=>terrainWeights[i]||0),1));
    geo.computeBoundingSphere();
    return geo;
  }

  _applyChunk(chunk,geo){
    chunk.meshed=true;
    if(chunk.mesh){this.scene.remove(chunk.mesh);chunk.mesh.geometry.dispose();chunk.mesh=null;}
    if(!geo){this.renderBatches.remove(chunk);return;}
    chunk.mesh = new THREE.Mesh(geo, [this.material,this.glassMaterial]);
    chunk.mesh.castShadow=true;chunk.mesh.receiveShadow=true;
    this.renderBatches.set(chunk,geo);
  }

  clear() {
    this.dugSurface.clear();
    this.renderBatches.clear();
    this._meshWork=null;this._columnWork.clear();this.damageQueue=[];this.damageTurn=0;this.supportTurn=0;
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
      batches:this.renderBatches.stats(),
      pendingDamage:this.damageQueue.length,
      pendingChannelSegments:this.damageQueue.find(j=>j.kind==='channel')?.segments.length||0,
      groundChannels:this.channels?{cells:this.channels.cells,pending:this.channels.pending.length,work:this.channels.work}:null,
      damageMs:this.lastDamageMs||0,
      pendingColumns:this._columnWork.size,
      generationMs:this.lastGenerationMs||0,
      pendingMeshes:[...this.chunks.values()].filter(c=>c.dirty).length,
      meshSlices:this.lastMeshSlices,
      meshMs:this.lastMeshMs,
    };
  }
}
