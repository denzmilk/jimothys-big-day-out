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

// --- districts (milestone 15) ------------------------------------------------
//
// A district spans several blocks and decides the MIX of what its blocks hold,
// not the contents. That indirection is what stops the island reading as one
// texture: downtown still rises in the middle, and everywhere else varies by
// neighbourhood rather than by distance alone.
const DISTRICT_BLOCKS = 3;

// `lots` is how finely a block subdivides. One centred building per block is
// exactly what made the old city read as rows and columns, so only downtown
// and industry — where big single footprints are correct — keep it.
const DISTRICTS = {
  downtown: { lots: 1, mix: ['tower', 'tower', 'apartment', 'shop'] },
  commercial: { lots: 2, mix: ['shop', 'shop', 'apartment', 'warehouse'] },
  residential: { lots: 2, mix: ['craftsman', 'craftsman', 'craftsman', 'shed', 'apartment'] },
  industrial: { lots: 1, mix: ['warehouse', 'warehouse', 'shed'] },
  park: { lots: 0, mix: [] },
};

// Footprint and height rules per archetype, in VOXELS. Variety is far cheaper
// in proportion than in new geometry: a tall narrow craftsman with a steep
// roof already reads as a different building from a low wide one.
const ARCHETYPES = {
  craftsman: { fill: [0.65, 0.95], h: [5, 9] },
  shed: { fill: [0.35, 0.55], h: [3, 4] },
  apartment: { fill: [0.75, 1.0], h: [10, 16] },
  shop: { fill: [0.8, 1.0], h: [4, 6] },
  warehouse: { fill: [0.85, 1.0], h: [5, 8] },
  tower: { fill: [0.7, 1.0], h: [18, 26] },
};

/** Which district block (i, j) belongs to. Coarser than a block and hashed on
 *  its own cell, so neighbourhoods have extent instead of every block rolling
 *  independently. */
export function districtAt(i, j) {
  const cx = (i + 0.5) * BLOCK_V * VOXEL.SIZE;
  const cz = (j + 0.5) * BLOCK_V * VOXEL.SIZE;
  const r = Math.hypot(cx, cz);
  if (r < CITY.DOWNTOWN_RADIUS) return 'downtown';
  const h = hash2(CITY.SEED ^ 0x5bf03635,
    Math.floor(i / DISTRICT_BLOCKS), Math.floor(j / DISTRICT_BLOCKS)) / 0x100000000;
  // Commercial hugs downtown; industry and parks sit further out. The rings
  // are a bias, not a rule — a park near the middle is a nice surprise.
  if (r < CITY.DOWNTOWN_RADIUS * 2.5) {
    // A little industry in the inner ring too: measured at 2% of blocks when
    // it was pushed entirely to the outskirts, which is not a district so much
    // as a rumour.
    if (h < 0.38) return 'commercial';
    if (h < 0.78) return 'residential';
    return h < 0.9 ? 'industrial' : 'park';
  }
  if (h < 0.5) return 'residential';
  if (h < 0.7) return 'industrial';
  if (h < 0.88) return 'commercial';
  return 'park';
}

/** Every building on block (i, j) — 0, 1, 2 or 4 of them.
 *
 *  Pure and cheap by construction: no iteration over other blocks and no
 *  shared state, which is what streaming, the minimap and the safety tests all
 *  rely on. */
export function buildingsAt(i, j) {
  // The buildable span starts AFTER the road band. Lots subdivide THIS, never
  // the block — that is what keeps "no building on a road" true by
  // construction rather than by tuning (milestone 12).
  const originX = i * BLOCK_V + ROAD_V + MARGIN_V;
  const originZ = j * BLOCK_V + ROAD_V + MARGIN_V;
  const spanV = BLOCK_V - ROAD_V - MARGIN_V * 2;
  if (spanV < 8) return [];

  const district = districtAt(i, j);
  const spec = DISTRICTS[district];
  if (!spec.lots) return [];

  const rng = blockRng(i, j);
  // 1 lot fills the span; 2+ subdivides it into an n x n grid.
  const n = spec.lots === 1 ? 1 : 2;
  const cellV = Math.floor(spanV / n);
  const out = [];

  for (let lx = 0; lx < n; lx++) {
    for (let lz = 0; lz < n; lz++) {
      const r1 = rng();
      const r2 = rng();
      const r3 = rng();
      // Gaps: a missing lot is a yard, a car park, a vacant plot. Variation in
      // what ISN'T there matters as much as what is.
      if (n > 1 && r1 < 0.18) continue;

      const type = spec.mix[Math.floor(r2 * spec.mix.length) % spec.mix.length];
      const arch = ARCHETYPES[type];
      const fill = arch.fill[0] + r3 * (arch.fill[1] - arch.fill[0]);
      // Leave at least one voxel of air between neighbouring lots, so two
      // buildings can never share a wall — the no-overlap guarantee.
      const maxV = cellV - (n > 1 ? 2 : 0);
      const wV = Math.max(4, Math.round(maxV * fill));
      const dV = Math.max(4, Math.round(maxV * (arch.fill[0] + rng() * (arch.fill[1] - arch.fill[0]))));
      // Setback varies where in its lot the building sits, which is most of
      // what stops a street looking like a row of identical boxes.
      const vx = originX + lx * cellV + Math.floor(rng() * Math.max(1, maxV - wV));
      const vz = originZ + lz * cellV + Math.floor(rng() * Math.max(1, maxV - dV));

      const x = vx * VOXEL.SIZE;
      const z = vz * VOXEL.SIZE;
      const cx = x + (wV * VOXEL.SIZE) / 2;
      const cz = z + (dV * VOXEL.SIZE) / 2;
      // Whole footprint inside the playable square…
      const limit = WORLD.BOUNDS - CITY.BLOCK;
      if (Math.abs(cx) > limit || Math.abs(cz) > limit) continue;
      // …and spawn stays clear, so Jimothy never wakes up inside a wall.
      if (Math.hypot(cx, cz) < CITY.BLOCK * 0.8) continue;

      const hRange = arch.h;
      out.push({
        i,
        j,
        district,
        type,
        // Voxel-space origin and extent: what the voxelizer wants, with no
        // rounding done twice.
        vx,
        vz,
        vw: wV,
        vd: dV,
        vh: hRange[0] + Math.floor(rng() * (hRange[1] - hRange[0] + 1)),
        // World-space box: what the minimap wants.
        x,
        z,
        w: wV * VOXEL.SIZE,
        d: dV * VOXEL.SIZE,
      });
    }
  }
  return out;
}

