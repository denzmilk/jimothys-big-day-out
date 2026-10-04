import * as Terrain from './Terrain.js';
import { TERRAIN, SEWER, BUILDINGS, PAVING, LANDMARKS as LM, VOXEL, TOOLS } from '../core/Constants.js';
import { inPolygon, polygonBounds } from '../core/MathUtils.js';

import landmarkManifest from './landmarkManifest.json' with {type:'json'};
const plan = Terrain.plan;
const landmarkSites=[];let landmarkOf=null;

// The city's design, as data (milestone 16), on the island (milestone 17).
//
// Milestone 15 added archetypes and districts and the world still read as a
// grid, because the grid was never in the data — it was in the generator.
// `roadAtVoxel` was `vx mod BLOCK < ROAD`, so every road was straight, every
// block identical and every junction a crossroads, forever. No amount of
// per-cell variety survives that.
//
// So the pipeline is inverted. `cityPlan.js` carries the intent; this file
// expands it into a road network, bakes the whole city into one class grid
// ONCE at boot, and answers lookups from the array. Everything downstream —
// streaming, prop placement, the minimap — reads the bake.
//
// Baking is what preserves the milestone-12 guarantees: a fixed array is
// order-independent and deterministic by construction rather than by
// discipline, and every query stays O(1) however irregular the city gets.
//
// NOTE the file names. `Masterplan.js` alongside `masterplan.js` is the same
// file on macOS, and writing one silently destroyed the other mid-session.
// Engine is `CityPlanner.js`, data is `islandPlan.js` — no case-only collision.
//
// MILESTONE 17 changed only the SOURCE of the plan. `cityPlan.js` described
// six regions on a flat square; `islandPlan.js` describes twelve named
// districts on a coastline. The bake, the flood-fill block finder and the
// semantic prop placement below are milestone 16's and are untouched — which
// was the point of separating the data from the engine in the first place.
//
// What the island adds is a NEGATIVE: the coast, the lakes and the canal are
// carved out of the class grid as WATER before blocks are found, so the street
// network is cut by an edge that was not generated alongside it. That edge is
// the texture six rotated lattices never produced (Chris, on Rev A: "It
// definitely still reads as a grid").

// World units per grid cell. 2 is finer than the narrowest road (an alley at
// 4), and 1000×1000 cells at one byte is 1 MB. Must equal the terrain's cell
// size — the two grids are indexed interchangeably during the bake.
export const CELL = TERRAIN.CELL;

export const CLASS = {
  LAND: 0,
  ROAD: 1,
  ALLEY: 2,
  PARK: 3,
  PLAZA: 4,
  WATER: 5,
  FOOTPATH: 6,
};

const SIZE = Math.ceil((plan.bounds * 2) / CELL);
const HALF = SIZE / 2;

let cells = null;
let regionDistance = null;
let regionOf = null;   // which region owns a cell, so district lookups are free
let trunk = null;      // the sewer centreline: the middle of every arterial
let blockIdOf = null;
let blocks = null;
let buildings = null;
let buildingGrid = null;

const BUILDING_BUCKET = 64; // world units per spatial-index bucket

const toCell = (w) => Math.floor(w / CELL) + HALF;
const toWorld = (c) => (c - HALF) * CELL + CELL / 2;
const idx = (cx, cz) => cz * SIZE + cx;
const inGrid = (cx, cz) => cx >= 0 && cz >= 0 && cx < SIZE && cz < SIZE;

/** Cell-space bounding box of a polygon, so the bake can skip the grid a
 *  region does not touch. Without it the bake tested every cell against every
 *  region — 6 million point-in-polygon calls, 1.3 s. */
function cellBounds(poly) {
  const [minX, minZ, maxX, maxZ] = polygonBounds(poly);
  return {
    x0: Math.max(0, toCell(minX)),
    x1: Math.min(SIZE - 1, toCell(maxX) + 1),
    z0: Math.max(0, toCell(minZ)),
    z1: Math.min(SIZE - 1, toCell(maxZ) + 1),
  };
}

// Road widths. Held here rather than in the plan: the island describes WHERE
// districts are, this describes what a street is.
const ROAD_CLASSES = {
  arterial: { width: 15 },
  street: { width: 9 },
  alley: { width: 4 },
};

/** What a district's CHARACTER means for its street network and its buildings.
 *
 *  The island plan says "retail" or "suburb" — a description of a place, not a
 *  block size. This is the one table that turns the first into the second, so
 *  re-characterising a district is a one-word edit in the plan rather than a
 *  set of numbers copied into it. */
const CHARACTER = {
  core: { district: 'downtown', block: [58, 92], alleys: true, arterialEvery: 4 },
  industrial: { district: 'industrial', block: [92, 132], alleys: true, arterialEvery: 3 },
  'dense-residential': { district: 'dense', block: [64, 88], alleys: true, arterialEvery: 4 },
  residential: { district: 'residential', block: [78, 104], alleys: false, arterialEvery: 4 },
  suburb: { district: 'residential', block: [98, 130], alleys: false, arterialEvery: 5 },
  mixed: { district: 'commercial', block: [70, 96], alleys: true, arterialEvery: 4 },
  retail: { district: 'retail', block: [120, 152], alleys: false, arterialEvery: 4 },
};

