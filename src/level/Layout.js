import { VOXEL } from '../core/Constants.js';
import * as Masterplan from './CityPlanner.js';

// Layout is now an ADAPTER over the authored masterplan (milestone 16), not a
// generator.
//
// It used to invent the city from modulo arithmetic — `vx mod BLOCK < ROAD` —
// which meant every road was straight, every block identical and every junction
// a crossroads, forever. Milestone 15 added archetypes and districts on top of
// that and it still read as a grid, because the grid was never in the data. It
// was here.
//
// Everything below answers from `Masterplan`'s baked class grid, so the shape
// of the city lives in `masterplan.json` where it can be designed, and this
// file only converts between world units, voxels and the shapes the voxelizer
// and the prop streamer want.
//
// The public API is deliberately unchanged, so streaming, the minimap and the
// chunk voxelizer did not have to care that the city underneath them was
// replaced.

// Height ranges in VOXELS per archetype. Kept here rather than in the plan:
// the plan says WHAT belongs somewhere, this says how tall that thing is.
const HEIGHTS = {
  craftsman: [5, 9],
  shed: [3, 4],
  apartment: [10, 16],
  shop: [4, 6],
  warehouse: [5, 8],
  tower: [18, 26],
};

const v = (world) => Math.round(world / VOXEL.SIZE);

export function roadAtWorld(x, z) {
  return Masterplan.isRoad(x, z);
}

export function roadAtVoxel(vx, vz) {
  return Masterplan.isRoad(vx * VOXEL.SIZE, vz * VOXEL.SIZE);
}

export function isAlleyAtWorld(x, z) {
  return Masterplan.isAlley(x, z);
}

export function districtAtWorld(x, z) {
  return Masterplan.districtAtWorld(x, z);
}

export function isInsideBounds(x, z) {
  return Math.abs(x) <= Masterplan.BOUNDS && Math.abs(z) <= Masterplan.BOUNDS;
}

/** Convert a masterplan building into the voxel-space shape the city builders
 *  take. Deterministic: the height comes from the building's own stored roll,
 *  never from a fresh random draw, so a chunk built twice is identical. */
function toVoxelBuilding(b) {
  const range = HEIGHTS[b.type] || HEIGHTS.craftsman;
  return {
    type: b.type,
    district: b.district,
    blockId: b.blockId,
    vx: v(b.x),
    vz: v(b.z),
    vw: Math.max(4, v(b.w)),
    vd: Math.max(4, v(b.d)),
    vh: range[0] + Math.floor(b.heightRoll * (range[1] - range[0] + 1)),
    x: b.x,
    z: b.z,
    w: b.w,
    d: b.d,
  };
}

/** Every building whose footprint INTERSECTS the world box — by intersection,
 *  never by origin, because a footprint straddling a chunk seam belongs to
 *  every column it touches (milestone 12). */
export function buildingsIntersecting(minX, minZ, maxX, maxZ) {
  return Masterplan.buildingsIn(minX, minZ, maxX, maxZ).map(toVoxelBuilding);
}

/** Containers, placed for a REASON rather than at a hash-chosen coordinate.
 *
 *  Bins go in alleys — which is both what a city does and where a raccoon
 *  actually belongs — and otherwise on the kerb outside commercial frontages.
 *  Previously they were spaced along a lattice with no relationship to
 *  anything, which is the "nonsensical" Chris named in playtest. */
export function propsIn(minX, minZ, maxX, maxZ) {
  const out = [];
  const STEP = 7; // metres between candidate points
  const x0 = Math.floor(minX / STEP) * STEP;
  const z0 = Math.floor(minZ / STEP) * STEP;
  for (let x = x0; x <= maxX; x += STEP) {
    for (let z = z0; z <= maxZ; z += STEP) {
      if (!isInsideBounds(x, z)) continue;
      // Hash the PLACE, so a bin's existence and kind are a property of where
      // it is and identical however the player arrives at it.
      const h = hashCell(x, z);
      let keep = false;
      if (Masterplan.isAlley(x, z)) {
        // Alleys are where the bins live — densely. Both what a city does and
        // where a raccoon belongs.
        keep = (h & 3) !== 0;
      } else if (Masterplan.classAt(x, z) === Masterplan.CLASS.LAND) {
        // Otherwise: on the kerb of a buildable lot that actually fronts a
        // road, sparsely. Residential districts have no alleys, and a street
        // of houses with no bins at all is its own kind of nonsensical.
        keep = (h & 7) === 0 && nearRoad(x, z);
      }
      if (!keep) continue;
      out.push({
        id: `p${Math.round(x)},${Math.round(z)}`,
        x: +x.toFixed(2),
        z: +z.toFixed(2),
        kind: h % 4,
      });
    }
  }
  return out;
}

/** Is there a road within a couple of metres? Kerbside means beside the road,
 *  not in it — 586 of 586 bins once shipped in the carriageway. */
function nearRoad(x, z) {
  for (const [dx, dz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]]) {
    if (Masterplan.isRoad(x + dx, z + dz)) return true;
  }
  return false;
}

function hashCell(x, z) {
  let h = (Math.imul(Math.round(x), 374761393) ^ Math.imul(Math.round(z), 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export { Masterplan };
