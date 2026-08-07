import plan from './islandPlan.js';
import { TERRAIN, VOXEL } from '../core/Constants.js';
import { inPolygon, polygonBounds, smoothstep } from '../core/MathUtils.js';

// The island's shape and its third dimension (milestone 17).
//
// This module owns exactly two questions and nothing else:
//
//   surfaceHeight(x, z)        how high is the ground here?
//   materialAtVoxel(vx,vy,vz)  what is this voxel made of, if anything?
//
// THE decision in the milestone is that ground is IMPLICIT: the second question
// is answered by arithmetic against the first, not by stored voxels. Depth
// therefore costs nothing — `TERRAIN.DEPTH` at 20 m and at 200 m produce the
// same boot and the same memory, because nothing iterates it. VoxelWorld keeps
// only a constant-thickness skin of real voxels at the surface for the mesher
// to draw, and materialises more only where a blast exposes it.
//
// Everything is baked into one height grid at boot, exactly as the masterplan
// bakes its class grid, and for the same reason: a fixed array is deterministic
// and order-independent BY CONSTRUCTION rather than by discipline, which is
// what streaming needs (milestone 12) and what the generated city failed at.
//
// It deliberately does NOT know about roads, districts or buildings — it hands
// back a TOPSOIL marker for the visible skin and lets `Layout` decide whether
// that skin is tarmac, brick or grass. That one-way dependency is what keeps
// CityPlanner free to ask this module where the water is.

export { plan };
export const CELL = TERRAIN.CELL;
export const BOUNDS = plan.bounds;

// The material id `materialAtVoxel` returns for the visible top band. It is a
// real material (so a caller that ignores the distinction still gets dirt), but
// Layout replaces it with the surface class — road, alley, park.
export const TOPSOIL = 8;
const CLAY = 9;
const ROCK = 10;
const DEEPROCK = 11;
const SAND = 12;

const SIZE = Math.ceil((BOUNDS * 2) / CELL);
const HALF = SIZE / 2;
const INF = 1e9;

let height = null;   // Float32Array — world y of the ground surface, per cell
let shore = null;    // Float32Array — signed metres to the coastline, + on land
let deck = null;     // Uint8Array — 1 where a bridge causeway overrides the sea
let baked = false;

const toCell = (w) => Math.floor(w / CELL) + HALF;
const toWorld = (c) => (c - HALF) * CELL + CELL / 2;
const idx = (cx, cz) => cz * SIZE + cx;
const inGrid = (cx, cz) => cx >= 0 && cz >= 0 && cx < SIZE && cz < SIZE;

/** Chamfer distance transform, in CELLS, from every cell to the nearest seed.
 *
 *  Two sweeps over the grid rather than a flood fill: this is what turns a hard
 *  land/water mask into a beach and a flat district into a slope, and doing it
 *  by blurring instead would need a kernel as wide as the ramp. */
function chamfer(isSeed) {
  const d = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < d.length; i++) d[i] = isSeed[i] ? 0 : INF;
  const D = 1;
  const Q = Math.SQRT2;
  for (let cz = 0; cz < SIZE; cz++) {
    for (let cx = 0; cx < SIZE; cx++) {
      const i = idx(cx, cz);
      let v = d[i];
      if (v === 0) continue;
      if (cx > 0) v = Math.min(v, d[i - 1] + D);
      if (cz > 0) v = Math.min(v, d[i - SIZE] + D);
      if (cx > 0 && cz > 0) v = Math.min(v, d[i - SIZE - 1] + Q);
      if (cx < SIZE - 1 && cz > 0) v = Math.min(v, d[i - SIZE + 1] + Q);
      d[i] = v;
    }
  }
  for (let cz = SIZE - 1; cz >= 0; cz--) {
    for (let cx = SIZE - 1; cx >= 0; cx--) {
      const i = idx(cx, cz);
      let v = d[i];
      if (v === 0) continue;
      if (cx < SIZE - 1) v = Math.min(v, d[i + 1] + D);
      if (cz < SIZE - 1) v = Math.min(v, d[i + SIZE] + D);
      if (cx < SIZE - 1 && cz < SIZE - 1) v = Math.min(v, d[i + SIZE + 1] + Q);
      if (cx > 0 && cz < SIZE - 1) v = Math.min(v, d[i + SIZE - 1] + Q);
      d[i] = v;
    }
  }
  return d;
}

