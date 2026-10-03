import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {PhysicsSystem} from '../src/systems/PhysicsSystem.js';import {VoxelWorld} from '../src/level/VoxelWorld.js';import {eventBus,Events} from '../src/core/EventBus.js';
function fixture(){eventBus.listeners.clear();const p=new PhysicsSystem(),v=new VoxelWorld(new THREE.Scene());v.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(_x,y)=>y<0?1:0};p.attachWorld(v);return {p,v};}
function piece(id,position,half,extras={}){const mesh=new THREE.Object3D();mesh.position.set(...position);eventBus.emit(Events.PROP_CREATE,{id,mesh,half,mass:20,loose:true,...extras});return mesh;}
test('walkers see the actual top of rubble; suspended and removed pieces leave no ghost floor',()=>{
 const {p,v}=fixture();piece('step',[0,.22,0],[.6,.22,.6]);p.update(1/60);
 assert.ok(v.physicalGroundHeightAt(0,0,.5,0)>.4);
 assert.equal(v.physicalSolidAtWorld(0,.2,0),true);
 assert.equal(v.physicalSolidAtWorld(2,.2,0),false);
 eventBus.emit(Events.PROP_SUSPEND,{id:'step'});assert.equal(v.physicalGroundHeightAt(0,0,.5,0),0);
 eventBus.emit(Events.PROP_RELEASE,{id:'step',position:new THREE.Vector3(0,.22,0)});p.update(1/60);assert.ok(v.physicalGroundHeightAt(0,0,.5,0)>.4);
 eventBus.emit(Events.PROP_REMOVE,{id:'step'});assert.equal(v.physicalGroundHeightAt(0,0,.5,0),0);
});
test('a tall piece cannot ratchet a walker through its top',()=>{
 const {p,v}=fixture();piece('wall',[0,2,0],[.4,2,.4]);p.update(1/60);
 assert.equal(v.physicalGroundHeightAt(0,0,.2,.2),0);
 assert.equal(v.physicalSolidAtWorld(0,1,0),true);
});
test('rubble stacks and sleeps, then falls when the lower piece disappears',()=>{
 const {p}=fixture();piece('lower',[0,.4,0],[.8,.4,.8]);piece('upper',[0,1.2,0],[.3,.4,.3]);
 for(let i=0;i<360;i++)p.update(1/60);
 const b=p.props.get('upper').body;assert.ok(b.position.y>1.1);assert.equal(b.sleepState,2);
 eventBus.emit(Events.PROP_REMOVE,{id:'lower'});for(let i=0;i<120;i++)p.update(1/60);assert.ok(b.position.y<.6);
});
