import { VOXEL, STREAM, TERRAIN, SEWER, BUILDINGS } from '../core/Constants.js';
import {planInterior,writeInterior} from './InteriorLayout.js';
import * as Layout from './Layout.js';
import {writeLandmarks} from './LandmarkVoxels.js';

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

// All facade detail is measured in metres (JIM-45). Sparse perimeter writes
// keep finer cells affordable; iterating every empty room voxel did cubic work.
const cell = metres => Math.max(1, Math.round(metres / VOXEL.SIZE));
function* building(world, ox, oy, oz, width, depth, h, b = {}, type = 'craftsman') {
  const C = BUILDINGS, front = b.front || 0;
  const rotate = front % 2 === 1;
  const w = rotate ? depth : width, d = rotate ? width : depth;
  const put = (x,y,z,m) => {
    if (x < 0 || x >= w || z < 0 || z >= d) return;
    let px=x, pz=z;
    if(front===1){px=width-1-z;pz=x;}
    if(front===2){px=width-1-x;pz=depth-1-z;}
    if(front===3){px=z;pz=depth-1-x;}
    world.set(ox+px,oy+y,oz+pz,m);
  };
  const rect = (x0,x1,y0,y1,z0,z1,m) => {
    for(let x=x0;x<=x1;x++) for(let z=z0;z<=z1;z++) for(let y=y0;y<=y1;y++) put(x,y,z,m);
  };
  const home = type === 'craftsman' || type === 'shed';
  const style = b.style || 0;
  const wall = home ? C.PALETTE[b.palette || 0] : type==='warehouse' ? CONCRETE : BRICK;
  const roof = C.ROOFS[(b.palette || 0)%C.ROOFS.length];
  const porch = type==='craftsman' ? cell(C.PORCH_DEPTH) : 0;
  const floor = cell(C.STOREY), sill = cell(C.WINDOW_SILL), wh=cell(C.WINDOW_HEIGHT);
  const ww=cell(C.WINDOW_WIDTH), rhythm=cell(C.WINDOW_SPACING), door=cell(C.DOOR_WIDTH), dh=cell(C.DOOR_HEIGHT);
  const middle=Math.floor(w/2), left=middle-Math.floor(door/2);
  const facade = (u,y,span) => {
    const beat=((u-Math.floor(span/2))%rhythm+rhythm)%rhythm;
    const ly=y%floor;
    if(y<cell(C.FOOTING)) return BRICK;
    if(u===0 || u===span-1 || ly===floor-1) return 13;
    if(beat<ww && ly>=sill && ly<=sill+wh) return beat===0||beat===ww-1||ly===sill||ly===sill+wh ? 13 : GLASS;
    return wall;
  };
  for(let y=0;y<h;y++) {
    yield;
    for(let x=0;x<w;x++) {
      const doorway=x>=left && x<left+door && y<dh;
      if(!doorway) put(x,y,porch,facade(x,y,w));
      if((x===left-1||x===left+door)&&y<=dh || y===dh&&x>=left-1&&x<=left+door) put(x,y,porch,13);
      put(x,y,d-1,facade(x,y,w));
    }
    for(let z=porch;z<d;z++) {put(0,y,z,facade(z-porch,y,d-porch));put(w-1,y,z,facade(z-porch,y,d-porch));}
  }
  // Geometry and resident routes share the same destructible plan (ADR-0006).
  yield* writeInterior(planInterior({...b,type,vx:ox,vy:oy,vz:oz,vw:width,vd:depth,vh:h}),put);
  if(home) {
    const pitch=C.ROOF_PITCH[style];
    const hip=style===2;
    for(let x=0;x<w;x++) {yield;for(let z=porch;z<d;z++) {
      const rise=Math.min(x,w-1-x,hip?z-porch:Infinity,hip?d-1-z:Infinity)*pitch;
      const top=h+Math.floor(rise);
      put(x,top,z,roof);
      if(z===porch||z===d-1) for(let y=h;y<top;y++) put(x,y,z,wall);
      if(x===0||x===w-1||z===porch||z===d-1) put(x,top,z,13);
    }
    }
    if(type==='craftsman') {
      const pw=Math.min(w-cell(C.TRIM)*2,cell(C.PORCH_WIDTH)), pl=middle-Math.floor(pw/2), ph=cell(C.PORCH_HEIGHT);
      rect(pl,pl+pw,0,0,0,porch,17);
      for(const x of [pl,pl+pw]) rect(x,x,1,ph,0,0,13);
      for(let z=0;z<porch;z++) rect(pl,pl+pw,ph+Math.floor(z*C.ROOF_PITCH[0]),ph+Math.floor(z*C.ROOF_PITCH[0]),z,z,roof);
      const cw=cell(C.CHIMNEY_WIDTH), cx=Math.floor(w*0.7), cz=Math.floor(d*0.72);
      const rh=h+Math.floor(Math.min(cx,w-1-cx)*pitch);
      rect(cx,Math.min(w-1,cx+cw),rh,rh+cell(C.CHIMNEY_RISE),cz,Math.min(d-1,cz+cw),BRICK);
      // Bay windows create a third silhouette without enlarging the lot.
      if(style===1) rect(cell(C.TRIM),Math.min(pl-1,cell(C.WINDOW_WIDTH)),sill,sill+wh,Math.max(0,porch-1),porch-1,GLASS);
    }
  } else {
    rect(0,w-1,h,h,0,d-1,roof);
    for(let x=0;x<w;x++){put(x,h+1,0,13);put(x,h+1,d-1,13);}
    for(let z=0;z<d;z++){put(0,h+1,z,13);put(w-1,h+1,z,13);}
    if(type==='shop') {
      const canopy=cell(C.PORCH_HEIGHT);
      rect(1,w-2,canopy,canopy,0,Math.min(d-1,cell(C.ROOF_OVERHANG)),C.PALETTE[b.palette||0]);
    }
  }
}
export const buildCraftsman=(world,x,y,z,w=14,d=12,h=9,b)=>building(world,x,y,z,w,d,h,b,'craftsman');
export const buildShed=(world,x,y,z,w,d,h,b)=>building(world,x,y,z,w,d,h,b,'shed');
export const buildApartment=(world,x,y,z,w,d,h,b)=>building(world,x,y,z,w,d,h,b,'apartment');
export const buildTower=(world,x,y,z,w,d,h,b)=>building(world,x,y,z,w,d,h,b,'tower');
export const buildShop=(world,x,y,z,w,d,h,b)=>building(world,x,y,z,w,d,h,b,'shop');
export const buildWarehouse=(world,x,y,z,w,d,h,b)=>building(world,x,y,z,w,d,h,b,'warehouse');

