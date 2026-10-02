import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {VoxelWorld} from '../src/level/VoxelWorld.js';import {VOXEL,WORK_BUDGET} from '../src/core/Constants.js';
const s=VOXEL.SIZE;
function world(slope=0){const w=new VoxelWorld(new THREE.Scene());w.terrain={surfaceHeight:(x,z)=>slope*z,topSolidVoxelY:(x,z)=>Math.ceil(slope*z/s)-1,materialAtVoxel:(x,y,z)=>y<=Math.ceil(slope*(z+.5))-1?1:0};return w;}
function drain(w){let slices=0;while(w.damageQueue.length&&slices++<10000)w.processDamage({maxSlices:1});assert.equal(w.damageQueue.length,0);return slices;}
function cut(w,x,z){const vx=Math.floor(x/s),vz=Math.floor(z/s),top=w.terrain.topSolidVoxelY((vx+.5)*s,(vz+.5)*s);let y=top;while(!w.get(vx,y,vz)&&y>top-50)y--;return(top-y)*s;}

test('swept channels cross chunk seams with continuous sloped floors and shallow banks',()=>{
 const w=world(.15);w.queueGroundChannel({x:-1,y:-1.5,z:-10},{x:-1,y:1.5,z:10},2,1.1);
 assert.equal(w.removedCount,0);w.processDamage({maxSlices:1});assert.ok(w.damageQueue.length);assert.ok(w.removedCount<=WORK_BUDGET.DAMAGE_BATCH);assert.ok(drain(w)>1);
 for(let z=-9;z<=9;z+=.44){assert.ok(cut(w,-1,z)>.8,`uncut gap at ${z}`);assert.ok(cut(w,-1,z)<=1.1+s);assert.ok(cut(w,.7,z)<cut(w,-1,z));assert.equal(cut(w,2,z),0);}
 w.queueGroundChannel({x:-1,y:0,z:10},{x:-1,y:-2.5,z:-10},2,1.1);drain(w);assert.ok(cut(w,-1,0)<=1.1+s,'repeat trips do not drill through the island');
});
test('queued travel retains every segment, persists after unloading and resets',()=>{
 const w=world();for(let z=-8;z<9;z++)assert.ok(w.queueGroundChannel({x:0,y:0,z},{x:0,y:0,z:z+1},1,1));
 assert.ok(w.damageQueue.length<=WORK_BUDGET.MAX_DAMAGE_QUEUE);drain(w);const removed=w.removedCount;
 for(let z=-8;z<9;z+=.4)assert.ok(cut(w,0,z)>.65);
 w.unloadColumn(0,0);assert.ok(cut(w,0,2)>.65);w.queueGroundChannel({x:0,y:0,z:10},{x:0,y:0,z:12},1,1);w.clear();drain(w);assert.equal(w.removedCount,0);assert.equal(w.edits.size,0);assert.ok(removed>100);
});
test('rolling above a bridge or in the air does not carve the ground below',()=>{
 const w=world();w.queueGroundChannel({x:0,y:12,z:0},{x:0,y:12,z:10},2,1);drain(w);assert.equal(w.removedCount,0);
});
test('new travel added at a yielded segment boundary is not lost',()=>{
 const w=world();w.queueGroundChannel({x:0,y:0,z:0},{x:0,y:0,z:2},1,1);
 while(w.damageQueue.length&&w.damageQueue[0].segments.length)w.processDamage({maxSlices:1});
 assert.ok(w.damageQueue.length,'last report is still yielded');
 w.queueGroundChannel({x:0,y:0,z:2},{x:0,y:0,z:8},1,1);drain(w);assert.ok(cut(w,0,7)>.65);
});
test('continuous ground work shares single-slice frames with building damage',()=>{
 const w=world();w.set(100,1,0,3);w.queueGroundChannel({x:0,y:0,z:0},{x:0,y:0,z:120},10,2);w.queueDamageSphere(22,.33,.11,2);
 for(let i=0;i<12;i++)w.processDamage({maxSlices:1});
 assert.equal(w.get(100,1,0),0,'structure work must not starve while a long channel is queued');assert.ok(w.damageQueue.length>0);
});