// Districts, expanded into the region shape the bake below already understood.
const regions = plan.districts.map((d, i) => {
  const c = CHARACTER[d.character] || CHARACTER.residential;
  return {
    id: d.id, polygon: d.polygon, angle: d.angle, realName: d.realName, ...c, _index: i,
  };
});

/** Stamp a region's street grid, drawn in its own ROTATED frame.
 *
 *  A region's whole network shares one angle, and regions carry different
 *  angles — several straight grids meeting is what reads as a city, and unlike
 *  curves it costs a voxel world nothing. A diagonal street would staircase
 *  every wall along it; a rotated *grid* just meets its neighbour at an angle
 *  and leaves triangular offcuts, which is exactly the irregularity wanted. */
function stampRegion(region) {
  const rad = (region.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const [bw, bd] = region.block;

  // Region extent in rotated space, so the grid covers it whatever the angle.
  let uMin = Infinity; let vMin = Infinity;
  for (const [x, z] of region.polygon) {
    uMin = Math.min(uMin, x * cos + z * sin);
    vMin = Math.min(vMin, -x * sin + z * cos);
  }

  const arterial = ROAD_CLASSES.arterial.width;
  const street = ROAD_CLASSES.street.width;
  const alley = ROAD_CLASSES.alley.width;

  // Phase from the region's own identity, not the world origin: otherwise
  // every region's streets line up through the seams and the collision that
  // makes this work is thrown away.
  const phase = (region.id.length * 37) % 50;
  region.streetFrame={cos,sin,originU:uMin-phase,originV:vMin-phase,widths:ROAD_CLASSES};

  const bb = cellBounds(region.polygon);
  for (let cz = bb.z0; cz <= bb.z1; cz++) {
    for (let cx = bb.x0; cx <= bb.x1; cx++) {
      const x = toWorld(cx);
      const z = toWorld(cz);
      if (!inPolygon(x, z, region.polygon)) continue;
      const uu = x * cos + z * sin - uMin + phase;
      const vv = -x * sin + z * cos - vMin + phase;
      const uCell = Math.floor(uu / bw);
      const vCell = Math.floor(vv / bd);
      const uOff = uu - uCell * bw;
      const vOff = vv - vCell * bd;

      const uw = uCell % region.arterialEvery === 0 ? arterial : street;
      const vw = vCell % region.arterialEvery === 0 ? arterial : street;

      const i = idx(cx, cz);
      if (uOff < uw || vOff < vw) {
        cells[i] = CLASS.ROAD;
        // The sewer runs down the middle of the arterials (milestone 18).
        //
        // DERIVED from the street network rather than authored as polylines in
        // the plan, which is what the milestone imagined. The roads themselves
        // are expanded from district polygons and grid angles, so hand-drawn
        // sewer lines would be drawn against a network nobody has seen yet and
        // would rot the first time a district's angle changed. Deriving them
        // guarantees what the AC actually asks for — a tunnel under the street
        // network, with entrances that land on streets — by construction.
        const onU = uw === arterial && uOff < uw;
        const onV = vw === arterial && vOff < vw;
        if ((onU && Math.abs(uOff - uw / 2) <= CELL)
          || (onV && Math.abs(vOff - vw / 2) <= CELL)) trunk[i] = 1;
      } else if (region.alleys && Math.abs(vOff - (vw + (bd - vw) / 2)) < alley / 2) {
        // One alley down the spine of each block, behind the frontages. The
        // single biggest change to how the city reads — and where the bins go,
        // which is where a raccoon actually belongs.
        cells[i] = CLASS.ALLEY;
      } else {
        cells[i] = CLASS.LAND;
      }
      regionOf[i] = region._index;
    }
  }
}

function stampPolygons(list, cls) {
  for (const item of list) {
    if (!item.polygon) continue;
    const bb = cellBounds(item.polygon);
    for (let cz = bb.z0; cz <= bb.z1; cz++) {
      for (let cx = bb.x0; cx <= bb.x1; cx++) {
        const x = toWorld(cx);
        const z = toWorld(cz);
        if (!inPolygon(x, z, item.polygon)) continue;
        cells[idx(cx, cz)] = cls;
      }
    }
  }
}

/** Blocks are the NEGATIVE SPACE between roads, found by flood fill — never
 *  authored. That is what makes them vary in size and shape: where two grids
 *  at different angles meet, the offcuts are triangles and slivers, which a
 *  lattice can never produce. */
function findBlocks() {
  blockIdOf = new Int32Array(SIZE * SIZE).fill(-1);
  blocks = [];
  const stack = [];
  for (let start = 0; start < cells.length; start++) {
    if (cells[start] !== CLASS.LAND || blockIdOf[start] !== -1) continue;
    const id = blocks.length;
    const cellsIn = [];
    stack.push(start);
    blockIdOf[start] = id;
    while (stack.length) {
      const at = stack.pop();
      cellsIn.push(at);
      const cx = at % SIZE;
      const cz = (at - cx) / SIZE;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (!inGrid(nx, nz)) continue;
        const n = idx(nx, nz);
        if (cells[n] !== CLASS.LAND || blockIdOf[n] !== -1) continue;
        blockIdOf[n] = id;
        stack.push(n);
      }
    }
    let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (const c of cellsIn) {
      const cx = c % SIZE;
      const wx = toWorld(cx);
      const wz = toWorld((c - cx) / SIZE);
      minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
    }
    blocks.push({
      id,
      area: cellsIn.length * CELL * CELL,
      minX,
      maxX,
      minZ,
      maxZ,
      region: regionOf[start],
    });
  }
}