/** Mark every cell inside a polygon. */
function stamp(mask, poly, value = 1) {
  const [minX, minZ, maxX, maxZ] = polygonBounds(poly);
  const x0 = Math.max(0, toCell(minX));
  const x1 = Math.min(SIZE - 1, toCell(maxX) + 1);
  const z0 = Math.max(0, toCell(minZ));
  const z1 = Math.min(SIZE - 1, toCell(maxZ) + 1);
  for (let cz = z0; cz <= z1; cz++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (inPolygon(toWorld(cx), toWorld(cz), poly)) mask[idx(cx, cz)] = value;
    }
  }
}

/** March out from a bridge's anchor until land, on both sides of an axis.
 *
 *  The plan records where a bridge is and how wide, not which way it runs —
 *  that is a property of the water it crosses, and reading it off the water
 *  body's bounding box gets the canals right and Lake Onion wrong (a bridge
 *  anchored in the lake would be told to run the lake's long way and bisect
 *  it). Probing the land mask in all four directions and taking the SHORTER
 *  crossing is both simpler and correct wherever the anchor happens to sit. */
function crossing(landMask, at) {
  const reach = Math.ceil(TERRAIN.BRIDGE_MAX / CELL);
  const cx0 = toCell(at[0]);
  const cz0 = toCell(at[1]);
  const march = (dx, dz) => {
    for (let n = 1; n <= reach; n++) {
      const cx = cx0 + dx * n;
      const cz = cz0 + dz * n;
      if (!inGrid(cx, cz)) return n;
      if (landMask[idx(cx, cz)]) return n;
    }
    return Infinity;
  };
  const west = march(-1, 0);
  const east = march(1, 0);
  const north = march(0, -1);
  const south = march(0, 1);
  // The deck's WIDTH is measured along the axis it does not travel.
  return west + east <= north + south
    ? { axis: 'x', lo: cx0 - west, hi: cx0 + east, along: 'z' }
    : { axis: 'z', lo: cz0 - north, hi: cz0 + south, along: 'x' };
}

