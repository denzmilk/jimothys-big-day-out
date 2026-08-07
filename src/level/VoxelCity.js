import { VOXEL, STREAM, TERRAIN } from '../core/Constants.js';
import * as Layout from './Layout.js';

// Authored voxel content. Buildings are written as footprints + rules rather
// than baked voxel data, so the city stays diffable, seed-reproducible, and
// hand-editable — a district this size can't be placed by hand.
//
// WHERE things go is Layout's job; this file only turns a footprint into
// voxels. The split is what lets the city be generated a column at a time as
// the player walks into it, and what lets a minimap draw places that have
// never been generated (milestone 12).
//
// Material ids come from VOXEL.MATERIALS.
const CLAPBOARD = 1, SHINGLE = 2, BRICK = 3, GLASS = 4, MOSS = 5, CONCRETE = 6;

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

/** Apartment block: a plain box with banded windows and a flat roof. Reads as
 *  bulk — the thing a street of craftsmen needs next to it to stop looking
 *  like a suburb. */
export function buildApartment(world, ox, oy, oz, w, d, h) {
  const solid = (x, y, z, m) => world.set(ox + x, oy + y, oz + z, m);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        const edge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
        if (!edge && y !== h - 1) continue;
        if (y === h - 1) { solid(x, y, z, CONCRETE); continue; }
        const isDoor = z === 0 && y < 3 && Math.abs(x - (w >> 1)) <= 1;
        if (isDoor) continue;
        // Two-storey window rhythm, so height reads at a glance.
        const window = y % 4 >= 2 && x % 3 !== 0 && z % 3 !== 0;
        solid(x, y, z, y < 2 ? CONCRETE : window ? GLASS : BRICK);
      }
    }
  }
}

/** Corner shop: wide, low, flat-roofed, with a glass frontage and a parapet.
 *  The horizontal counterpoint to the apartment's verticality. */
export function buildShop(world, ox, oy, oz, w, d, h) {
  const solid = (x, y, z, m) => world.set(ox + x, oy + y, oz + z, m);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        const edge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
        if (!edge && y !== h - 1) continue;
        if (y === h - 1) { solid(x, y, z, CONCRETE); continue; }
        // Shopfront: the whole z=0 face is glass above the stall riser, with a
        // door gap Jimothy can waddle through.
        const front = z === 0;
        const isDoor = front && y < 3 && x >= w - 4 && x <= w - 3;
        if (isDoor) continue;
        const glazed = front && y >= 1 && y < h - 2;
        solid(x, y, z, glazed ? GLASS : y === h - 2 ? MOSS : CLAPBOARD);
      }
    }
  }
}

/** Warehouse: long, low, corrugated, with a roller door. Industrial mass —
 *  and the biggest single volume the roll gets to bowl through. */
export function buildWarehouse(world, ox, oy, oz, w, d, h) {
  const solid = (x, y, z, m) => world.set(ox + x, oy + y, oz + z, m);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        const edge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
        if (!edge && y !== h - 1) continue;
        if (y === h - 1) { solid(x, y, z, SHINGLE); continue; }
        // Roller door: wide and tall, so a rolling Jimothy fits.
        const isDoor = z === 0 && y < Math.max(3, h - 2) && Math.abs(x - (w >> 1)) <= 2;
        if (isDoor) continue;
        // Corrugation — alternating material every other column. Cheap, and it
        // reads as ribbed metal rather than a painted box.
        solid(x, y, z, y < 1 ? CONCRETE : x % 2 === 0 ? CONCRETE : MOSS);
      }
    }
  }
}

/** Garage / shed: a small box with a shallow pitched roof. Fills the leftover
 *  lots that would otherwise be conspicuous gaps. */
