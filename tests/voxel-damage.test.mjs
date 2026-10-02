import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {VoxelWorld} from '../src/level/VoxelWorld.js';import {VOXEL,WORK_BUDGET} from '../src/core/Constants.js';
function town(){const w=new VoxelWorld(new THREE.Scene());w.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(x,y,z)=>y<0?1:0};for(let x=0;x<48;x++)for(let z=0;z<48;z++){w.set(x,-1,z,1);if(x%12===0||z%12===0)for(let y=0;y<20;y++)w.set(x,y,z,3);}return w;}
function drain(w){let n=0;while(w.damageQueue.length&&n++<10000)w.processDamage({maxSlices:16});assert.equal(w.damageQueue.length,0);}
test('a large surface impact is bounded and removes the same cells as exact sphere damage',()=>{
 const w=town();
 w.queueDamageSphere(5,3,5,5,{digsTerrain:false});assert.equal(w.removedCount,0);w.processDamage({maxSlices:1});assert.ok(w.damageQueue.length>0,'the large sphere yields across updates');drain(w);
 let expectedRemoved=0;for(let x=0;x<48;x++)for(let z=0;z<48;z++)for(let y=-1;y<20;y++){
  const original=y<0?1:(x%12===0||z%12===0)?3:0,hit=y>=0&&Math.hypot((x+.5)*VOXEL.SIZE-5,(y+.5)*VOXEL.SIZE-3,(z+.5)*VOXEL.SIZE-5)<=5;
  if(original&&hit)expectedRemoved++;assert.equal(w.get(x,y,z),hit?0:original);
 }assert.equal(w.removedCount,expectedRemoved);
 assert.equal(w.get(20,-1,20),1,'ordinary contact must spare the road');
});
test('queued digging exposes solid crater walls and resets without late damage',()=>{
 const w=town();w.queueDamageSphere(2,-1,2,1.5,{digsTerrain:true});drain(w);assert.equal(w.get(...w.worldToVoxel(2,-1,2)),0);assert.ok(w.removedCount>0);
 const edges=[...w.chunks.values()].some(c=>c.data.includes(1));assert.ok(edges);w.queueDamageSphere(6,2,6,4);w.clear();w.processDamage({maxSlices:10000});assert.equal(w.removedCount,0);assert.equal(w.chunks.size,0);
});
test('sustained contacts keep a bounded pending queue and finish the newest contact',()=>{
 const w=town();for(let i=0;i<100;i++)w.queueDamageSphere(3+i*.04,3,5,4,{digsTerrain:false,key:'roll'});
 assert.ok(w.damageQueue.length<=WORK_BUDGET.MAX_DAMAGE_QUEUE);drain(w);assert.ok(w.removedCount>0);assert.equal(w.get(36,10,24),0);
});