/** The first building on a block, or null. Kept because the milestone-12
 *  specs measure a single footprint and remain the clearest statement of the
 *  road-alignment and order-independence guarantees. */
export function buildingAt(i, j) {
  return buildingsAt(i, j)[0] || null;
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
      for (const bld of buildingsAt(i, j)) {
        if (bld.x > maxX || bld.x + bld.w < minX) continue;
        if (bld.z > maxZ || bld.z + bld.d < minZ) continue;
        out.push(bld);
      }
    }
  }
  return out;
}

/** Every container on block (i, j). Bins live on kerbs, so they are pinned to
 *  the road band and run along it.
 *
 *  Per block from the seed, rather than a fixed count scattered over the whole
 *  map: `TRASH_CAN.COUNT` (70) spread across `WORLD.BOUNDS` meant that raising
 *  bounds 250 → 1000 divided the density by 16 and left the island empty
 *  outside the centre (JIM-32). Placed this way, density is a property of a
 *  block and never changes however big the world gets.
 *
 *  `id` is stable across unload and reload, which is what lets a bin the
 *  player already emptied stay empty instead of refilling when they walk back. */
export function propsAt(i, j) {
  const rng = blockRng(i ^ 0x51ed, j ^ 0x2f9d);
  const out = [];
  const count = 1 + Math.floor(rng() * 3);
  const roadW = ROAD_V * VOXEL.SIZE;
  const span = BLOCK_V * VOXEL.SIZE;
  const baseX = i * BLOCK_V * VOXEL.SIZE;
  const baseZ = j * BLOCK_V * VOXEL.SIZE;
  // One kerb line per block, not per bin. Letting each bin pick its own axis
  // put two of them within centimetres of each other at the corner, and
  // cannon-es resolves an overlap by flinging both apart — so they toppled on
  // their own, spilling free food and free heat with no player input. The old
  // eager layout enforced a 3.5 m gap by rejection sampling; this gets the
  // same guarantee by construction.
  const horizontal = rng() > 0.5;
  const runStart = roadW;
  const runLength = span - roadW;
  for (let n = 0; n < count; n++) {
    const kind = Math.floor(rng() * 4);
    // One bin per segment, jittered inside the middle half of it, so the
    // spacing can never fall below a quarter of a segment.
    const along = runStart + runLength * ((n + 0.25 + rng() * 0.5) / count);
    const x = horizontal ? baseX + along : baseX + roadW * 0.6;
    const z = horizontal ? baseZ + roadW * 0.6 : baseZ + along;
    if (Math.hypot(x, z) < 6) continue; // keep spawn clear
    if (!isInsideBounds(x, z)) continue;
    out.push({ id: `${i},${j},${n}`, x: +x.toFixed(2), z: +z.toFixed(2), kind });
  }
  return out;
}

/** Containers whose position falls inside the world-space box. */
export function propsIn(minX, minZ, maxX, maxZ) {
  const a = blockIndexAt(minX, minZ);
  const b = blockIndexAt(maxX, maxZ);
  const out = [];
  for (let i = a.i; i <= b.i; i++) {
    for (let j = a.j; j <= b.j; j++) {
      for (const p of propsAt(i, j)) {
        if (p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ) out.push(p);
      }
    }
  }
  return out;
}

export function isInsideBounds(x, z) {
  return Math.abs(x) <= WORLD.BOUNDS && Math.abs(z) <= WORLD.BOUNDS;
}

export const GRID = { BLOCK_V, ROAD_V, MARGIN_V };
