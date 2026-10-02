import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {VoxelWorld} from '../src/level/VoxelWorld.js';
import {VOXEL} from '../src/core/Constants.js';
const world=()=>{const w=new VoxelWorld(new THREE.Scene());for(let x=0;x<24;x++)for(let z=0;z<24;z++)w.set(x,0,z,(x+z)%2+1);return w;};
const geometry=w=>[...w.chunks.values()].filter(c=>c.mesh).flatMap(c=>Array.from(c.mesh.geometry.attributes.position.array));
const pending=w=>[...w.chunks.values()].some(c=>c.dirty);
function drain(w){let frames=0;while(pending(w)&&frames++<10000)w.remeshDirty({maxSlices:8});assert.ok(!pending(w),'mesh work eventually finishes');return frames;}
test('mesh generation yields within a chunk and preserves exact geometry',()=>{
 const reference=world();reference.remeshDirty();const staged=world();staged.remeshDirty({maxSlices:1});
 assert.ok(pending(staged),'one slice must not synchronously rebuild a whole chunk');
 assert.ok(drain(staged)>1);assert.deepEqual(geometry(staged),geometry(reference));
});
test('damage while meshing is retained in the finished surface',()=>{
 const w=world();w.remeshDirty({maxSlices:3});w.setEdit(8,0,8,0);drain(w);
 const reference=world();reference.setEdit(8,0,8,0);reference.remeshDirty();assert.deepEqual(geometry(w),geometry(reference));
 assert.equal(w.get(8,0,8),0);
});
test('clearing a run cancels pending geometry and disposes its output',()=>{
 const w=world();w.remeshDirty({maxSlices:2});w.clear();w.remeshDirty({maxSlices:5000});
 assert.equal(w.chunks.size,0);assert.equal(w.scene.children.length,0);
});
test('streamed columns yield without filtering unrelated world edits',()=>{
 const w=new VoxelWorld(new THREE.Scene());
 w.generator=function*(world,cx,cz){for(let x=0;x<24;x++){world.set(cx*VOXEL.CHUNK_XZ+x,0,cz*VOXEL.CHUNK_XZ,1);yield;}};
 w.incrementalStreaming=true;w.streamAroundPoints([[0,0,0]]);w.processGeneration({maxSlices:2});
 assert.equal(w.generated.size,0,'partly built columns are not advertised as complete');
 w.setEdit(VOXEL.CHUNK_XZ*2,0,0,3);assert.equal(w.get(VOXEL.CHUNK_XZ*2,0,0),3,'yielded generators must release their write filter');
 for(let i=0;i<50&&!w.generated.size;i++)w.processGeneration({maxSlices:1});
 assert.equal(w.generated.size,1);assert.equal(w.get(23,0,0),1);w.clear();w.processGeneration({maxSlices:100});assert.equal(w.chunks.size,0);
});
test('an edit exposes the neighbouring chunk face across a seam',()=>{
 const w=new VoxelWorld(new THREE.Scene()),x=VOXEL.CHUNK_XZ;w.set(x-1,0,0,1);w.set(x,0,0,1);w.remeshDirty();
 const left=w._chunkFor(x-1,0,0);assert.equal(left.mesh.geometry.attributes.position.count,30);
 w.setEdit(x,0,0,0);drain(w);assert.equal(left.mesh.geometry.attributes.position.count,36,'the formerly hidden seam face becomes visible');
});
test('damage stays authoritative while a column is unloaded or rebuilding',()=>{
 const w=new VoxelWorld(new THREE.Scene());w.terrain={surfaceHeight:()=>VOXEL.SIZE,topSolidVoxelY:()=>0,materialAtVoxel:(x,y,z)=>y<=0?1:0};
 w.generator=function*(world,cx,cz){world.set(0,0,0,1);yield;world.set(1,0,0,1);yield;};
 w.ensureColumn(0,0);w.setEdit(0,0,0,0);w.unloadColumn(0,0);w.incrementalStreaming=true;w.queueColumn(0,0);w.processGeneration({maxSlices:1});
 assert.equal(w.get(0,0,0),0,'regeneration must never heal a recorded hole even temporarily');
 assert.equal(w.groundHeightAt(.1,.1,VOXEL.SIZE),0,'collision sees the same hole before meshing finishes');
});
