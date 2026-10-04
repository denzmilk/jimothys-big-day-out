import {TERRAIN as C,VOXEL} from '../core/Constants.js';

// M55: adjacent exposed floors share corner heights. The reference layer
// keeps a tunnel floor separate from its ceiling; cliffs and structure stay
// sharp rather than being bridged by a height field from another storey.
export class DamagedGround {
 constructor(world){this.world=world;this.patches=new Map();this.corners=new Map();}
 clear(){this.patches.clear();this.corners.clear();}
 nearby(x,z){
  const w=this.world,n=VOXEL.CHUNK_XZ;
  if(!w.terrain||!w.edits.size)return false;
  // Giant channels already share a continuous render/contact field. Avoid
  // a second floor search in their busiest collision path (JIM-48).
  if(w.channels?.cells&&w.channels.sample((x+.5)*VOXEL.SIZE,(z+.5)*VOXEL.SIZE))return false;
  for(let cx=Math.floor((x-1)/n);cx<=Math.floor((x+1)/n);cx++)for(let cz=Math.floor((z-1)/n);cz<=Math.floor((z+1)/n);cz++)
   if(w.editChunks.has(`${cx},${cz}`))return true;
  return false;
 }
 natural(mat){return C.DUG_SMOOTH_MATERIALS.includes(mat);}
 cap(x,reference,z){
  const w=this.world,s=VOXEL.SIZE,r=C.DUG_SMOOTH_RISE,cx=(x+.5)*s,cz=(z+.5)*s;
  if(w.channels?.sample(cx,cz))return null;
  const terrainTop=w.terrain.topSolidVoxelY(cx,cz);
  for(let y=reference+r;y>=reference-r;y--){
   if(y>terrainTop||!this.natural(w.get(x,y,z))||w.get(x,y+1,z))continue;
   for(let d=1;d<=r;d++)if(!this.natural(w.get(x,y-d,z)))return null;
   return {y,intact:y===terrainTop};
  }
  return null;
 }
 corner(x,reference,z){
  const key=`${x},${reference},${z}`;if(this.corners.has(key))return this.corners.get(key);
  if(this.corners.size>=C.DUG_SURFACE_CACHE)this.corners.clear();
  const w=this.world,s=VOXEL.SIZE,heights=[],levels=[];let damaged=false;
  if(w.terrain.cornerPosition?.(x*s,z*s))return null;
  for(let dx=-1;dx<=0;dx++)for(let dz=-1;dz<=0;dz++){
   const p=this.cap(x+dx,reference,z+dz);if(!p){this.corners.set(key,null);return null;}
   levels.push(p.y);damaged ||= !p.intact;
   heights.push(p.intact?w.terrain.surfaceHeight(x*s,z*s):(p.y+1)*s);
  }
  const min=Math.min(...levels),max=Math.max(...levels);
  const value=damaged&&max-min<=C.DUG_SMOOTH_RISE&&reference>=min&&reference<=max
   ?heights.reduce((a,b)=>a+b,0)/heights.length:null;
  this.corners.set(key,value);return value;
 }
 patch(x,y,z){
  const w=this.world,s=VOXEL.SIZE;
  if(!this.nearby(x,z))return null;
  const key=`${x},${y},${z}`;if(this.patches.has(key))return this.patches.get(key);
  if(this.patches.size>=C.DUG_SURFACE_CACHE)this.patches.clear();
  if(!this.natural(w.get(x,y,z))||w.get(x,y+1,z)){this.patches.set(key,null);return null;}
  const own=this.cap(x,y,z);if(!own||own.y!==y)return null;
  let changed=false;
  const heights=[];
  for(let dz=0;dz<=1;dz++)for(let dx=0;dx<=1;dx++){
   const value=this.corner(x+dx,y,z+dz);changed ||= value!==null;
   heights.push(value??(own.intact?w.terrain.surfaceHeight((x+dx)*s,(z+dz)*s):(y+1)*s));
  }
  const patch=changed?heights:null;
  this.patches.set(key,patch);return patch;
 }
 height(x,z,patch){
  const s=VOXEL.SIZE,u=x/s-Math.floor(x/s),v=z/s-Math.floor(z/s),[a,b,c,d]=patch;
  return v>=u?a+(c-a)*v+(d-c)*u:a+(b-a)*u+(d-b)*v;
 }
}
