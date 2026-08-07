import { CITY, VOXEL, WORLD } from '../core/Constants.js';

// The city's layout, as a pure function of the seed and a coordinate
// (milestone 12).
//
// Nothing here allocates a voxel, touches the scene, or needs a browser. It
// answers "what is at (x, z)?" for the WHOLE city — including places that have
// never been generated — which is what makes two things possible:
//
//   1. Streaming. A chunk asks layout what belongs inside it and voxelizes
//      only that, so boot cost stops scaling with world size (JIM-01).
//   2. The minimap and waypoints (milestone 13). Drawn from loaded chunks they
//      would show a small disc around the player and nothing else.
//
// It is also the only part of the city that can be tested as arithmetic.

// --- the grid ---------------------------------------------------------------
//
// Block and road spans are defined in VOXEL units, not world units, because
// the road mask is a voxel-grid modulo and the building footprints have to
// align to the same grid or they end up sitting in the road.
const BLOCK_V = Math.round(CITY.BLOCK / VOXEL.SIZE);
const ROAD_V = Math.round(CITY.ROAD / VOXEL.SIZE);
const MARGIN_V = Math.round(CITY.BUILDING_MARGIN / VOXEL.SIZE);

/** Positional hash. The old buildDistrict drew from one sequential PRNG in
 *  nested-loop order, so a block's properties depended on how many blocks had
 *  been generated before it — under streaming, that means the city rearranges
 *  itself depending on which way the player walked. Hashing the coordinates
 *  instead makes every block independent of every other. */
function hash2(seed, i, j) {
  let h = (seed ^ Math.imul(i, 374761393) ^ Math.imul(j, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Per-block RNG seeded by position. Same LCG the city always used, so the
 *  distribution of sizes and heights is unchanged — only where the seed comes
 *  from has changed. */
function blockRng(i, j) {
  let s = hash2(CITY.SEED, i, j);
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// --- queries ----------------------------------------------------------------

/** Is this voxel column road? Roads run along the low edge of each block in
 *  both axes, which is what makes them a connected grid rather than strips. */
export function roadAtVoxel(vx, vz) {
  return ((vx % BLOCK_V) + BLOCK_V) % BLOCK_V < ROAD_V
    || ((vz % BLOCK_V) + BLOCK_V) % BLOCK_V < ROAD_V;
}

export function roadAtWorld(x, z) {
  return roadAtVoxel(Math.floor(x / VOXEL.SIZE), Math.floor(z / VOXEL.SIZE));
}

/** Which block covers this world position. */
export function blockIndexAt(x, z) {
  return {
    i: Math.floor(x / VOXEL.SIZE / BLOCK_V),
    j: Math.floor(z / VOXEL.SIZE / BLOCK_V),
  };
}

/** The building on block (i, j), or null for road-only, out-of-bounds, and
 *  spawn-adjacent blocks. World units; `x`/`z` are the min corner.
 *
 *  Pure and cheap by construction — no iteration over other blocks, no shared
 *  state — which is what every other query here relies on. */
export function buildingAt(i, j) {
  // Buildable span sits AFTER the road band, so a footprint can never overlap
  // a road however the random size lands.
  const x0v = i * BLOCK_V + ROAD_V + MARGIN_V;
  const z0v = j * BLOCK_V + ROAD_V + MARGIN_V;
  const spanV = BLOCK_V - ROAD_V - MARGIN_V * 2;
  if (spanV < 4) return null;

  const x0 = x0v * VOXEL.SIZE;
  const z0 = z0v * VOXEL.SIZE;
  const cx = x0 + (spanV * VOXEL.SIZE) / 2;
  const cz = z0 + (spanV * VOXEL.SIZE) / 2;

  // Keep the whole footprint inside the playable square.
  const limit = WORLD.BOUNDS - CITY.BLOCK;
  if (Math.abs(cx) > limit || Math.abs(cz) > limit) return null;
  // Keep spawn clear so Jimothy never wakes up inside a wall.
  if (Math.hypot(cx, cz) < CITY.BLOCK * 0.8) return null;

  const rng = blockRng(i, j);
  const shrink = Math.round(rng() * 6 / VOXEL.SIZE);
  const wV = Math.max(6, spanV - shrink);
  const dV = Math.max(6, spanV - Math.round(rng() * 6 / VOXEL.SIZE));

  const downtown = Math.hypot(cx, cz) < CITY.DOWNTOWN_RADIUS;
  const h = Math.round(
    CITY.MIN_HEIGHT + rng() * (CITY.MAX_HEIGHT - CITY.MIN_HEIGHT) * (downtown ? 1 : 0.45),
  );
  const type = downtown && rng() > 0.35 ? 'tower' : 'craftsman';

  return {
    i,
    j,
    type,
    // Voxel-space origin and extent: what the voxelizer wants, with no
    // rounding done twice.
    vx: x0v,
    vz: z0v,
    vw: wV,
    vd: dV,
    vh: type === 'tower' ? h + 4 : Math.max(5, h),
    // World-space box: what the minimap wants.
    x: x0,
    z: z0,
    w: wV * VOXEL.SIZE,
    d: dV * VOXEL.SIZE,
  };
}

/** Every building whose FOOTPRINT INTERSECTS the world-space box.
 *
 *  By intersection, never by origin. buildCraftsman writes a 14×12 footprint
 *  and a chunk is 64 voxels, so a house near a seam belongs to several chunks
 *  at once — asking "which buildings start in this box" leaves sliced houses
 *  at every seam. The one-block margin covers footprints whose origin lies in
 *  a neighbouring block. */
export function buildingsIntersecting(minX, minZ, maxX, maxZ) {
  const a = blockIndexAt(minX, minZ);
  const b = blockIndexAt(maxX, maxZ);
  const out = [];
  for (let i = a.i - 1; i <= b.i + 1; i++) {
    for (let j = a.j - 1; j <= b.j + 1; j++) {
      const bld = buildingAt(i, j);
      if (!bld) continue;
      if (bld.x > maxX || bld.x + bld.w < minX) continue;
      if (bld.z > maxZ || bld.z + bld.d < minZ) continue;
      out.push(bld);
    }
  }
  return out;
}

export function isInsideBounds(x, z) {
  return Math.abs(x) <= WORLD.BOUNDS && Math.abs(z) <= WORLD.BOUNDS;
}

export const GRID = { BLOCK_V, ROAD_V, MARGIN_V };
