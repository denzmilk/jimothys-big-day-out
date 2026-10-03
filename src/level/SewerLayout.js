import {SEWER as C,VOXEL} from '../core/Constants.js';
import * as Plan from './CityPlanner.js';
import {terrain as Terrain} from './Layout.js';
let chambers,exits;
export const floorAt=(x,z)=>(Terrain.topSolidVoxelY(x,z)-Math.round(C.DEPTH/VOXEL.SIZE))*VOXEL.SIZE;
export function rooms(){
 if(chambers)return chambers;
 chambers=[];
 for(const network of Plan.sewerNetwork())for(const e of network.entrances){
  const nodes=Plan.sewerNodesIn(e.x-C.ROOM_OFFSET,e.z-C.ROOM_OFFSET,e.x+C.ROOM_OFFSET,e.z+C.ROOM_OFFSET);
  const target=nodes.filter(n=>Math.hypot(n.x-e.x,n.z-e.z)>C.ROOM_OFFSET/2).sort((a,b)=>Math.abs(Math.hypot(a.x-e.x,a.z-e.z)-C.ROOM_OFFSET)-Math.abs(Math.hypot(b.x-e.x,b.z-e.z)-C.ROOM_OFFSET))[0]||e;
  if(chambers.some(r=>Math.hypot(r.x-target.x,r.z-target.z)<C.ROOM_OFFSET/2))continue;
  const index=chambers.length%C.ROOM_KINDS.length;
  chambers.push({id:`sewer-room-${chambers.length}`,x:target.x,z:target.z,y:floorAt(target.x,target.z),kind:C.ROOM_KINDS[index],index,radius:C.ROOM_RADIUS[index],height:C.ROOM_HEIGHT[index],exit:{...e},network:network.id});
 }
 return chambers;
}
export const roomsIn=(x0,z0,x1,z1)=>rooms().filter(r=>r.x+r.radius>=x0&&r.x-r.radius<=x1&&r.z+r.radius>=z0&&r.z-r.radius<=z1);
export function profile(x,z,near=rooms(),nodes=null){
 nodes??=Plan.sewerNodesIn(x-C.WIDTH,z-C.WIDTH,x+C.WIDTH,z+C.WIDTH);
 let d=C.WIDTH,nx=x,nz=z;
 for(const n of nodes){
  const q=Math.hypot(n.x-x,n.z-z);if(q<d){d=q;nx=n.x;nz=n.z;}
  for(const [dx,dz] of n.links){
   const t=Math.max(0,Math.min(1,((x-n.x)*dx+(z-n.z)*dz)/(dx*dx+dz*dz)));
   const px=n.x+dx*t,pz=n.z+dz*t,dist=Math.hypot(px-x,pz-z);
   if(dist<d){d=dist;nx=px;nz=pz;}
  }
 }
 if(d>=C.WIDTH&&!near.some(r=>Math.abs(x-r.x)<=r.radius+VOXEL.SIZE&&Math.abs(z-r.z)<=r.radius+VOXEL.SIZE))return {inside:false,edge:false};
 exits??=Plan.sewerNetwork().flatMap(n=>n.entrances);
 let exitDistance=Infinity;for(const e of exits)exitDistance=Math.min(exitDistance,Math.hypot(x-e.x,z-e.z));
 const narrow=Math.min(1,Math.max(0,(exitDistance-C.NARROW_NEAR_EXIT)/C.NARROW_NEAR_EXIT));
 const width=C.MAINTENANCE_WIDTH+(C.WIDTH-C.MAINTENANCE_WIDTH)*(.5+.5*Math.sin((nx+nz)/C.SECTION_LENGTH*Math.PI))*narrow,half=width/2;
 // A cross-section shares the road centre's grade. Sampling the adjoining
 // hillside made a sewer floor climb several metres sideways into its wall.
 let floor=floorAt(nx,nz),height=C.WALL_HEIGHT+C.ARCH_RISE*Math.sqrt(Math.max(0,1-(d/half)**2)),inside=d<=half,edge=d<=half+VOXEL.SIZE*C.LINING_CELLS,room=null;
 for(const r of near){
  const distance=r.kind==='maintenance'?Math.max(Math.abs(x-r.x),Math.abs(z-r.z)):Math.hypot(x-r.x,z-r.z);
  if(distance>r.radius+VOXEL.SIZE*C.LINING_CELLS)continue;
  edge=true;room=r;
  if(distance<=r.radius)inside=true;
  const blend=Math.min(1,Math.max(0,(r.radius-distance)/C.ROOM_BLEND));
  floor=VOXEL.SIZE*Math.round((floor*(1-blend)+r.y*blend)/VOXEL.SIZE);
  height=Math.max(height,r.height-C.ARCH_RISE*(Math.min(1,distance/r.radius))**2);
 }
 const basin=inside&&room?.kind==='overflow'&&Math.hypot(x-room.x,z-room.z)<room.radius*C.BASIN_SHARE;
 return {inside,edge,floor,height,d,width,room,basin,channel:inside&&!room&&exitDistance>C.NARROW_NEAR_EXIT&&d<C.GUTTER_WIDTH/2};
}

export function fixtureSites(){
 const sites=[];
 for(const r of rooms()){
  const offset=r.radius*C.ROOM_PROP_INSET;
  const kinds=r.kind==='pump'?['pump','pump','pipe-rack']:r.kind==='maintenance'?['workbench','locker','pipe-rack']:['pipe-rack','locker','pump'];
  kinds.forEach((kind,i)=>sites.push({id:`${r.id}-${i}`,kind,x:r.x+(i===2?0:(i===0?-1:1))*offset,z:r.z+(i===2?-offset:0),room:r}));
  sites.push({id:`${r.id}-lamp`,kind:'lamp',x:r.x+offset,z:r.z,room:r});
 }
 for(const n of Plan.sewerNetwork())for(const e of n.entrances)sites.push({id:`sewer-exit-${e.x}:${e.z}`,kind:'lamp',x:e.x+C.MAINTENANCE_WIDTH/3,z:e.z,exit:e});
 return sites;
}
