import {OCEAN as C,VOXEL,WORLD} from '../core/Constants.js';
import * as Terrain from './Terrain.js';
export function oceanHash(x,z=0){let h=(Math.imul(x,374761393)^Math.imul(z,668265263))>>>0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
let sites;
export function oceanSites(){
 if(sites)return sites;sites=[];const bound=WORLD.BOUNDS-C.EDGE_MARGIN;
 for(let iz=Math.ceil(-bound/C.SITE_STEP);iz<=Math.floor(bound/C.SITE_STEP);iz++)for(let ix=Math.ceil(-bound/C.SITE_STEP);ix<=Math.floor(bound/C.SITE_STEP);ix++){
  const x=ix*C.SITE_STEP+(oceanHash(ix,iz)-.5)*C.SITE_JITTER,z=iz*C.SITE_STEP+(oceanHash(iz,ix+7)-.5)*C.SITE_JITTER,y=Terrain.surfaceHeight(x,z);
  if(y>=-C.SITE_DEPTH||Math.abs(x)>bound||Math.abs(z)>bound||sites.some(s=>Math.hypot(s.x-x,s.z-z)<C.SITE_GAP))continue;
  const slope=Math.max(...[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>Math.abs(Terrain.surfaceHeight(x+dx*C.SITE_RADIUS,z+dz*C.SITE_RADIUS)-y)/C.SITE_RADIUS));if(slope>C.SITE_SLOPE)continue;
  const n=sites.length,slot=n%(C.WRECKS.length+C.RUINS.length),kind=slot<C.WRECKS.length?'wreck':'ruin',family=kind==='wreck'?C.WRECKS[slot]:C.RUINS[slot-C.WRECKS.length],seed=Math.floor(oceanHash(ix+71,iz-34)*0x7fffffff);
  const tilt=(oceanHash(ix,iz+33)-.5)*C.TILT;
  sites.push({id:`ocean-${ix}-${iz}`,kind,family,x,y,z,seed,yaw:oceanHash(ix+13,iz)*Math.PI*2,burial:C.BURIAL_MIN+oceanHash(iz+31,ix)*C.BURIAL_RANGE,tilt:kind==='wreck'?tilt+Math.sign(tilt||1)*C.WRECK_TILT_MIN:tilt,signature:`${family}:${seed}`});
 }
 return sites;
}

/** Reusable authored layouts, with stable missing stones and burial per site.
 * These same descriptors are exported to Blender for editable review files. */
export function ruinPieces(site){
 const pieces=C.RUIN_LAYOUTS[site.family];
 return pieces.filter((p,i)=>oceanHash(site.seed,i)>C.RUIN_MISSING).slice(0,C.MAX_RUIN_PIECES).map((p,i)=>({...p,index:i,material:C.STONE_MATERIALS[Math.floor(oceanHash(site.seed+31,i)*C.STONE_MATERIALS.length)]}));
}
let columnIndex;
function ruinIndex(){
 if(columnIndex)return columnIndex;columnIndex=new Map();const size=VOXEL.SIZE*VOXEL.CHUNK_XZ;
 for(const site of oceanSites().filter(s=>s.kind==='ruin')){
  for(let x=Math.floor((site.x-C.SITE_RADIUS)/size);x<=Math.floor((site.x+C.SITE_RADIUS)/size);x++)for(let z=Math.floor((site.z-C.SITE_RADIUS)/size);z<=Math.floor((site.z+C.SITE_RADIUS)/size);z++){
   const key=`${x},${z}`;if(!columnIndex.has(key))columnIndex.set(key,[]);columnIndex.get(key).push(site);
  }
 }
 return columnIndex;
}
export function* generateOceanColumn(world,cx,cz){
 const s=VOXEL.SIZE,CX=VOXEL.CHUNK_XZ,minX=cx*CX,maxX=(cx+1)*CX-1,minZ=cz*CX,maxZ=(cz+1)*CX-1;
 for(const site of ruinIndex().get(`${cx},${cz}`)||[]){
  const sy=Math.sin(site.yaw),cy=Math.cos(site.yaw);
  for(const p of ruinPieces(site)){
   const wx=site.x+p.x*cy+p.z*sy,wz=site.z-p.x*sy+p.z*cy,wy=site.y-site.burial+p.y,r=Math.hypot(p.sx,p.sy,p.sz)/2;
   const yaw=site.yaw+(p.yaw||0),a=Math.cos(yaw),b=Math.sin(yaw),c=Math.cos(p.roll),d=Math.sin(p.roll);
   for(let x=Math.max(minX,Math.floor((wx-r)/s));x<=Math.min(maxX,Math.ceil((wx+r)/s));x++){
    yield;
    for(let z=Math.max(minZ,Math.floor((wz-r)/s));z<=Math.min(maxZ,Math.ceil((wz+r)/s));z++)for(let y=Math.floor((wy-r)/s);y<=Math.ceil((wy+r)/s);y++){
     const dx=(x+.5)*s-wx,dz=(z+.5)*s-wz,dy=(y+.5)*s-wy,lx=dx*a-dz*b,lz=dx*b+dz*a,xx=lx*c+dy*d,yy=-lx*d+dy*c;
     if(Math.abs(yy)>p.sy/2||Math.abs(xx)>p.sx/2||Math.abs(lz)>p.sz/2)continue;
     if(p.shape==='column'&&(xx/(p.sx/2))**2+(lz/(p.sz/2))**2>1)continue;
     if(y>=world.terrain.topSolidVoxelY((x+.5)*s,(z+.5)*s))world.set(x,y,z,p.material);
    }
   }
  }
 }
}
