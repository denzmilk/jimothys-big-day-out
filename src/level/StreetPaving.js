import {PAVING as C,VOXEL} from '../core/Constants.js';
import * as City from './CityPlanner.js';
import * as Terrain from './Terrain.js';

const profiles=new Map();
const clamp=t=>Math.max(0,Math.min(1,t));
const mod=(n,d)=>((n%d)+d)%d;
const width=(region,index)=>index%region.arterialEvery===0?region.streetFrame.widths.arterial.width:region.streetFrame.widths.street.width;
function interval(region,value,size){
  const index=Math.floor(value/size),w=width(region,index),next=width(region,index+1),off=value-index*size;
  const nearest=off<=w||(off-w)<size-off?index:index+1;
  return {index,nearest,centre:nearest*size+width(region,nearest)/2,
    lo:index*size+w+C.WIDTH,hi:(index+1)*size-C.WIDTH,
    start:index*size+w/2,end:(index+1)*size+next/2,distance:Math.min(Math.max(0,off-w),size-off)};
}

// Linear runs join level junctions. Each run has a single cross-section,
// rather than letting the hillside bank the road and pavement independently.
function profile(x,z){
  const region=City.regionAtWorld(x,z);if(!region)return null;
  const f=region.streetFrame,u=x*f.cos+z*f.sin-f.originU,v=-x*f.sin+z*f.cos-f.originV;
  const a=interval(region,u,region.block[0]),b=interval(region,v,region.block[1]);
  const axis=a.distance<=b.distance?0:1,across=axis===0?a:b,along=axis===0?b:a;
  const key=`${region._index}:${axis}:${across.nearest}:${along.index}`;
  if(!profiles.has(key)){
    const toWorld=(u,v)=>[(u+f.originU)*f.cos-(v+f.originV)*f.sin,(u+f.originU)*f.sin+(v+f.originV)*f.cos];
    const start=axis===0?toWorld(across.centre,along.start):toWorld(along.start,across.centre);
    const end=axis===0?toWorld(across.centre,along.end):toWorld(along.end,across.centre);
    const count=Math.ceil((along.hi-along.lo)/C.GRADE_RUN),heights=[];
    for(let i=0;i<=count;i++) {
      const t=along.lo+(along.hi-along.lo)*i/count;
      const point=axis===0?toWorld(across.centre,t):toWorld(t,across.centre);
      heights.push(Terrain.surfaceHeight(...(i===0?start:i===count?end:point)));
    }
    profiles.set(key,{f,axis,lo:along.lo,hi:along.hi,heights,normal:axis===0?[f.cos,f.sin]:[-f.sin,f.cos]});
  }
  return profiles.get(key);
}
function grade(p,x,z){
  if(!p)return Terrain.surfaceHeight(x,z);
  const t=p.axis===0?-x*p.f.sin+z*p.f.cos-p.f.originV:x*p.f.cos+z*p.f.sin-p.f.originU;
  const along=clamp((t-p.lo)/(p.hi-p.lo))*(p.heights.length-1),i=Math.min(p.heights.length-2,Math.floor(along));
  const engineered=p.heights[i]+(p.heights[i+1]-p.heights[i])*(along-i);
  const blend=clamp(City.regionInteriorAtWorld(x,z)/C.SEAM_BLEND);
  if(blend===1)return engineered;
  const raw=Terrain.surfaceHeight(x,z);return raw+(engineered-raw)*blend*blend*(3-2*blend);
}
// Earthworks meet the back of the pavement, then taper into the plot.
// Without this shoulder, a graded road can cut a metre-high cliff at a front door.
export function landHeight(x,z,base=Terrain.surfaceHeight(x,z)){
  const region=City.regionAtWorld(x,z);if(!region||City.classAt(x,z)===City.CLASS.WATER)return base;
  const f=region.streetFrame,u=x*f.cos+z*f.sin-f.originU,v=-x*f.sin+z*f.cos-f.originV;
  const distance=Math.min(interval(region,u,region.block[0]).distance,interval(region,v,region.block[1]).distance);
  const weight=clamp(1-(distance-C.LAND_EDGE)/C.LAND_BLEND);
  if(!weight)return base;
  return base+(grade(profile(x,z),x,z)+C.HEIGHT-base)*weight;
}
export function isFootpath(x,z){return City.classAt(x,z)===City.CLASS.FOOTPATH;}
export function isPaved(x,z){const c=City.classAt(x,z);return c===City.CLASS.ROAD||c===City.CLASS.FOOTPATH;}
export function jointDepth(x,z){
  const span=C.SLAB_CELLS*VOXEL.SIZE,dx=mod(x,span),dz=mod(z,span);
  return C.JOINT_DEPTH*clamp(1-Math.min(dx,span-dx,dz,span-dz)/C.JOINT_HALF);
}
export function heightAt(x,z,referenceX=x,referenceZ=z){
  const road=grade(profile(referenceX,referenceZ),x,z);
  return road+(isFootpath(referenceX,referenceZ)?C.HEIGHT-jointDepth(x,z):0);
}
export function materialAt(x,z){
  if(!isFootpath(x,z))return null;
  for(const [dx,dz] of [[C.KERB_WIDTH,0],[-C.KERB_WIDTH,0],[0,C.KERB_WIDTH],[0,-C.KERB_WIDTH]])if(City.classAt(x+dx,z+dz)===City.CLASS.ROAD)return C.KERB_MATERIAL;
  const span=C.SLAB_CELLS*VOXEL.SIZE;
  return mod(Math.floor(x/span)+Math.floor(z/span),2)?C.SLAB_VARIANT:C.SLAB_MATERIAL;
}
export function at(x,z){
  if(!isPaved(x,z))return null;
  const p=profile(x,z),roadHeight=grade(p,x,z);
  return {kind:isFootpath(x,z)?'footpath':'road',height:heightAt(x,z),roadHeight,normal:p?.normal||[1,0],material:materialAt(x,z)};
}