export function bake() {
  if (baked) return;
  baked = true;

  // 1. Land: inside the coast, outside every lake, canal and river. The whole
  //    silhouette of the game comes from this one mask.
  const land = new Uint8Array(SIZE * SIZE);
  stamp(land, plan.coast, 1);
  for (const body of plan.water) stamp(land, body.polygon, 0);

  // 2. Signed distance to the coastline. Positive inland, negative at sea.
  const water = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < land.length; i++) water[i] = land[i] ? 0 : 1;
  const intoLand = chamfer(water); // 0 at the water's edge, growing inland
  const intoSea = chamfer(land);
  shore = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < shore.length; i++) {
    shore[i] = (land[i] ? intoLand[i] : -intoSea[i]) * CELL;
  }

  // 3. Flat districts relax back into the hills over FLATTEN_RUN. Built as a
  //    distance rather than a hard mask, or downtown ends in a cliff.
  const flatMask = new Uint8Array(SIZE * SIZE);
  for (const d of plan.districts) {
    if (TERRAIN.FLAT_DISTRICTS.includes(d.id)) stamp(flatMask, d.polygon, 1);
  }
  const fromFlat = chamfer(flatMask);

  // 4a. Hills, accumulated hill-by-hill over each one's own bounding box.
  //     Iterating cells outer and hills inner instead is 8 million hypots for
  //     a shape that covers about 200 thousand cells, and it was most of the
  //     bake.
  const rise = new Float32Array(SIZE * SIZE);
  for (const hill of plan.hills) {
    const [hx, hz] = hill.at;
    const r = hill.radius;
    const x0 = Math.max(0, toCell(hx - r));
    const x1 = Math.min(SIZE - 1, toCell(hx + r) + 1);
    const z0 = Math.max(0, toCell(hz - r));
    const z1 = Math.min(SIZE - 1, toCell(hz + r) + 1);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const t = Math.hypot(toWorld(cx) - hx, toWorld(cz) - hz) / r;
        if (t >= 1) continue;
        // Cosine bump: flat at the summit, flat where it meets the ground, and
        // a long ramp in between — the shape a shopping trolley can build
        // speed down (Chris: "enough to be fun… you want to be able to do a
        // jump").
        rise[idx(cx, cz)] += hill.height * 0.5 * (1 + Math.cos(t * Math.PI));
      }
    }
  }

  // 4b. Base ground: a beach in both directions off the waterline, with the
  //     hills faded out at the coast (so a peninsula rises from its own beach
  //     rather than ending in a sea cliff) and into the flat districts.
  height = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < height.length; i++) {
    const d = shore[i];
    if (d < 0) {
      height[i] = TERRAIN.SEA_LEVEL
        - TERRAIN.SEABED_DEPTH * smoothstep(-d / TERRAIN.SHORE_RUN);
      continue;
    }
    let h = TERRAIN.SEA_LEVEL + TERRAIN.LAND_GRADE * smoothstep(d / TERRAIN.SHORE_RUN);
    if (rise[i] > 0) {
      // The hill's own fade uses HILL_COAST_RUN, not the beach's SHORE_RUN.
      // Sharing them made the fade steeper than anything it was fading.
      h += rise[i] * smoothstep(d / TERRAIN.HILL_COAST_RUN)
        * smoothstep((fromFlat[i] * CELL) / TERRAIN.FLATTEN_RUN);
    }
    height[i] = h;
  }

  // 5. Bridges, stamped last so they win over the water they cross. Without
  //    them the canal cuts the island in two and half the map is unreachable on
  //    foot.
  //
  //    The deck is RAISED, not a causeway at grade: two 70 m causeways across
  //    Lake Onion's north end filled a third of the lake and it stopped reading
  //    as water at all. Raised means approach ramps, which is why the corridor
  //    runs onto the land at both ends and lerps down to meet it — a step at
  //    the shore would be a wall, since Jimothy climbs 2.6 m.
  deck = new Uint8Array(SIZE * SIZE);
  const approach = Math.max(1, Math.round(TERRAIN.BRIDGE_APPROACH / CELL));
  for (const bridge of plan.bridges) {
    const cross = crossing(land, bridge.at);
    if (!Number.isFinite(cross.lo) || !Number.isFinite(cross.hi)) continue;
    const centre = toCell(cross.along === 'x' ? bridge.at[0] : bridge.at[1]);
    const w = Math.max(1, Math.round(TERRAIN.BRIDGE_WIDTH / 2 / CELL));
    for (let t = cross.lo - approach; t <= cross.hi + approach; t++) {
      // 0 across the water itself, ramping to 1 at the far end of the approach.
      const beyond = Math.max(0, Math.max(cross.lo - t, t - cross.hi));
      const k = smoothstep(beyond / approach);
      for (let s = centre - w; s <= centre + w; s++) {
        const cx = cross.axis === 'x' ? t : s;
        const cz = cross.axis === 'x' ? s : t;
        if (!inGrid(cx, cz)) continue;
        const i = idx(cx, cz);
        const ramp = TERRAIN.BRIDGE_DECK * (1 - k) + height[i] * k;
        // Only ever raise. An approach that runs into a hillside is subsumed
        // by it rather than cutting a notch out of it.
        if (ramp > height[i]) {
          height[i] = ramp;
          if (!land[i]) deck[i] = 1;
        }
      }
    }
  }
}

// --- queries (all O(1) against the bake) ------------------------------------

/** World y of the ground surface. Bilinear between cell centres, so slopes are
 *  smooth in world space even though the field is stored every CELL metres. */
