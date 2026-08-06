import { VOXEL, CITY, WORLD } from '../core/Constants.js';

// Authored voxel content. Buildings are written as footprints + rules rather
// than baked voxel data, so the city stays diffable, seed-reproducible, and
// hand-editable — a district this size can't be placed by hand.
//
// Material ids come from VOXEL.MATERIALS.
const CLAPBOARD = 1, SHINGLE = 2, BRICK = 3, GLASS = 4, MOSS = 5, CONCRETE = 6;

/** Deterministic PRNG — the city must rebuild identically on restart and in
 *  tests, so Math.random() is not an option. */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** A Ballard craftsman: brick footing, clapboard walls, punched windows, a
 *  peaked shingle roof, and a door gap Jimothy can waddle through. */
export function buildCraftsman(world, ox, oy, oz, w = 14, d = 12, h = 9) {
  const solid = (x, y, z, m) => world.set(ox + x, oy + y, oz + z, m);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        const edge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
        if (!edge) continue;
        const isDoor = z === 0 && y < 3 && x >= (w >> 1) - 1 && x <= (w >> 1);
        if (isDoor) continue;
        const isWindow = y >= 3 && y <= 5 && (x % 4 === 2) && (z === 0 || z === d - 1);
        solid(x, y, z, y < 2 ? BRICK : isWindow ? GLASS : CLAPBOARD);
      }
    }
  }
  const peak = Math.ceil(w / 2);
  for (let r = 0; r < peak; r++) {
    for (let z = -1; z <= d; z++) {
      for (const x of [r, w - 1 - r]) solid(x, h + r, z, z < d / 3 ? MOSS : SHINGLE);
      if (r === peak - 1) for (let x = r; x <= w - 1 - r; x++) solid(x, h + r, z, SHINGLE);
    }
  }
}

/** Downtown block: brick/glass tower with banded windows and a flat roof. */
export function buildTower(world, ox, oy, oz, w, d, h) {
  const solid = (x, y, z, m) => world.set(ox + x, oy + y, oz + z, m);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        const edge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
        if (!edge && y !== h - 1) continue;
        const band = y > 1 && y % 3 !== 0;
        solid(x, y, z, y === h - 1 ? CONCRETE : band ? GLASS : BRICK);
      }
    }
  }
}

/** Jimothy's house: a squashed trash can on its side, torn open at the front.
 *  Real raccoon dens are tree hollows and abandoned vehicles — a crushed
 *  "raccoon-resistant" bin is the joke (see docs/lore.md). */
export function buildTrashCanDen(world, ox, oy, oz, length = 9, radius = 4) {
  const squash = 0.62;
  for (let a = 0; a < length; a++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const dist = Math.hypot(y / (radius * squash), z / radius);
        if (dist > 1 || dist < 0.72) continue;
        if (a === 0 && z > -radius * 0.35) continue; // torn-open mouth
        const dented = a > length - 3 && y > radius * 0.3;
        world.set(ox + a, oy + y + radius, oz + z, dented ? MOSS : CONCRETE);
      }
    }
  }
  for (const a of [2, Math.max(3, length - 3)]) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const dist = Math.hypot(y / (radius * squash), z / radius);
        if (dist > 1.1 || dist < 0.88) continue;
        world.set(ox + a, oy + y + radius, oz + z, BRICK);
      }
    }
  }
}

/** Deformable ground: real voxel strata under the whole city, so blasts leave
 *  craters you can walk into rather than scorch marks. */
export function buildGround(world, bounds) {
  const half = Math.ceil(bounds / VOXEL.SIZE);
  const road = Math.round(CITY.ROAD / VOXEL.SIZE);
  const block = Math.round(CITY.BLOCK / VOXEL.SIZE);
  for (let x = -half; x <= half; x++) {
    for (let z = -half; z <= half; z++) {
      // Roads run on the block grid; everything else is grass.
      const onRoad = ((x % block) + block) % block < road
        || ((z % block) + block) % block < road;
      for (let layer = 1; layer <= VOXEL.GROUND_LAYERS; layer++) {
        // Bottom layer is bedrock — diggable ground above it, hard floor
        // below, so craters are deep enough to matter but never a trap.
        const mat = layer === VOXEL.GROUND_LAYERS ? VOXEL.BEDROCK
          : layer === 1 ? (onRoad ? CONCRETE : MOSS) : CONCRETE;
        world.set(x, -layer, z, mat);
      }
    }
  }
}

/** Generate the district: a street grid of residential blocks with a taller
 *  downtown core. Returns spawn-friendly open positions for props. */
export function buildDistrict(world, bounds = WORLD.BOUNDS) {
  const rng = makeRng(CITY.SEED);
  const v = (u) => Math.round(u / VOXEL.SIZE);
  buildGround(world, bounds);

  const step = CITY.BLOCK;
  const limit = bounds - CITY.BLOCK;
  for (let bx = -limit; bx <= limit; bx += step) {
    for (let bz = -limit; bz <= limit; bz += step) {
      // Keep spawn clear so Jimothy never wakes up inside a wall.
      if (Math.hypot(bx, bz) < CITY.BLOCK * 0.8) continue;
      const pad = CITY.ROAD + CITY.BUILDING_MARGIN;
      const wUnits = step - pad - rng() * 6;
      const dUnits = step - pad - rng() * 6;
      const downtown = Math.hypot(bx, bz) < CITY.DOWNTOWN_RADIUS;
      const h = Math.round(
        CITY.MIN_HEIGHT + rng() * (CITY.MAX_HEIGHT - CITY.MIN_HEIGHT) * (downtown ? 1 : 0.45),
      );
      const ox = v(bx + pad);
      const oz = v(bz + pad);
      if (downtown && rng() > 0.35) {
        buildTower(world, ox, 0, oz, v(wUnits), v(dUnits), h + 4);
      } else {
        buildCraftsman(world, ox, 0, oz, v(wUnits), v(dUnits), Math.max(5, h));
      }
    }
  }

  // Jimothy's den sits just off spawn, in the open.
  buildTrashCanDen(world, v(-10), 0, v(9), 8, 4);
  world.remeshDirty();
}
