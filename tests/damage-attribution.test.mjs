import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {VoxelWorld} from '../src/level/VoxelWorld.js';import {VOXEL} from '../src/core/Constants.js';
function world(){const w=new VoxelWorld(new THREE.Scene());w.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(_x,y)=>y<0?8:0};for(const x of [-1,0])for(const z of [-1,0])w.generated.add(`${x},${z}`);for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++){w.set(x,-1,z,8);for(let y=0;y<4;y++)w.set(x,y,z,3);}return w;}
test('queued removals retain the instigator and distinguish dirt from structures',()=>{
 const w=world();w.queueDamageSphere(0,0,0,.7,{digsTerrain:true,instigator:'player'});const reports=[];while(w.damageQueue.length)reports.push(...w.processDamage({maxSlices:100}));
 assert.ok(reports.length);assert.ok(reports.every(r=>r.job.instigator==='player'));const cells=reports.flatMap(r=>r.cells);assert.ok(cells.some(c=>c.ground===true));assert.ok(cells.some(c=>c.ground===false));
 assert.ok(cells.filter(c=>c.ground).every(c=>c.y<0));assert.ok(cells.filter(c=>!c.ground).every(c=>c.y>0));
});
test('support work keeps a player cause but conservatively clears mixed damage attribution',()=>{
 const w=world(),b={min:[-.5,-VOXEL.SIZE,-.5],max:[.5,2,.5]};w.queueSupport(b,'building',{instigator:'player'});w.queueSupport(b,'building',{instigator:'player'});assert.equal(w.damageQueue[0].instigator,'player');
 w.queueSupport(b,'building',{instigator:'military'});assert.equal(w.damageQueue[0].instigator,'mixed');
});
