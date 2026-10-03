import {VOXEL} from './Constants.js';

// Greedy occupied boxes preserve door/window gaps in a broken section's hull.
// Filling its entire AABB creates contacts in empty air and props a pile up.
export function rubbleBoxes(cells,center){
 const s=VOXEL.SIZE,key=(x,y,z)=>`${x},${y},${z}`,remaining=new Map();
 for(const c of cells){const p=[c.x,c.y,c.z].map(v=>Math.round(v/s-.5));remaining.set(key(...p),p);}
 const out=[];
 while(remaining.size){
  const [x,y,z]=remaining.values().next().value;let nx=1,ny=1,nz=1;
  while(remaining.has(key(x+nx,y,z)))nx++;
  while(Array.from({length:nx},(_,i)=>remaining.has(key(x+i,y,z+nz))).every(Boolean))nz++;
  while(Array.from({length:nx*nz},(_,i)=>remaining.has(key(x+i%nx,y+ny,z+Math.floor(i/nx)))).every(Boolean))ny++;
  for(let dx=0;dx<nx;dx++)for(let dy=0;dy<ny;dy++)for(let dz=0;dz<nz;dz++)remaining.delete(key(x+dx,y+dy,z+dz));
  out.push({half:[nx*s/2,ny*s/2,nz*s/2],offset:[(x+nx/2)*s-center.x,(y+ny/2)*s-center.y,(z+nz/2)*s-center.z]});
 }
 return out;
}
