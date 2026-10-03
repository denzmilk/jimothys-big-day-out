import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {VoxelWorld} from '../src/level/VoxelWorld.js';
import {VOXEL} from '../src/core/Constants.js';
function meshSlices(w){let n=0;while([...w.chunks.values()].some(c=>c.dirty)&&n<10000){w.remeshDirty({maxSlices:1});n++;}return n;}
test('a sparse broken building does not spend mesh slices scanning empty voxel rows',()=>{
 const w=new VoxelWorld(new THREE.Scene());w.set(8,100,8,1);w.set(9,100,8,1);w.setEdit(9,100,8,0);
 const slices=meshSlices(w);assert.ok(slices<16,`${slices} slices for one surviving cube`);
 assert.equal(w._chunkFor(8,100,8).mesh.geometry.attributes.position.count,36);
 w.setEdit(8,100,8,0);assert.equal(meshSlices(w),1,'an empty stored chunk discards its stale mesh immediately');assert.equal(w._chunkFor(8,100,8).mesh,null);
});
test('sparse mesh rows retain terrain neighbour culling and survive replayed edits',()=>{
 const w=new VoxelWorld(new THREE.Scene());w.terrain={surfaceHeight:()=>VOXEL.SIZE,topSolidVoxelY:()=>0,materialAtVoxel:(x,y,z)=>y<=0?1:0};
 w.generator=function*(world){world.set(4,1,4,1);world.set(5,100,4,1);};w.ensureColumn(0,0);w.setEdit(5,100,4,0);
 const first=meshSlices(w);assert.ok(first<1000,`${first} slices despite only one occupied row`);
 const geometry=()=>Array.from(w._chunkFor(4,1,4).mesh.geometry.attributes.position.array);const expected=geometry();assert.equal(expected.length,30*3,'implicit earth hides the bottom face');
 w.unloadColumn(0,0);w.ensureColumn(0,0);meshSlices(w);assert.deepEqual(geometry(),expected);
});