// Archetype by district. Placement is SEMANTIC now: a tower belongs on a
// downtown lot, a warehouse in the port, a shop on a commercial frontage.
// Previously a hash picked from a list, which is what made the city feel
// arbitrary (Chris: "it's going to feel nonsensical like this").
const MIX = {
  downtown: ['tower', 'tower', 'apartment', 'shop'],
  commercial: ['shop', 'shop', 'apartment', 'warehouse'],
  residential: ['craftsman', 'craftsman', 'craftsman', 'shed', 'apartment'],
  industrial: ['warehouse', 'warehouse', 'shed'],
  // Milestone 17's two new characters. Compost Hill is dense housing over a
  // high street; Northgorge is strip malls and big-box, which is warehouses
  // wearing a shopfront.
  dense: ['apartment', 'apartment', 'craftsman', 'shop'],
  retail: ['shop', 'warehouse', 'shop', 'shed'],
  park: [],
};

function hash2(a, b) {
  let h = (0x9e3779b9 ^ Math.imul(a, 374761393) ^ Math.imul(b, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Fit buildings into a block by subdividing its bounding box into lots and
 *  keeping only those that fall entirely on buildable ground.
 *
 *  That test is what makes irregular blocks work: a triangular offcut where two
 *  grids collide simply keeps fewer lots, with no special case, and a lot can
 *  never end up in a road because road cells are not buildable. Buildings stay
 *  axis-aligned — on a rotated block they step along the street like a stack of
 *  boxes, which is the honest voxel answer; rotating them would staircase every
 *  wall instead. */
function buildingsForBlock(block) {
  const district = regions[block.region]?.district || 'residential';
  const mix = MIX[district];
  if (!mix || !mix.length) return [];
  if (block.maxX - block.minX < 10 || block.maxZ - block.minZ < 10) return [];

  const target = district === 'downtown' ? 24 : district === 'industrial' ? 38 : 26;
  const STEP = 4; // world units between candidate origins
  const out = [];
  const taken = new Set();

  // Greedy packing, NOT a subdivision of the bounding box.
  //
  // Subdividing the bbox works only for axis-aligned blocks. A downtown block
  // rotated 32 degrees has a bounding box far larger than itself, so most lots
  // landed outside the real block and were rejected: 163 of 549 blocks
  // produced anything at all, and the rotated districts produced almost
  // nothing — 13 towers and 1 warehouse against 448 craftsmen. Packing
  // candidates against the block's ACTUAL cells is shape-agnostic, so a
  // rotated block, a triangular offcut where two grids collide, and a plain
  // rectangle all fill the same way.
  for (let z = block.minZ; z <= block.maxZ; z += STEP) {
    for (let x = block.minX; x <= block.maxX; x += STEP) {
      const h = hash2(Math.round(x * 4), Math.round(z * 4));
      const r = (n) => ((h >>> (n * 5)) & 31) / 31;
      if (r(0) < 0.25) continue; // gaps: yards, car parks, vacant plots

      const type = mix[Math.floor(r(3) * mix.length) % mix.length];
      const size = BUILDINGS.LOT_WIDTH[type] || target;
      const [lo, hi] = BUILDINGS.LOT_JITTER;
      const bw = size * (lo + r(1) * (hi - lo));
      const bd = size * (lo + r(2) * (hi - lo));
      if (!fits(x, z, bw, bd, block.id, taken)) continue;
      const heights = [[x,z],[x+bw,z],[x,z+bd],[x+bw,z+bd]].map(([px,pz])=>Terrain.surfaceHeight(px,pz));
      // A steep hillside is landscape, not permission for a ten-metre blank
      // concrete plinth beneath a bungalow (world review, milestone 25).
      if (Math.max(...heights)-Math.min(...heights) > BUILDINGS.MAX_LOT_SLOPE[type]) continue;
      claim(x, z, bw, bd, taken);

      out.push({
        type,
        style: (h >>> 7) % BUILDINGS.STYLE_COUNT,
        palette: (h >>> 13) % BUILDINGS.PALETTE.length,
        front: nearestStreetSide(x, z, bw, bd),
        district,
        blockId: block.id,
        x,
        z,
        w: bw,
        d: bd,
        heightRoll: r(4), // stored, so a chunk built twice is identical
      });
    }
  }
  return out;
}

// Entrances face the nearest street; otherwise every porch faces world north.
function nearestStreetSide(x, z, w, d) {
  const edges = [[x+w/2,z,0,-1], [x+w,z+d/2,1,0], [x+w/2,z+d,0,1], [x,z+d/2,-1,0]];
  let side = 0, best = Infinity;
  edges.forEach(([px,pz,dx,dz], i) => {
    for (let distance = CELL; distance <= 60; distance += CELL) {
      if (classAt(px+dx*distance,pz+dz*distance) === CLASS.ROAD) {
        if (distance < best) {best = distance; side = i;} break;
      }
    }
  });
  return side;
}

/** Can a footprint stand here? Every cell it covers must be buildable, must
 *  belong to THIS block, and must be unclaimed.
 *
 *  The block-id test is what makes overlap impossible rather than unlikely:
 *  where two grids collide the blocks interlock, so "buildable" alone would let
 *  one block's lot sit on land that is really its neighbour's, and both would
 *  build there. */
function fits(x, z, w, d, blockId, taken) {
  const x0 = toCell(x);
  const z0 = toCell(z);
  const x1 = toCell(x + w);
  const z1 = toCell(z + d);
  for (let cz = z0; cz <= z1; cz++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (!inGrid(cx, cz)) return false;
      const i = idx(cx, cz);
      if (cells[i] !== CLASS.LAND || blockIdOf[i] !== blockId || taken.has(i)) return false;
      for(const px of [Math.max(x,(cx-HALF)*CELL),Math.min(x+w,(cx-HALF+1)*CELL)])
        for(const pz of [Math.max(z,(cz-HALF)*CELL),Math.min(z+d,(cz-HALF+1)*CELL)])
          if(classAt(px,pz)!==CLASS.LAND)return false;
    }
  }
  return true;
}

/** Claim the footprint plus a one-cell skirt, so neighbours never share a wall
 *  and there is always a gap to walk down. */
function claim(x, z, w, d, taken) {
  for (let cz = toCell(z) - 1; cz <= toCell(z + d) + 1; cz++) {
    for (let cx = toCell(x) - 1; cx <= toCell(x + w) + 1; cx++) {
      if (inGrid(cx, cz)) taken.add(idx(cx, cz));
    }
  }
}

function indexBuildings() {
  buildings = [];
  for (const block of blocks) buildings.push(...buildingsForBlock(block));
  buildingGrid = new Map();
  for (const b of buildings) {
    for (let i = Math.floor(b.x / BUILDING_BUCKET);
      i <= Math.floor((b.x + b.w) / BUILDING_BUCKET); i++) {
      for (let j = Math.floor(b.z / BUILDING_BUCKET);
        j <= Math.floor((b.z + b.d) / BUILDING_BUCKET); j++) {
        const k = `${i},${j}`;
        if (!buildingGrid.has(k)) buildingGrid.set(k, []);
        buildingGrid.get(k).push(b);
      }
    }
  }
}

// Parcels are reserved before the housing packer (M45). Every approach also
// claims land, so later house generation cannot seal a landmark behind a wall.
function reserveLandmarks(){
 landmarkOf=new Uint8Array(cells.length);
 const raw=(x,z)=>{const cx=toCell(x),cz=toCell(z);return inGrid(cx,cz)?cells[idx(cx,cz)]:CLASS.WATER;};
 const reserve=(x0,z0,x1,z1,index=0)=>{for(let z=toCell(z0);z<=toCell(z1);z++)for(let x=toCell(x0);x<=toCell(x1);x++)if(inGrid(x,z)){const i=idx(x,z);if(cells[i]!==CLASS.ROAD&&cells[i]!==CLASS.FOOTPATH){cells[i]=CLASS.PLAZA;if(index)landmarkOf[i]=index;}}};
 for(let index=0;index<LM.SITES.length;index++){
  const d=LM.SITES[index],model=landmarkManifest.find(m=>m.id===d.id),bounds=model.bounds,width=bounds[1][0]-bounds[0][0]+LM.PARCEL_MARGIN*2,depth=bounds[1][2]-bounds[0][2]+LM.PARCEL_MARGIN*2;
  let best=null,bestCost=Infinity;
  for(let dz=-LM.SEARCH_RADIUS;dz<=LM.SEARCH_RADIUS;dz+=LM.SITE_STEP)for(let dx=-LM.SEARCH_RADIUS;dx<=LM.SEARCH_RADIUS;dx+=LM.SITE_STEP){
   const cost=dx*dx+dz*dz;if(cost>=bestCost)continue;const x=d.preferred[0]+dx,z=d.preferred[1]+dz;
   if(Math.hypot(x,z)<LM.MIN_SPAWN_DISTANCE||landmarkSites.some(s=>Math.hypot(s.x-x,s.z-z)<LM.MIN_SEPARATION))continue;
   const x0=x-width/2,x1=x+width/2,z0=z-depth/2,z1=z+depth/2;let valid=true,min=Infinity,max=-Infinity;
   for(let pz=z0;pz<=z1&&valid;pz+=CELL)for(let px=x0;px<=x1;px+=CELL){const c=raw(px,pz);if(c!==CLASS.LAND&&c!==CLASS.PARK){valid=false;break;}const y=Terrain.surfaceHeight(px,pz);min=Math.min(min,y);max=Math.max(max,y);if(max-min>LM.MAX_GRADE_SPAN){valid=false;break;}}
   if(!valid)continue;
   const approaches=[];
   for(const [sx,sz,vx,vz]of [[x,z0,0,-1],[x,z1,0,1],[x0,z,-1,0],[x1,z,1,0]])for(let step=CELL;step<LM.APPROACH_MAX;step+=CELL){const px=sx+vx*step,pz=sz+vz*step,c=raw(px,pz);if(c===CLASS.WATER||c===CLASS.PLAZA)break;if(c===CLASS.FOOTPATH||c===CLASS.ROAD){const precise=surfaceClass(px,pz);if(precise!==CLASS.FOOTPATH&&precise!==CLASS.ROAD)continue;approaches.push({x:sx-vx*LM.CACHE_GAP,z:sz-vz*LM.CACHE_GAP,end:{x:px,z:pz},distance:step});break;}}
   if(approaches.length<2)continue;approaches.sort((a,b)=>a.distance-b.distance);best={...d,model,x,z,width,depth,height:Math.round(Terrain.surfaceHeight(x,z)/VOXEL.SIZE)*VOXEL.SIZE,approaches:approaches.slice(0,2)};bestCost=cost;
  }
  if(!best)throw Error('No valid landmark parcel: '+d.id);
  const s=best;s.vx=Math.round((s.x-(bounds[0][0]+bounds[1][0])/2)/VOXEL.SIZE);s.vz=Math.round((s.z-(bounds[0][2]+bounds[1][2])/2)/VOXEL.SIZE);s.vy=Math.round(s.height/VOXEL.SIZE);s.tools=[TOOLS.CATALOG[index+8].id];s.food=LM.FOOD_IDS.slice(0,LM.FOOD_LIMIT);s.cache={x:s.x,z:s.z-depth/2+LM.CACHE_GAP};s.viewpoints=s.approaches.map(a=>({x:a.x,z:a.z}));s.parking=s.approaches.map(a=>a.end);
  reserve(s.x-width/2,s.z-depth/2,s.x+width/2,s.z+depth/2,index+1);
  for(const a of s.approaches)reserve(Math.min(a.x,a.end.x)-LM.PATH_HALF,Math.min(a.z,a.end.z)-LM.PATH_HALF,Math.max(a.x,a.end.x)+LM.PATH_HALF,Math.max(a.z,a.end.z)+LM.PATH_HALF);
  landmarkSites.push(s);
 }
}
export function landmarks(){bake();return landmarkSites;}
export function landmarkAt(x,z){bake();const cx=toCell(x),cz=toCell(z);return inGrid(cx,cz)?landmarkSites[landmarkOf[idx(cx,cz)]-1]||null:null;}

let baked = false;

/** Bake the plan into the class grid. Idempotent, and a fixed boot cost that
 *  does not scale with how much of the world the player visits. */
export function bake() {
  if (baked) return;
  // PARK, not LAND: anything no region claims is not city, and starting it as
  // buildable let every un-regioned acre flood-fill into one 1.24 km² "block".
  // Outskirts and green space between the districts and the coast.
  cells = new Uint8Array(SIZE * SIZE).fill(CLASS.PARK);
  regionOf = new Int8Array(SIZE * SIZE).fill(-1);
  trunk = new Uint8Array(SIZE * SIZE);
  for (const region of regions) stampRegion(region);
  // Parks and plazas are carved AFTER the streets, so they genuinely interrupt
  // the network instead of being a differently-coloured block. The island plan
  // carries none yet — cityPlan.js's are noted in the backlog for porting.
  stampPolygons(plan.parks || [], CLASS.PARK);
  for (const p of plan.plazas || []) {
    const poly = [];
    for (let a = 0; a < 12; a++) {
      const th = (a / 12) * Math.PI * 2;
      poly.push([p.center[0] + Math.cos(th) * p.radius, p.center[1] + Math.sin(th) * p.radius]);
    }
    stampPolygons([{ polygon: poly }], CLASS.PLAZA);
  }

  // The coastline, carved LAST and straight off the height field (milestone
  // 17). Everything the sea, the lakes and the canal cover stops being city,
  // whatever a district polygon claimed — a district drawn a little into the
  // water simply loses that part, with no reconciliation step to get wrong.
  //
  // Read cell-for-cell rather than through surfaceHeight(): both grids are the
  // same bake of the same plan, so this is an array read instead of a million
  // bilinear samples.
  const t = Terrain.grid();
  Terrain.assertSameGrid(SIZE, HALF, CELL);
  for (let i = 0; i < cells.length; i++) {
    if (t.deck[i]) {
      // A bridge is a road. It has to be, or the network stops at the water and
      // the flood fill finds a block in the middle of the canal.
      cells[i] = CLASS.ROAD;
      regionOf[i] = -1;
      trunk[i] = 0; // no sewer under a bridge deck: there is nothing under it
    } else if (t.height[i] < TERRAIN.BUILD_MIN_HEIGHT) {
      cells[i] = CLASS.WATER;
      regionOf[i] = -1;
      trunk[i] = 0;
    }
  }

  // Reserve the pedestrian strip before packing lots, so a pavement cannot
  // disappear into a house that was placed against the old road edge (JIM-51).
  const streets=cells.slice(),reach=Math.ceil(PAVING.WIDTH/CELL);
  for(let cz=reach;cz<SIZE-reach;cz++)for(let cx=reach;cx<SIZE-reach;cx++){
    const i=idx(cx,cz),c=streets[i];
    if(regionOf[i]<0||c===CLASS.ROAD||c===CLASS.ALLEY||c===CLASS.WATER)continue;
    let beside=false;
    for(let dz=-reach;dz<=reach&&!beside;dz++)for(let dx=-reach;dx<=reach;dx++)if(streets[idx(cx+dx,cz+dz)]===CLASS.ROAD){beside=true;break;}
    if(beside)cells[i]=CLASS.FOOTPATH;
  }
  reserveLandmarks();
  findBlocks();
  findSewers();
  baked = true;
  indexBuildings();
}

// --- queries (all O(1) against the bake) ------------------------------------

export function classAt(x, z) {
  bake();
  return surfaceClass(x,z);
}
function surfaceClass(x,z){
  const cx = toCell(x);
  const cz = toCell(z);
  if (!inGrid(cx, cz)) return CLASS.WATER;
  const i=idx(cx,cz),c=cells[i],r=regions[regionIndexAt(x,z,cx,cz)];
  // JIM-86: the planning grid reserves lots, but its two-metre pixels must
  // not become the visible kerb. Keep special parcels/bridges as authored.
  if(!r)return regionOf[i]>=0&&(c===CLASS.ROAD||c===CLASS.FOOTPATH)?CLASS.LAND:c;
  if(c===CLASS.WATER||c===CLASS.PLAZA||(c===CLASS.PARK&&regionOf[i]>=0))return c;
  const f=r.streetFrame,u=x*f.cos+z*f.sin-f.originU,v=-x*f.sin+z*f.cos-f.originV;
  const distance=Math.min(streetOffset(r,u,r.block[0]),streetOffset(r,v,r.block[1]));
  if(distance<0)return CLASS.ROAD;
  if(distance<PAVING.WIDTH)return CLASS.FOOTPATH;
  if(c===CLASS.ROAD||c===CLASS.FOOTPATH)return CLASS.LAND;
  return c;
}

function streetOffset(r,value,size){
  const index=Math.floor(value/size),off=value-index*size,w=index%r.arterialEvery===0?ROAD_CLASSES.arterial.width:ROAD_CLASSES.street.width;
  return Math.min(off<w/2?-off:off-w,size-off);
}

/** Signed distance and outward normal of the nearest authored street edge. */
export function streetBoundaryAt(x,z){
  const r=regionAtWorld(x,z);if(!r)return null;
  const f=r.streetFrame,u=x*f.cos+z*f.sin-f.originU,v=-x*f.sin+z*f.cos-f.originV;
  const du=streetOffset(r,u,r.block[0]),dv=streetOffset(r,v,r.block[1]),axis=du<=dv?0:1;
  const value=axis?v:u,size=r.block[axis],index=Math.floor(value/size),off=value-index*size;
  const w=index%r.arterialEvery===0?ROAD_CLASSES.arterial.width:ROAD_CLASSES.street.width;
  const sign=off<w/2||size-off<off-w?-1:1;
  return {distance:Math.min(du,dv),nx:sign*(axis?-f.sin:f.cos),nz:sign*(axis?f.cos:f.sin)};
}

export function isRoad(x, z) {
  const c = classAt(x, z);
  return c === CLASS.ROAD || c === CLASS.ALLEY;
}

export function isAlley(x, z) {
  return classAt(x, z) === CLASS.ALLEY;
}

export function regionAtWorld(x,z){
  bake();const cx=toCell(x),cz=toCell(z);
  return inGrid(cx,cz)?regions[regionIndexAt(x,z,cx,cz)]||null:null;
}

function regionIndexAt(x,z,cx,cz){
  const i=idx(cx,cz),r=regionOf[i];
  // Only border cells need polygon tests. Interior lookups retain the baked
  // fast path; diagonal district boundaries must not cut roads into stairs.
  if(cx===0||cz===0||cx===SIZE-1||cz===SIZE-1||cells[i]===CLASS.WATER)return r;
  if(regionOf[i-1]===r&&regionOf[i+1]===r&&regionOf[i-SIZE]===r&&regionOf[i+SIZE]===r
    &&regionOf[i-SIZE-1]===r&&regionOf[i-SIZE+1]===r&&regionOf[i+SIZE-1]===r&&regionOf[i+SIZE+1]===r)return r;
  for(let n=regions.length-1;n>=0;n--)if(inPolygon(x,z,regions[n].polygon))return n;
  return -1;
}

export function regionCornerPosition(x,z){
  bake();const cx=toCell(x),cz=toCell(z);if(!inGrid(cx,cz)||cx===0||cz===0||cx===SIZE-1||cz===SIZE-1)return null;
  const i=idx(cx,cz),r=regionOf[i];
  if(regionOf[i-1]===r&&regionOf[i+1]===r&&regionOf[i-SIZE]===r&&regionOf[i+SIZE]===r
    &&regionOf[i-SIZE-1]===r&&regionOf[i-SIZE+1]===r&&regionOf[i+SIZE-1]===r&&regionOf[i+SIZE+1]===r)return null;
  const sides=new Set();for(const dx of [-VOXEL.SIZE/2,VOXEL.SIZE/2])for(const dz of [-VOXEL.SIZE/2,VOXEL.SIZE/2])sides.add(regionAtWorld(x+dx,z+dz));
  if(sides.size<2)return null;
  let best=null,distance=VOXEL.SIZE**2*2;
  for(const side of sides){if(!side)continue;const poly=side.polygon;
    for(let n=0;n<poly.length;n++){
      const a=poly[n],b=poly[(n+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      const px=a[0]+t*dx,pz=a[1]+t*dz,d=(x-px)**2+(z-pz)**2;
      if(d<distance){distance=d;best=[px,pz];}
    }
  }
  return best;
}

// District grids meet at different angles. A shared border height prevents
// their separately graded roads from ending in vertical cliffs (M28).
export function regionInteriorAtWorld(x,z){
  bake();
  if(!regionDistance){
    regionDistance=new Uint16Array(SIZE*SIZE);regionDistance.fill(Math.ceil(PAVING.SEAM_BLEND/CELL));
    for(let j=0;j<SIZE;j++)for(let i=0;i<SIZE;i++){
      const k=idx(i,j),r=regionOf[k];
      if(!i||!j||i===SIZE-1||j===SIZE-1||r<0||regionOf[k-1]!==r||regionOf[k+1]!==r||regionOf[k-SIZE]!==r||regionOf[k+SIZE]!==r)regionDistance[k]=0;
    }
    for(let j=1;j<SIZE;j++)for(let i=1;i<SIZE;i++){
      const k=idx(i,j);regionDistance[k]=Math.min(regionDistance[k],regionDistance[k-1]+1,regionDistance[k-SIZE]+1);
    }
    for(let j=SIZE-2;j>=0;j--)for(let i=SIZE-2;i>=0;i--){
      const k=idx(i,j);regionDistance[k]=Math.min(regionDistance[k],regionDistance[k+1]+1,regionDistance[k+SIZE]+1);
    }
  }
  const fx=x/CELL+HALF-.5,fz=z/CELL+HALF-.5,i=Math.floor(fx),j=Math.floor(fz);
  if(!inGrid(i,j)||!inGrid(i+1,j+1))return 0;
  const tx=fx-i,tz=fz-j,at=(i,j)=>regionDistance[idx(i,j)];
  return ((at(i,j)*(1-tx)+at(i+1,j)*tx)*(1-tz)+(at(i,j+1)*(1-tx)+at(i+1,j+1)*tx)*tz)*CELL;
}

/** Buildable ground: not a road, not a park, not water. */
export function isBuildable(x, z) {
  return classAt(x, z) === CLASS.LAND;
}

export function districtAtWorld(x, z) {
  bake();
  const cx = toCell(x);
  const cz = toCell(z);
  if (!inGrid(cx, cz)) return 'park';
  const i = idx(cx, cz);
  const c = cells[i];
  if (c === CLASS.WATER) return 'water';
  if (c === CLASS.PARK || c === CLASS.PLAZA) return 'park';
  const r = regionOf[i];
  return r >= 0 ? regions[r].district : 'residential';
}

/** The sewer as a GRAPH, not just a mask (milestone 18).
 *
 *  Connected components of the centreline, each guaranteed at least one street
 *  entrance. That guarantee is the AC "no dead space you cannot get out of",
 *  and it is enforced here — by construction, at bake time — rather than
 *  checked afterwards and hoped for. Components too small to be a tunnel are
 *  dropped rather than left as sealed pockets in the rock.
 */
let sewerComponents = null;
let sewerCell = null;

function findSewers() {
  sewerCell = new Uint8Array(SIZE * SIZE);
  sewerComponents = [];
  const seen = new Uint8Array(SIZE * SIZE);
  const stack = [];
  // 8-connected: the centreline runs down rotated grids, so a diagonal step is
  // the same tunnel and treating it as a break would shatter every arterial in
  // a rotated district into dozens of "components".
  const NEIGHBOURS = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  for (let start = 0; start < trunk.length; start++) {
    if (!trunk[start] || seen[start]) continue;
    const cellsIn = [];
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const at = stack.pop();
      cellsIn.push(at);
      const cx = at % SIZE;
      const cz = (at - cx) / SIZE;
      for (const [dx, dz] of NEIGHBOURS) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (!inGrid(nx, nz)) continue;
        const n = idx(nx, nz);
        if (!trunk[n] || seen[n]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (cellsIn.length * CELL < SEWER.MIN_RUN) continue; // a puddle, not a tunnel
    // Entrances, spaced along the run. Sorted first, so which cells get one is
    // a property of the plan and not of flood-fill order.
    cellsIn.sort((a, b) => a - b);
    const entrances = [];
    for (const c of cellsIn) {
      const cx = c % SIZE;
      const x = toWorld(cx);
      const z = toWorld((c - cx) / SIZE);
      if (cells[c] !== CLASS.ROAD) continue; // on a street, never in a building
      if (entrances.some((e) => Math.hypot(e.x - x, e.z - z) < SEWER.ENTRANCE_SPACING)) continue;
      entrances.push({ x, z });
    }
    if (!entrances.length) continue; // nowhere to get in: not a place, so not built
    for (const c of cellsIn) sewerCell[c] = 1;
    sewerComponents.push({ id: sewerComponents.length, cells: cellsIn.length, entrances });
  }
}

/** Every sewer entrance on the island. Used to carve the stairwells, and by the
 *  specs to assert that each tunnel has one. */
export function sewerNetwork() {
  bake();
  return sewerComponents;
}

/** Distance to the nearest sewer centreline, in metres, capped at `max`.
 *
 *  Scanned over a small neighbourhood rather than a distance field: the bore is
 *  a couple of metres wide, so the answer is always within a cell or two, and a
 *  fourth million-cell chamfer at boot to learn that is not worth it. */
export function sewerDistance(x, z, max = 6) {
  bake();
  const reach = Math.ceil(max / CELL);
  const cx = toCell(x);
  const cz = toCell(z);
  let best = max;
  for (let dz = -reach; dz <= reach; dz++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!inGrid(nx, nz) || !sewerCell[idx(nx, nz)]) continue;
      const d = Math.hypot(toWorld(nx) - x, toWorld(nz) - z);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Sparse centreline samples let underground dressing reuse the baked network. */
export function sewerNodesIn(x0,z0,x1,z1) {
  bake();const out=[];
  for(let z=toCell(z0);z<=toCell(z1);z++)for(let x=toCell(x0);x<=toCell(x1);x++)
    if(inGrid(x,z)&&sewerCell[idx(x,z)]){
      const links=[[1,0],[0,1],[1,1],[-1,1]].filter(([dx,dz])=>inGrid(x+dx,z+dz)&&sewerCell[idx(x+dx,z+dz)]).map(([dx,dz])=>[dx*CELL,dz*CELL]);
      out.push({x:toWorld(x),z:toWorld(z),links});
    }
  return out;
}

/** Is the sewer centreline in this cell? */
export function isSewerLine(x, z) {
  bake();
  const cx = toCell(x);
  const cz = toCell(z);
  return inGrid(cx, cz) ? sewerCell[idx(cx, cz)] === 1 : false;
}

/** Does this district have back alleys? What container placement keys off: a
 *  district with alleys puts its bins behind the frontages, one without has to
 *  put them on the kerb, and using one rate for both left most of the island
 *  nearly binless. */
export function hasAlleysAt(x, z) {
  bake();
  const cx = toCell(x);
  const cz = toCell(z);
  if (!inGrid(cx, cz)) return false;
  const r = regionOf[idx(cx, cz)];
  return r >= 0 ? !!regions[r].alleys : false;
}

/** The district's own NAME, not its character — "trash-panda-heights" rather
 *  than "residential". What the map screen and the gazetteer want. */
export function districtNameAtWorld(x, z) {
  bake();
  const cx = toCell(x);
  const cz = toCell(z);
  if (!inGrid(cx, cz)) return null;
  const r = regionOf[idx(cx, cz)];
  return r >= 0 ? regions[r].id : null;
}

/** Buildings whose footprint intersects the box. Bucketed, so the minimap and
 *  the chunk voxelizer both pay for the window rather than the city. */
export function buildingsIn(minX, minZ, maxX, maxZ) {
  bake();
  const seen = new Set();
  const out = [];
  for (let i = Math.floor(minX / BUILDING_BUCKET); i <= Math.floor(maxX / BUILDING_BUCKET); i++) {
    for (let j = Math.floor(minZ / BUILDING_BUCKET); j <= Math.floor(maxZ / BUILDING_BUCKET); j++) {
      for (const b of buildingGrid.get(`${i},${j}`) || []) {
        if (seen.has(b)) continue;
        seen.add(b);
        if (b.x > maxX || b.x + b.w < minX || b.z > maxZ || b.z + b.d < minZ) continue;
        out.push(b);
      }
    }
  }
  return out;
}

export function allBuildings() {
  bake();
  return buildings;
}

export function allBlocks() {
  bake();
  return blocks;
}

export function regionCount() {
  return regions.length;
}

export const BOUNDS = plan.bounds;
export const GRID_SIZE = SIZE;
export { plan, regions };
