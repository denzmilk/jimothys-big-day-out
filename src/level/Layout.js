import { VOXEL, CONTAINERS } from '../core/Constants.js';
import * as Masterplan from './CityPlanner.js';
import * as TerrainField from './Terrain.js';

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

// Voxel-space material ids that the terrain hands back. CLAPBOARD..CONCRETE are
// VoxelCity's; these are the surface classes the ground wears.
const CONCRETE = 6;
const MOSS = 5;
const BRICK = 3;

/** The terrain, as VoxelWorld wants it (milestone 17).
 *
 *  `Terrain` answers "how deep is the rock here"; the masterplan answers "is
 *  this a road". Joining them is Layout's job, exactly as joining the plan to
 *  the voxelizer already was — which is what keeps `Terrain` free of any
 *  knowledge of streets (so `CityPlanner` can ask it where the water is without
 *  a cycle) and keeps `VoxelWorld` a pure voxel engine.
 */
export const terrain = {
  surfaceHeight: (x, z) => TerrainField.surfaceHeight(x, z),
  topSolidVoxelY: (x, z) => TerrainField.topSolidVoxelY(x, z),

  /** Implicit ground. 0 is air; anything else is solid, whether or not a single
   *  voxel of it has ever been stored. */
  materialAtVoxel(vx, vy, vz) {
    const m = TerrainField.materialAtVoxel(vx, vy, vz);
    if (m !== TerrainField.TOPSOIL) return m;
    // The visible skin follows the masterplan's classes, so a park is grass, an
    // alley is scruffier than a street, and the road network you SEE is the one
    // the city was designed with. Same rule the flat world's buildGround had —
    // it just now applies to a surface that moves.
    const x = (vx + 0.5) * VOXEL.SIZE;
    const z = (vz + 0.5) * VOXEL.SIZE;
    const cls = Masterplan.classAt(x, z);
    const C = Masterplan.CLASS;
    if (cls === C.ROAD || cls === C.PLAZA) return CONCRETE;
    if (cls === C.ALLEY) return BRICK;
    return MOSS;
  },
};

// Hide spots that ended up in the sea are not hiding places, they are floating
// bushes. Filtered once against the coastline rather than authored around it,
// so the grid in Constants stays a simple density rule (milestone 12's lesson:
// a hardcoded ±220 grid is what left the pressure valve unreachable).
let _hideSpots = null;
export function hideSpots(all) {
  if (!_hideSpots) {
    _hideSpots = all.filter(([x, z]) => TerrainField.isBuildableGround(x, z));
  }
  return _hideSpots;
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
    // The floor sits at the HIGHEST ground under the footprint. Planting at the
    // lowest instead buries the uphill half — a 26 m building on Trash Panda
    // Heights spans about 9 m of drop, which is two storeys of a craftsman
    // gone. VoxelCity fills the downhill gap with a perimeter foundation.
    vy: plantVoxelY(b),
    vw: Math.max(4, v(b.w)),
    vd: Math.max(4, v(b.d)),
    vh: range[0] + Math.floor(b.heightRoll * (range[1] - range[0] + 1)),
    x: b.x,
    z: b.z,
    w: b.w,
    d: b.d,
  };
}

/** Highest terrain voxel under a footprint, sampled on a 4×4 grid.
 *
 *  Sampled rather than exhaustive on purpose: this runs for every building of
 *  every column generated, and a full footprint scan is ~2200 height lookups
 *  per building. Sixteen catches the corners and the middle of any slope a
 *  hill this size produces. */
function plantVoxelY(b) {
  let top = -Infinity;
  for (let i = 0; i <= 3; i++) {
    for (let j = 0; j <= 3; j++) {
      const y = TerrainField.topSolidVoxelY(b.x + (b.w * i) / 3, b.z + (b.d * j) / 3);
      if (y > top) top = y;
    }
  }
  return top + 1;
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
  const STEP = CONTAINERS.STEP;
  const x0 = Math.floor(minX / STEP) * STEP;
  const z0 = Math.floor(minZ / STEP) * STEP;
  for (let x = x0; x <= maxX; x += STEP) {
    for (let z = z0; z <= maxZ; z += STEP) {
      if (!isInsideBounds(x, z)) continue;
      // Hash the PLACE, so a bin's existence and kind are a property of where
      // it is and identical however the player arrives at it.
      const h = hashCell(x, z);
      const roll = (h % 1024) / 1024;
      let keep = false;
      if (Masterplan.isAlley(x, z)) {
        keep = roll < CONTAINERS.ALLEY_SHARE;
      } else if (Masterplan.classAt(x, z) === Masterplan.CLASS.LAND) {
        // On the kerb of a buildable lot that actually fronts a road. The rate
        // depends on whether this district has alleys to put them down instead
        // — a street of houses with no bins at all is its own kind of
        // nonsensical, and most of the island is streets of houses.
        const share = Masterplan.hasAlleysAt(x, z)
          ? CONTAINERS.KERB_SHARE
          : CONTAINERS.KERB_SHARE_NO_ALLEYS;
        keep = roll < share && nearRoad(x, z);
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
  const r = CONTAINERS.KERB_REACH;
  for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
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
