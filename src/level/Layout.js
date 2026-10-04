import { VOXEL, CONTAINERS, BUILDINGS, HIDE_SPOTS, PAVING, BEACH, LANDMARKS } from '../core/Constants.js';
import * as Masterplan from './CityPlanner.js';
import * as TerrainField from './Terrain.js';
import * as StreetPaving from './StreetPaving.js';
import {basinGround} from '../core/BasinField.js';

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

const v = (world) => Math.round(world / VOXEL.SIZE);

export function roadAtWorld(x, z) {
  return Masterplan.isRoad(x, z);
}
export const pavingAtWorld=StreetPaving.at;
export const isFootpathAtWorld=StreetPaving.isFootpath;
export const footpathCentreAtWorld=StreetPaving.centreAt;

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
// Terrace building plots into the hillside. The old highest-corner rule put
// every entrance above a blank multi-storey concrete plinth (JIM-45).
// A baked height override keeps terrain, collision and destruction in agreement
// without querying buildings millions of times during voxel generation.
let terraceGrid = null;
const TERRAIN_CELL = Masterplan.CELL;
const terraceSize = Math.ceil(TerrainField.BOUNDS * 2 / TERRAIN_CELL) + 1;

function terraceHeight(x, z) {
  if (!terraceGrid) {
    terraceGrid = new Float32Array(terraceSize * terraceSize); terraceGrid.fill(NaN);
    const B=TerrainField.BOUNDS, step=TERRAIN_CELL, margin=BUILDINGS.TERRACE_BLEND;
    for (const b of Masterplan.buildingsIn(-B,-B,B,B)) {
      const height=TerrainField.surfaceHeight(b.x+b.w/2,b.z+b.d/2);
      for(let iz=Math.max(0,Math.floor((b.z-margin+B)/step));iz<=Math.min(terraceSize-1,Math.ceil((b.z+b.d+margin+B)/step));iz++) {
        for(let ix=Math.max(0,Math.floor((b.x-margin+B)/step));ix<=Math.min(terraceSize-1,Math.ceil((b.x+b.w+margin+B)/step));ix++) {
          const px=ix*step-B,pz=iz*step-B;
          if(Masterplan.isRoad(px,pz)||StreetPaving.isFootpath(px,pz)) continue;
          const dist=Math.max(b.x-px,px-b.x-b.w,b.z-pz,pz-b.z-b.d,0);
          const mix=Math.max(0,1-dist/margin);
          const raw=TerrainField.surfaceHeight(px,pz);
          terraceGrid[iz*terraceSize+ix]=raw+(height-raw)*mix;
        }
      }
    }
  }
  const B=TerrainField.BOUNDS, fx=(x+B)/TERRAIN_CELL,fz=(z+B)/TERRAIN_CELL,ix=Math.floor(fx),iz=Math.floor(fz);
  if(ix<0||iz<0||ix>=terraceSize-1||iz>=terraceSize-1) return TerrainField.surfaceHeight(x,z);
  const at=(i,j)=>{const h=terraceGrid[j*terraceSize+i];return Number.isNaN(h)?TerrainField.surfaceHeight(i*TERRAIN_CELL-B,j*TERRAIN_CELL-B):h;};
  const tx=fx-ix,tz=fz-iz;
  return (at(ix,iz)*(1-tx)+at(ix+1,iz)*tx)*(1-tz)+(at(ix,iz+1)*(1-tx)+at(ix+1,iz+1)*tx)*tz;
}
let basins=null;
function waterBasins(){return basins??=(LANDMARKS.BASINS.map(b=>{const s=Masterplan.landmarks().find(s=>s.id===b.id);return {...b,x:s.vx*VOXEL.SIZE+b.offset[0],z:s.vz*VOXEL.SIZE+b.offset[1],rim:s.height};}));}
const parcelHeight=(x,z,rx,rz)=>{
 if(StreetPaving.isPaved(rx,rz))return StreetPaving.heightAt(x,z,rx,rz);
 const base=StreetPaving.landHeight(x,z,terraceHeight(x,z)),s=Masterplan.landmarkAt(rx,rz);if(!s)return base;
 const edge=Math.min(s.width/2-Math.abs(x-s.x),s.depth/2-Math.abs(z-s.z));
 const mix=Math.max(0,Math.min(1,edge/LANDMARKS.PARCEL_BLEND));return base+(s.height-base)*mix;
};
const cornerHeight=(x,z,rx,rz)=>basinGround(x,z,parcelHeight(x,z,rx,rz),waterBasins());
// JIM-86: intact contact uses the same continuous kerb as the fitted mesh.
const streetHeight=(x,z)=>cornerHeight(x,z,x,z);
const terraceTop=(x,z)=>Math.floor(streetHeight(x,z)/VOXEL.SIZE-0.5);

