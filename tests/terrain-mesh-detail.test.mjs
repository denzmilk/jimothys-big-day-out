import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {VoxelWorld} from '../src/level/VoxelWorld.js';import {VOXEL} from '../src/core/Constants.js';
function ground(){const w=new VoxelWorld(new THREE.Scene()),s=VOXEL.SIZE,h=(x,z)=>2+.04*x+.003*z*z;w.terrain={surfaceHeight:h,topSolidVoxelY:(x,z)=>Math.floor(h(x,z)/s-.5),materialAtVoxel:(x,y,z)=>y<=Math.floor(h((x+.5)*s,(z+.5)*s)/s-.5)?5:0};for(let x=0;x<32;x++)for(let z=0;z<32;z++){const y=w.terrain.topSolidVoxelY((x+.5)*s,(z+.5)*s);for(let d=0;d<3;d++)w.set(x,y-d,z,5);}w.remeshDirty();return w;}
function height(w,x,z){const ray=new THREE.Raycaster(new THREE.Vector3(x,8,z),new THREE.Vector3(0,-1,0));return ray.intersectObjects([...w.chunks.values()].map(c=>c.mesh).filter(Boolean))[0]?.point.y;}
test('intact curved ground uses fewer triangles while staying within three centimetres of collision',()=>{
 const w=ground();let top=0;for(const c of w.chunks.values()){const n=c.mesh?.geometry.getAttribute('normal');if(n)for(let i=0;i<n.count;i++)if(n.getY(i)>.9)top++;}
 assert.ok(top<32*32*6/3,`too many intact ground vertices: ${top}`);
 for(let x=.3;x<6.8;x+=.37)for(let z=.3;z<6.8;z+=.43)assert.ok(Math.abs(height(w,x,z)-w.terrain.surfaceHeight(x,z))<.03);
});
test('a small crater keeps fine exposed edges instead of being covered by a coarse ground tile',()=>{
 const w=ground(),x=3.2,z=3.2,y=w.terrain.surfaceHeight(x,z);w.damageSphere(x,y-.2,z,.5);w.remeshDirty();assert.ok(height(w,x,z)<y-.35);
 for(const dx of [-.9,.9])assert.ok(Math.abs(height(w,x+dx,z)-w.terrain.surfaceHeight(x+dx,z))<.03);
});
// JIM-103: a long ground edge beside shorter ones is a T-junction; the
// rasteriser leaves pinholes along it that crawl as the camera moves.
test('coarse ground edges share every vertex with the finer ground beside them',()=>{
 const w=ground(),s=VOXEL.SIZE,x=3.2,z=3.2;w.damageSphere(x,w.terrain.surfaceHeight(x,z)-.2,z,.5);w.remeshDirty();
 const key=(a,b)=>`${Math.round(a/s)},${Math.round(b/s)}`,points=new Set(),edges=[];
 for(const c of w.chunks.values()){const p=c.mesh?.geometry.getAttribute('position'),n=c.mesh?.geometry.getAttribute('normal');if(!p)continue;
  for(let i=0;i<p.count;i+=3){if(n.getY(i)<.5)continue;
   // Level voxel faces (the crater floor) are greedy-merged on exact lattice planes; this covers the sloped surface.
   if(p.getY(i)===p.getY(i+1)&&p.getY(i)===p.getY(i+2))continue;
   for(let k=0;k<3;k++){points.add(key(p.getX(i+k),p.getZ(i+k)));edges.push([p.getX(i+k),p.getZ(i+k),p.getX(i+(k+1)%3),p.getZ(i+(k+1)%3)]);}}}
 let open=0,long=0;
 for(const [ax,az,bx,bz] of edges){const dx=Math.round((bx-ax)/s),dz=Math.round((bz-az)/s),steps=Math.abs(dx)+Math.abs(dz);
  if((dx&&dz)||steps<2)continue;long++;
  for(let i=1;i<steps;i++)if(points.has(key(ax+(bx-ax)*i/steps,az+(bz-az)*i/steps)))open++;}
 assert.ok(long>0,'fixture no longer produces coarse ground');assert.equal(open,0,`${open} ground vertices sit inside a longer neighbouring edge`);
});