export function surfaceHeight(x, z) {
  bake();
  const fx = x / CELL + HALF - 0.5;
  const fz = z / CELL + HALF - 0.5;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;
  const h = (cx, cz) => (inGrid(cx, cz)
    ? height[idx(cx, cz)]
    : TERRAIN.SEA_LEVEL - TERRAIN.SEABED_DEPTH);
  const a = h(x0, z0) * (1 - tx) + h(x0 + 1, z0) * tx;
  const b = h(x0, z0 + 1) * (1 - tx) + h(x0 + 1, z0 + 1) * tx;
  return a * (1 - tz) + b * tz;
}

/** Above the waterline. Defined off the height field rather than off a separate
 *  mask, so the coast the player walks into is exactly the coast the city was
 *  planned against — there is only one answer to disagree with. */
export function isLand(x, z) {
  return surfaceHeight(x, z) > TERRAIN.SEA_LEVEL;
}

/** Dry enough to carry a road or a building: keeps the city off its own
 *  tideline without a second mask. */
export function isBuildableGround(x, z) {
  return surfaceHeight(x, z) >= TERRAIN.BUILD_MIN_HEIGHT;
}

/** Is this a bridge causeway? The deck is over water, so the surface class has
 *  to come from here rather than from the street network. */
export function isDeck(x, z) {
  bake();
  const cx = toCell(x);
  const cz = toCell(z);
  return inGrid(cx, cz) ? deck[idx(cx, cz)] === 1 : false;
}

/** Metres to the coastline, negative at sea. Handy for anything that wants to
 *  know "how far inland am I" without a second distance field. */
export function shoreDistance(x, z) {
  bake();
  const cx = toCell(x);
  const cz = toCell(z);
  return inGrid(cx, cz) ? shore[idx(cx, cz)] : -INF;
}

/** Index of the topmost SOLID terrain voxel in this column. */
export function topSolidVoxelY(x, z) {
  return Math.floor(surfaceHeight(x, z) / VOXEL.SIZE - 0.5);
}

/** What the ground is made of at a voxel — 0 for air above the surface.
 *
 *  This is the implicit ground. It reads the height field and a depth rule and
 *  stores nothing, which is why 20 m of depth and 200 m cost the same. The
 *  visible band comes back as TOPSOIL for `Layout` to reinterpret as road,
 *  alley or park. */
export function materialAtVoxel(vx, vy, vz) {
  const s = VOXEL.SIZE;
  const wx = (vx + 0.5) * s;
  const wz = (vz + 0.5) * s;
  const wy = (vy + 0.5) * s;
  const surface = surfaceHeight(wx, wz);
  if (wy >= surface) return 0;
  const depth = surface - wy;
  // Bedrock is the floor a dig cannot pass. Without one, a roll digs straight
  // through and strands Jimothy in a pit he can't climb (playtest 2026-07-23).
  if (depth >= TERRAIN.DEPTH) return VOXEL.BEDROCK;
  if (depth < TERRAIN.TOPSOIL_DEPTH) {
    // Underwater the top band is sand, not soil — the beach has to read as a
    // beach from the moment it leaves the grass.
    return surface <= TERRAIN.SEA_LEVEL ? SAND : TOPSOIL;
  }
  if (depth < TERRAIN.CLAY_DEPTH) return CLAY;
  if (depth < TERRAIN.ROCK_DEPTH) return ROCK;
  return DEEPROCK;
}

/** For specs and tools: the plan's own numbers, so an assertion about the
 *  island can be written against what was AUTHORED rather than against what
 *  the bake happened to produce. */
export function gridSize() {
  bake();
  return SIZE;
}

/** Raw access to the baked field, for the masterplan bake.
 *
 *  Deliberately direct rather than a million `surfaceHeight` calls: both grids
 *  are `Math.ceil(plan.bounds * 2 / CELL)` cells of the SAME plan, so they are
 *  index-identical by construction. `assertSameGrid` is what keeps that true if
 *  either ever changes. */
export function grid() {
  bake();
  return { height, deck, SIZE, HALF, CELL };
}

export function assertSameGrid(size, half, cell) {
  bake();
  if (size !== SIZE || half !== HALF || cell !== CELL) {
    throw new Error(
      `terrain grid ${SIZE}/${HALF}/${CELL} does not match caller ${size}/${half}/${cell}`,
    );
  }
}
