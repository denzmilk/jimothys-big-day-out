import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {StructuralSupport} from '../src/level/StructuralSupport.js';import {PhysicsSystem} from '../src/systems/PhysicsSystem.js';import {eventBus} from '../src/core/EventBus.js';import {VOXEL} from '../src/core/Constants.js';
test('broken wall colliders preserve an opening instead of filling its bounding box',()=>{
 eventBus.listeners.clear();const physics=new PhysicsSystem(),s=VOXEL.SIZE,structure=new StructuralSupport(new THREE.Scene(),{position:new THREE.Vector3()},{terrainHeightAt:()=>0});const cells=[];
 for(let x=0;x<6;x++)for(let y=0;y<6;y++)if(x===0||y===0)cells.push({x:(x+.5)*s,y:(y+.5)*s+5,z:s*.5,mat:3});
 structure.spawn(cells);const piece=structure.fragments[0],body=physics.props.get(piece.id).body;
 const volume=body.shapes.reduce((n,b)=>n+b.volume(),0);assert.ok(Math.abs(volume-cells.length*s**3)<1e-6,{volume,cells:cells.length});
 assert.ok(body.shapes.length>1);structure.reset();assert.equal(physics.props.size,0);
});

test('support waits for every footprint column rather than just two corners',()=>{
 eventBus.listeners.clear();let ready=false,queued=0;const span=VOXEL.SIZE*VOXEL.CHUNK_XZ,voxels={damageQueue:[],isLoadedAtWorld:x=>ready||x<span||x>=span*2,queueSupport:()=>{queued++;return true;}};
 const structure=new StructuralSupport(new THREE.Scene(),{position:new THREE.Vector3()},voxels);structure.pending.set('fixture',{min:[0,0,0],max:[span*3-.1,2,span-.1]});
 structure.update(1/60);assert.equal(queued,0);ready=true;structure.update(1/60);assert.equal(queued,1);structure.reset();
});
