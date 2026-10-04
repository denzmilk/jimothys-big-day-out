import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {VoxelWorld} from '../src/level/VoxelWorld.js';import {VOXEL} from '../src/core/Constants.js';
const s=VOXEL.SIZE;
function terrace({roof=false,structure=false,flat=false}={}){
 const w=new VoxelWorld(new THREE.Scene()),top=30;
 w.terrain={surfaceHeight:()=> (top+.5)*s,topSolidVoxelY:()=>top,materialAtVoxel:(x,y,z)=>y<=top?8:0};
 for(let cx=-1;cx<=1;cx++)for(let cz=-1;cz<=1;cz++)w.generated.add(`${cx},${cz}`);
 for(let x=-5;x<=38;x++)for(let z=-5;z<=12;z++){
  const floor=flat?15:15+Math.floor(x/3)+Math.floor(z/4);
  for(let y=floor-2;y<=top;y++)w.set(x,y,z,y<=floor?(structure?3:8):VOXEL.EMPTY);
  for(let y=floor+1;y<=top;y++)w.setEdit(x,y,z,0);
  if(roof)w.setEdit(x,top,z,3);
 }
 w.remeshDirty();return w;
}
function rendered(w,x,z,from=15){const ray=new THREE.Raycaster(new THREE.Vector3(x,from,z),new THREE.Vector3(0,-1,0));return ray.intersectObjects([...w.chunks.values()].map(c=>c.mesh).filter(Boolean))[0]?.point.y;}
test('excavated shallow terraces have continuous rendered and physical slopes across chunk edges',()=>{
 const w=terrace();let maxJump=0,maxError=0,last=null;
 for(let x=.45;x<7.8;x+=.015){const z=.57,h=w.groundHeightAt(x,z,6.2),visible=rendered(w,x,z);maxError=Math.max(maxError,Math.abs(h-visible));if(last!==null)maxJump=Math.max(maxJump,Math.abs(h-last));last=h;}
 assert.ok(maxJump<.04,`dug slope jumps ${maxJump.toFixed(3)} m`);assert.ok(maxError<.001,`render/contact mismatch ${maxError}`);w.clear();
});
test('dug floor occupancy follows its rendered slope while ceilings and structural treads remain rigid',()=>{
 const w=terrace({roof:true});let wrong=0;
 for(let x=.45;x<6;x+=.067){const z=.57,h=rendered(w,x,z,6.2);if(w.solidAtWorld(x,h+.015,z)||!w.solidAtWorld(x,h-.015,z))wrong++;assert.equal(w.solidAtWorld(x,(30.5)*s,z),true);}
 assert.equal(wrong,0,'invisible voxel lips above excavated ground');w.clear();
 const stairs=terrace({structure:true});const a=stairs.groundHeightAt(2.99*s,.57,6.2),b=stairs.groundHeightAt(3.01*s,.57,6.2);assert.ok(Math.abs(b-a-s)<.001);stairs.clear();
});
test('surface caches stay bounded and clear on restart',()=>{
 const w=terrace();for(let y=40;y<10040;y++){w.dugSurface.patch(2,y,2);w.dugSurface.corner(2,y,2);}
 assert.ok(w.dugSurface.patches.size<=8192);assert.ok(w.dugSurface.corners.size<=8192);
 w.clear();assert.equal(w.dugSurface.patches.size,0);assert.equal(w.dugSurface.corners.size,0);
});
test('excavated floor heights and mesh survive an unload and replay',()=>{
 const w=terrace(),points=[.65,.67,2.63,2.65,6.99,7.05].map(x=>({x,z:.57}));
 const before=points.map(p=>w.groundHeightAt(p.x,p.z,6.2));
 w.generator=function*(world,cx,cz){for(let x=cx*32;x<(cx+1)*32;x++)for(let z=cz*32;z<(cz+1)*32;z++)for(let y=28;y<=30;y++)world.set(x,y,z,8);};
 w.unloadColumn(0,0);w.ensureColumn(0,0);w.remeshDirty();
 for(const [i,p]of points.entries()){assert.ok(Math.abs(w.groundHeightAt(p.x,p.z,6.2)-before[i])<.001);assert.ok(Math.abs(rendered(w,p.x,p.z)-before[i])<.001);}
 w.clear();
});
test('flat excavated ground retains merged geometry instead of one quad per voxel',()=>{
 const w=terrace({flat:true});let vertices=0;
 for(const c of w.chunks.values()){const normals=c.mesh?.geometry.attributes.normal;if(normals)for(let i=0;i<normals.count;i++)if(normals.getY(i)>.99)vertices++;}
 assert.ok(vertices<44*18*6/3,`flat crater has ${vertices} upward vertices`);w.clear();
});
test('damage at a column corner remeshes the shared floor in the diagonal neighbour',()=>{
 const w=new VoxelWorld(new THREE.Scene());w.terrain={surfaceHeight:()=>30.5*s,topSolidVoxelY:()=>30,materialAtVoxel:(x,y,z)=>y<=30?8:0};
 for(let x=26;x<=38;x++)for(let z=26;z<=38;z++){
  for(let y=13;y<=15;y++)w.set(x,y,z,8);for(let y=16;y<=30;y++)w.setEdit(x,y,z,0);
 }
 w.remeshDirty();const x=32*s+.001,z=32*s+.001,before=rendered(w,x,z);
 w.setEdit(31,15,31,0);w.remeshDirty();const after=rendered(w,x,z);
 assert.ok(after<before-.04,'the diagonal patch stayed at its old height');assert.ok(Math.abs(after-w.groundHeightAt(x,z,4))<.001);w.clear();
});
