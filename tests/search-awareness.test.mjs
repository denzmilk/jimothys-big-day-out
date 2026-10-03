import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.localStorage ??= {getItem:()=>null};
const {Pursuers}=await import('../src/gameplay/Pursuers.js');
const {gameState}=await import('../src/core/GameState.js');
const {SEARCH,ANIMAL_CONTROL}=await import('../src/core/Constants.js');
function fixture(){
 gameState.reset();gameState.game.isPlaying=true;gameState.world.daylight=1;
 const j={position:new THREE.Vector3(13,0,21)},ai=new Pursuers(new THREE.Scene(),j);
 const p=ai._makePerson('animal-control',13,1);p.group.rotation.y=0;
 return {ai,p,j};
}
test('dispatch is an approximate report, not exact hidden player tracking',()=>{
 const {ai,p,j}=fixture();const distance=Math.hypot(p.lastKnown.x-j.position.x,p.lastKnown.z-j.position.z);
 assert.ok(distance>=4 && distance<=16,`dispatch error ${distance}`);
 j.position.set(800,0,800);const report={...p.lastKnown};ai._think(p,.1);assert.deepEqual(p.lastKnown,report);
});
test('a glimpse raises awareness without granting a chase or attack lock',()=>{
 const {ai,p,j}=fixture();ai._think(p,.1);
 assert.notEqual(p.state,'chase');assert.equal(p.sees,false);assert.ok(p.awareness>0&&p.awareness<1);
 const awareness=p.awareness;j.position.set(800,0,800);ai._think(p,.2);assert.ok(p.awareness<awareness);
});
test('sustained sight confirms, then searches a fixed finite area',()=>{
 const {ai,p,j}=fixture();for(let i=0;i<15;i++)ai._think(p,.1);
 assert.equal(p.state,'chase');assert.equal(p.sees,true);const remembered={...p.lastKnown};j.position.set(800,0,800);
 ai._think(p,.1);assert.equal(p.state,'search');assert.deepEqual(p.lastKnown,remembered);
 const target={...p.target};for(let i=0;i<30;i++)ai._think(p,.1);
 assert.notDeepEqual(p.target,target,'an unreachable search goal must be repicked');assert.deepEqual(p.lastKnown,remembered);
 for(let i=0;i<Math.ceil(SEARCH.DURATION*ANIMAL_CONTROL.SEARCH_SCALE*10);i++)ai._think(p,.1);
 assert.equal(p.state,'patrol');
});
test('near contact remains immediate, night shrinks the same range exposed to radar',()=>{
 const {ai,p,j}=fixture();ai.animalControl=p;
 const day=ai.snapshot()[0].sightRange;gameState.world.daylight=0;
 const night=ai.snapshot()[0].sightRange;assert.ok(night<day,'no nighttime sight reduction');
 j.position.copy(p.group.position).add(new THREE.Vector3(0,0,1));ai._think(p,.01);assert.equal(p.sees,true);
 gameState.player.hidden=true;assert.ok(ai.snapshot()[0].sightRange<night);
});

test('outside the cone or radius does not build awareness or update memory',()=>{
 const {ai,p,j}=fixture();const last={...p.lastKnown};j.position.set(13,0,-19);
 ai._think(p,2);assert.equal(p.awareness,0);assert.equal(p.sees,false);assert.deepEqual(p.lastKnown,last);
 j.position.set(13,0,100);ai._think(p,2);assert.equal(p.awareness,0);assert.deepEqual(p.lastKnown,last);
});
test('an outdoor crash channel does not receive underground stealth or lose its radar layer',()=>{
 const {ai,p,j}=fixture();ai.voxels={terrainHeightAt:()=>20,channels:{sample:()=>-20}};
 assert.equal(ai.isUnderground(j.position),false);assert.equal(ai.effectiveSightRange(p),ai.sightRange(p.type));
});
test('restarting restores the same initial dispatch rather than advancing its hidden seed',()=>{
 const {ai,p,j}=fixture();const report={...p.lastKnown};ai.animalControl=p;ai.reset();
 const next=ai._makePerson('animal-control',13,1);assert.deepEqual(next.lastKnown,report);
});
