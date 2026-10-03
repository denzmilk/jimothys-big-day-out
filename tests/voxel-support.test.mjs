import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {VoxelWorld} from '../src/level/VoxelWorld.js';import {VOXEL} from '../src/core/Constants.js';
const bounds={min:[-1,-1,-1],max:[5,5,3]};
function bridge(){const w=new VoxelWorld(new THREE.Scene());w.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(_x,y)=>y<0?1:0};for(const x of [0,16])for(let y=0;y<8;y++)w.set(x,y,0,3);for(let x=0;x<=16;x++)w.set(x,8,0,3);return w;}
function check(w){assert.equal(typeof w.supportTask,'function');let n=0,out=[];for(const batch of w.supportTask(bounds)){n++;if(batch)out.push(...batch);}assert.ok(n<1000);return out;}
test('supported roof survives one lost pier, then detaches when its remaining support is removed',()=>{const w=bridge();for(let y=0;y<8;y++)w.setEdit(0,y,0,0);assert.equal(check(w).length,0);assert.equal(w.get(8,8,0),3);for(let y=0;y<8;y++)w.setEdit(16,y,0,0);assert.equal(check(w).length,17);assert.equal(w.get(8,8,0),0);});
test('excavation under a foundation releases the structure and work can yield',()=>{const w=bridge();w.channels={cells:1,sample:()=>-3};const task=w.supportTask?.(bounds);assert.ok(task);const first=task.next();assert.equal(w.get(8,8,0),3);let removed=first.value?.length||0;for(const batch of task)removed+=batch?.length||0;assert.equal(removed,33);assert.equal(w.get(8,8,0),0);});

test('ordinary excavation removes ground support even though the authored grade stays unchanged',()=>{
 const w=bridge();
 for(let x=-1;x<=17;x++)for(let z=-1;z<=1;z++)for(let y=-4;y<0;y++)w.setEdit(x,y,z,0);
 assert.equal(w.terrain.surfaceHeight(0,0),0);
 assert.equal(check(w).length,33);
 assert.equal(w.get(8,8,0),0);
});

test('separated voxels inside one coarse support cell do not share an anchor',()=>{
 const w=new VoxelWorld(new THREE.Scene());
 w.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(_x,y)=>y<0?1:0};
 for(let y=0;y<4;y++)w.set(0,y,0,3);
 w.set(2,2,0,3);
 const removed=check(w);
 assert.equal(removed.length,1);
 assert.equal(w.get(2,2,0),0);
 assert.equal(w.get(0,3,0),3);
});

test('a one-voxel horizontal cut disconnects a wall within a coarse support cell',()=>{
 const w=new VoxelWorld(new THREE.Scene());
 w.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(_x,y)=>y<0?1:0};
 for(let x=0;x<8;x++)for(let y=0;y<12;y++)w.set(x,y,0,3);
 for(let x=0;x<8;x++)w.setEdit(x,1,0,0);
 assert.equal(check(w).length,80);
 assert.equal(w.get(4,0,0),3);
 assert.equal(w.get(4,8,0),0);
});
