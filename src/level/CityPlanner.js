import * as Terrain from './Terrain.js';
import { TERRAIN, SEWER } from '../core/Constants.js';
import { inPolygon, polygonBounds } from '../core/MathUtils.js';

const plan = Terrain.plan;

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
};

const SIZE = Math.ceil((plan.bounds * 2) / CELL);
const HALF = SIZE / 2;

let cells = null;
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

      const bw = target * (0.55 + r(1) * 0.5);
      const bd = target * (0.55 + r(2) * 0.5);
      if (!fits(x, z, bw, bd, block.id, taken)) continue;
      claim(x, z, bw, bd, taken);

      out.push({
        type: mix[Math.floor(r(3) * mix.length) % mix.length],
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

  findBlocks();
  findSewers();
  baked = true;
  indexBuildings();
}

// --- queries (all O(1) against the bake) ------------------------------------

export function classAt(x, z) {
  bake();
  const cx = toCell(x);
  const cz = toCell(z);
  if (!inGrid(cx, cz)) return CLASS.WATER;
  return cells[idx(cx, cz)];
}

export function isRoad(x, z) {
  const c = classAt(x, z);
  return c === CLASS.ROAD || c === CLASS.ALLEY;
}

export function isAlley(x, z) {
  return classAt(x, z) === CLASS.ALLEY;
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