/** Jimothy's house: a squashed trash can on its side, torn open at the front.
 *  Real raccoon dens are tree hollows and abandoned vehicles — a crushed
 *  "raccoon-resistant" bin is the joke (see docs/lore.md). */
export function buildTrashCanDen(world, ox, oy, oz, length = 9, radius = 4) {
  const squash = BUILDINGS.DEN_SQUASH;
  // The squashed tube rests on its lower surface. Each axial slice follows
  // the hillside; an unsquashed radius offset left the den hovering above it.
  const centreY = a => (world.terrain
    ? world.terrain.topSolidVoxelY((ox+a+.5)*VOXEL.SIZE,(oz+.5)*VOXEL.SIZE)+1
    : oy) + Math.floor(radius*squash);
  for (let a = 0; a < length; a++) {
    const cy=centreY(a);
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const dist = Math.hypot(y / (radius * squash), z / radius);
        if (dist > 1 || dist < 0.72) continue;
        if (a === 0 && z > -radius * 0.35) continue; // torn-open mouth
        const dented = a > length - 3 && y > radius * 0.3;
        world.set(ox + a, cy + y, oz + z, dented ? MOSS : CONCRETE);
      }
    }
  }
  for (const a of [2, Math.max(3, length - 3)]) {
    const cy=centreY(a);
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const dist = Math.hypot(y / (radius * squash), z / radius);
        if (dist > 1.1 || dist < 0.88) continue;
        world.set(ox + a, cy + y, oz + z, BRICK);
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
function* buildGroundColumn(world, cx, cz) {
  const C = VOXEL.CHUNK_XZ;
  const x0 = cx * C;
  const z0 = cz * C;
  for (let x = x0; x < x0 + C; x++) {
    yield;
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
function* buildFoundation(world, b) {
  for (let x = 0; x < b.vw; x++) {
    yield;
    for (let z = 0; z < b.vd; z++) {
      if (x !== 0 && x !== b.vw - 1 && z !== 0 && z !== b.vd - 1) continue;
      const top = Layout.terrain.topSolidVoxelY(
        (b.vx + x + 0.5) * VOXEL.SIZE, (b.vz + z + 0.5) * VOXEL.SIZE,
      );
      for (let y = top; y < b.vy; y++) world.set(b.vx + x, y, b.vz + z, CONCRETE);
    }
  }
}

/** The sewers, for one chunk column (milestone 18).
 *
 *  Written at GENERATION time, not as edits. Edits are the player's damage and
 *  have to survive an unload; the sewer is part of the world and re-derives
 *  itself from the plan every time the column is rebuilt — so the underground
 *  costs the same as the buildings above it, and the milestone's "memory scales
 *  with what has been dug" stays a statement about digging.
 *
 *  `VOXEL.EMPTY`, not 0, for the bore. Below the stored skin a 0 means "nothing
 *  here, ask the height field", which fills the tunnel back in with rock the
 *  instant anything looks at it. */
function* buildSewers(world, cx, cz) {
  const C = VOXEL.CHUNK_XZ;
  const s = VOXEL.SIZE;
  const halfW = SEWER.WIDTH / 2;
  for (let x = cx * C; x < cx * C + C; x++) {
    yield;
    for (let z = cz * C; z < cz * C + C; z++) {
      const wx = (x + 0.5) * s;
      const wz = (z + 0.5) * s;
      const d = Layout.Masterplan.sewerDistance(wx, wz, halfW + 1.2);
      if (d > halfW + s) continue;
      const surface = Layout.terrain.topSolidVoxelY(wx, wz);
      const floor = surface - Math.round(SEWER.DEPTH / s);
      const ceiling = floor + Math.round(SEWER.HEIGHT / s);
      if (d <= halfW) {
        // The bore, plus a floor and a ceiling that read as built rather than
        // as a hole someone left in the rock.
        world.set(x, floor - 1, z, CONCRETE);
        for (let y = floor; y <= ceiling; y++) world.set(x, y, z, VOXEL.EMPTY);
        world.set(x, ceiling + 1, z, BRICK);
      } else {
        // The lining. Without it the tunnel wall is implicit ground — solid to
        // every query and invisible to the mesher, so the sewer would render as
        // a black void with a floor.
        for (let y = floor - 1; y <= ceiling + 1; y++) world.set(x, y, z, BRICK);
      }
    }
  }
}

/** A stairwell down to the tunnel: a square shaft with a one-voxel step
 *  spiralling round its wall.
 *
 *  One-voxel steps on purpose — walking back up is then the auto-climb
 *  (CLIMB_HEIGHT 2.6) doing its ordinary job, where a ladder or a sheer shaft
 *  would need a special case in the controller. It is a way IN and a way OUT,
 *  which is what makes the reachability guarantee mean anything. */
function buildStairwell(world, e) {
  const s = VOXEL.SIZE;
  const half = Math.floor(SEWER.SHAFT / 2);
  const ox = Math.round(e.x / s) - half;
  const oz = Math.round(e.z / s) - half;
  const top = Layout.terrain.topSolidVoxelY(e.x, e.z);
  const floor = top - Math.round(SEWER.DEPTH / s);
  const N = SEWER.SHAFT;

  // Hollow the shaft from the street down to the tunnel.
  for (let x = 0; x < N; x++) {
    for (let z = 0; z < N; z++) {
      world.set(ox+x,floor-1,oz+z,CONCRETE);
      for (let y = floor; y <= top + 1; y++) world.set(ox + x, y, oz + z, VOXEL.EMPTY);
    }
  }
  // …and line it, so it reads as a shaft rather than a hole.
  for (let x = -1; x <= N; x++) {
    for (let z = -1; z <= N; z++) {
      if (x >= 0 && x < N && z >= 0 && z < N) continue;
      // The lining must open into the bore. Depending on a sloping surface
      // to expose an accidental exit seals the stairs after street grading.
      const outsideX=(ox+x+.5+(x===-1?-1:x===N?1:0))*s;
      const outsideZ=(oz+z+.5+(z===-1?-1:z===N?1:0))*s;
      const meetsTunnel=Layout.Masterplan.sewerDistance(outsideX,outsideZ,SEWER.WIDTH)<=SEWER.WIDTH/2;
      const boreFloor=Layout.terrain.topSolidVoxelY(outsideX,outsideZ)-Math.round(SEWER.DEPTH/s);
      const boreCeiling=boreFloor+Math.round(SEWER.HEIGHT/s);
      for (let y = floor - 1; y <= top; y++) {
        const portal=meetsTunnel&&y>=Math.max(floor,boreFloor)&&y<=boreCeiling;
        world.set(ox+x,y,oz+z,portal?VOXEL.EMPTY:CONCRETE);
      }
    }
  }
  // The step, one voxel per perimeter cell, spiralling down the wall.
  const ring = [];
  for (let x = 0; x < N; x++) ring.push([x, 0]);
  for (let z = 1; z < N; z++) ring.push([N - 1, z]);
  for (let x = N - 2; x >= 0; x--) ring.push([x, N - 1]);
  for (let z = N - 2; z >= 1; z--) ring.push([0, z]);
  for (let step = 0; top - step >= floor; step++) {
    const [sx, sz] = ring[step % ring.length];
    world.set(ox + sx, top - step, oz + sz, BRICK);
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
export function* generateColumn(world, cx, cz) {
  yield*buildGroundColumn(world, cx, cz);

  const C = VOXEL.CHUNK_XZ * VOXEL.SIZE;
  for (const b of Layout.buildingsIntersecting(cx * C, cz * C, (cx + 1) * C, (cz + 1) * C)) {
    const build = BUILDERS[b.type] || buildCraftsman;
    yield*buildFoundation(world, b);
    yield*build(world, b.vx, b.vy, b.vz, b.vw, b.vd, b.vh, b);
  }

  yield*writeLandmarks(world,cx,cz);

  // The underground, after the buildings: a house planted on the street above
  // must not have its foundation punched through the tunnel, and writing the
  // sewer second means the tunnel wins wherever they meet.
  yield*buildSewers(world, cx, cz);
  const pad = SEWER.SHAFT * VOXEL.SIZE + 2;
  for (const e of Layout.Masterplan.sewerNetwork()) {
    for (const entrance of e.entrances) {
      if (entrance.x < cx * C - pad || entrance.x > (cx + 1) * C + pad) continue;
      if (entrance.z < cz * C - pad || entrance.z > (cz + 1) * C + pad) continue;
      buildStairwell(world, entrance);
    }
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
  length: Math.round(4.4 / VOXEL.SIZE),
  radius: Math.round(2.2 / VOXEL.SIZE),
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
  world.incrementalStreaming=true;
}