export function buildShed(world, ox, oy, oz, w, d, h) {
  const solid = (x, y, z, m) => world.set(ox + x, oy + y, oz + z, m);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        const edge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
        if (!edge) continue;
        const isDoor = z === 0 && y < 2 && Math.abs(x - (w >> 1)) <= 1;
        if (isDoor) continue;
        solid(x, y, z, CLAPBOARD);
      }
    }
  }
  // Shallow gable: two rakes and a ridge, a third the height of a craftsman's.
  const peak = Math.max(1, Math.floor(w / 4));
  for (let r = 0; r < peak; r++) {
    for (let z = 0; z < d; z++) {
      for (const x of [r, w - 1 - r]) solid(x, h + r, z, SHINGLE);
      if (r === peak - 1) for (let x = r; x <= w - 1 - r; x++) solid(x, h + r, z, SHINGLE);
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

/** The ground you can SEE, for one chunk column.
 *
 *  Only `TERRAIN.SKIN` voxels of it are real. Everything below is implicit —
 *  solid to every query, stored nowhere, and materialised only where a blast
 *  exposes it (VoxelWorld._materialiseAround). That is why `TERRAIN.DEPTH` can
 *  be 20 m or 200 m for the same boot cost and the same memory: nothing here
 *  iterates it.
 *
 *  This was a single eager pass over the entire map — roughly 910 × 910 × 2
 *  voxels at BOUNDS 250, which forced every chunk into existence before the
 *  first frame and is what JIM-01 measured at 19 s / 3.5 GB. Then it became one
 *  column of a flat plane (milestone 12). Now it follows a height field, and
 *  costs the same as it did flat. */
function buildGroundColumn(world, cx, cz) {
  const C = VOXEL.CHUNK_XZ;
  const x0 = cx * C;
  const z0 = cz * C;
  for (let x = x0; x < x0 + C; x++) {
    for (let z = z0; z < z0 + C; z++) {
      const wx = (x + 0.5) * VOXEL.SIZE;
      const wz = (z + 0.5) * VOXEL.SIZE;
      if (!Layout.isInsideBounds(wx, wz)) continue;
      // Surface material — road, alley, park, sand, strata — is the terrain's
      // answer, joined to the masterplan's classes by Layout. This file no
      // longer decides what the ground is made of, only how much of it is real.
      const top = Layout.terrain.topSolidVoxelY(wx, wz);
      for (let d = 0; d < TERRAIN.SKIN; d++) {
        const mat = Layout.terrain.materialAtVoxel(x, top - d, z);
        if (mat) world.set(x, top - d, z, mat);
      }
    }
  }
}

/** Fill the gap between a building's floor and the ground it stands on.
 *
 *  Buildings are planted at the HIGHEST point under their footprint, so no
 *  corner is ever left hanging in the air on a hillside. Downhill that leaves a
 *  gap, and only the walls can be seen through — so only the perimeter is
 *  filled. Cheap, and it reads as the retaining walls a hilly city is full of.
 */
function buildFoundation(world, b) {
  for (let x = 0; x < b.vw; x++) {
    for (let z = 0; z < b.vd; z++) {
      if (x !== 0 && x !== b.vw - 1 && z !== 0 && z !== b.vd - 1) continue;
      const top = Layout.terrain.topSolidVoxelY(
        (b.vx + x + 0.5) * VOXEL.SIZE, (b.vz + z + 0.5) * VOXEL.SIZE,
      );
      for (let y = top; y < b.vy; y++) world.set(b.vx + x, y, b.vz + z, CONCRETE);
    }
  }
}

/** Generate one chunk column: ground, every building that overlaps it, and
 *  the den if it falls inside.
 *
 *  Each builder is handed its building's FULL origin and extent and writes the
 *  whole thing; the world drops whatever lands outside the column being
 *  generated. That is what keeps the builders chunk-unaware, and it is why a
 *  house on a seam comes out whole instead of sliced — every column it touches
 *  writes its own share of the same deterministic footprint. */
export function generateColumn(world, cx, cz) {
  buildGroundColumn(world, cx, cz);

  const C = VOXEL.CHUNK_XZ * VOXEL.SIZE;
  for (const b of Layout.buildingsIntersecting(cx * C, cz * C, (cx + 1) * C, (cz + 1) * C)) {
    const build = BUILDERS[b.type] || buildCraftsman;
    buildFoundation(world, b);
    build(world, b.vx, b.vy, b.vz, b.vw, b.vd, b.vh);
  }

  // Jimothy's den sits just off spawn, in the open. Written by whichever
  // column contains it; the write filter discards it everywhere else.
  buildTrashCanDen(
    world, DEN.vx, Layout.terrain.topSolidVoxelY(DEN.x, DEN.z) + 1, DEN.vz,
    DEN.length, DEN.radius,
  );
}

// Archetype → voxelizer. Layout decides WHICH; this decides what it looks
// like. Adding a building type is adding a builder and a name in
// Layout's ARCHETYPES — never threading a new branch through generation.
const BUILDERS = {
  craftsman: buildCraftsman,
  tower: buildTower,
  apartment: buildApartment,
  shop: buildShop,
  warehouse: buildWarehouse,
  shed: buildShed,
};

const DEN = {
  x: -10,
  z: 9,
  vx: Math.round(-10 / VOXEL.SIZE),
  vz: Math.round(9 / VOXEL.SIZE),
  length: 8,
  radius: 4,
};

/** Install the streaming generator and build the columns around spawn, so the
 *  first frame has ground under Jimothy's feet.
 *
 *  Replaces the old eager `buildDistrict`, which walked the whole map before
 *  the first frame (JIM-01). Nothing outside the spawn radius is built here;
 *  the rest arrives as he walks into it. */
export function installCity(world, spawnX = 0, spawnZ = 0) {
  // The implicit ground (milestone 17). Injected rather than imported, so
  // VoxelWorld stays a voxel engine that knows nothing about islands, and so a
  // spec can hand it a flat one.
  world.terrain = Layout.terrain;
  world.generator = generateColumn;
  world.streamAround(spawnX, spawnZ);
  // Boot has no frame budget to protect, so fill the load radius immediately
  // rather than popping it in over the first few seconds.
  const C = VOXEL.CHUNK_XZ * VOXEL.SIZE;
  const px = Math.floor(spawnX / C);
  const pz = Math.floor(spawnZ / C);
  for (let dx = -STREAM.LOAD_RADIUS; dx <= STREAM.LOAD_RADIUS; dx++) {
    for (let dz = -STREAM.LOAD_RADIUS; dz <= STREAM.LOAD_RADIUS; dz++) {
      world.ensureColumn(px + dx, pz + dz);
    }
  }
  world.remeshDirty();
}