export const terrain = {
  waterBasins,
  shoreDistance: TerrainField.shoreDistance,
  surfaceHeight: streetHeight,
  sandAt: (x,z)=>StreetPaving.isPaved(x,z)?0:TerrainField.sandAt(x,z),
  // One-sided corners retain a real vertical kerb at a surface boundary.
  cornerHeight,
  cornerPosition: StreetPaving.cornerPosition,
  topSolidVoxelY: terraceTop,

  /** Implicit ground. 0 is air; anything else is solid, whether or not a single
   *  voxel of it has ever been stored. */
  materialAtVoxel(vx, vy, vz) {
    const wx=(vx+0.5)*VOXEL.SIZE,wz=(vz+0.5)*VOXEL.SIZE;
    const shift=terraceTop(wx,wz)-TerrainField.topSolidVoxelY(wx,wz);
    const m = TerrainField.materialAtVoxel(vx, vy-shift, vz);
    if (m !== TerrainField.TOPSOIL && m!==BEACH.DRY_MATERIAL && m!==BEACH.WET_MATERIAL) return m;
    // The visible skin follows the masterplan's classes, so a park is grass, an
    // alley is scruffier than a street, and the road network you SEE is the one
    // the city was designed with. Same rule the flat world's buildGround had —
    // it just now applies to a surface that moves.
    const x = (vx + 0.5) * VOXEL.SIZE;
    const z = (vz + 0.5) * VOXEL.SIZE;
    const cls = Masterplan.classAt(x, z);
    const C = Masterplan.CLASS;
    if (cls === C.ROAD) return PAVING.ROAD_MATERIAL;
    if (cls === C.FOOTPATH) return StreetPaving.materialAt(x,z);
    if (cls === C.PLAZA) return CONCRETE;
    if (cls === C.ALLEY) return BRICK;
    return TerrainField.sandAt(x,z)||MOSS;
  },
};

// Hide spots that ended up in the sea are not hiding places, they are floating
// bushes. Filtered once against the coastline rather than authored around it,
// so the grid in Constants stays a simple density rule (milestone 12's lesson:
// a hardcoded ±220 grid is what left the pressure valve unreachable).
let _hideSpots = null;
export function hideSpots(all) {
  if (!_hideSpots) {
    _hideSpots = all.filter(([x, z]) => {
      const r=HIDE_SPOTS.RADIUS;
      return TerrainField.isBuildableGround(x,z)&&!Masterplan.buildingsIn(x-r,z-r,x+r,z+r)
        .some(b=>x+r>b.x&&x-r<b.x+b.w&&z+r>b.z&&z-r<b.z+b.d);
    });
  }
  return _hideSpots;
}

/** Convert a masterplan building into the voxel-space shape the city builders
 *  take. Deterministic: the height comes from the building's own stored roll,
 *  never from a fresh random draw, so a chunk built twice is identical. */
function toVoxelBuilding(b) {
  const range = BUILDINGS.HEIGHTS[b.type] || BUILDINGS.HEIGHTS.craftsman;
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
    vh: v(range[0] + b.heightRoll * (range[1] - range[0])),
    style: b.style,
    palette: b.palette,
    front: b.front,
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
      const y = terraceTop(b.x + (b.w * i) / 3, b.z + (b.d * j) / 3);
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
      } else if ([Masterplan.CLASS.LAND,Masterplan.CLASS.FOOTPATH].includes(Masterplan.classAt(x,z))) {
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

export function landmarkStructuresIn(x0,z0,x1,z1){return Masterplan.landmarks().filter(s=>s.x+s.width/2>=x0&&s.x-s.width/2<=x1&&s.z+s.depth/2>=z0&&s.z-s.depth/2<=z1).map(s=>({type:'landmark',id:s.id,x:s.x-s.width/2,z:s.z-s.depth/2,w:s.width,d:s.depth,vx:s.vx,vz:s.vz,vy:s.vy+Math.floor(s.model.bounds[0][1]/VOXEL.SIZE),vw:Math.ceil(s.width/VOXEL.SIZE),vd:Math.ceil(s.depth/VOXEL.SIZE),vh:Math.ceil((s.model.bounds[1][1]-s.model.bounds[0][1])/VOXEL.SIZE)}));}
