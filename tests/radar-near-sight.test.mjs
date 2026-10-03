import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.localStorage ??= {getItem:()=>null};
const {Pursuers}=await import('../src/gameplay/Pursuers.js');
const {gameState}=await import('../src/core/GameState.js');
test('the radar covers peripheral detection behind a person without seeing through cover',()=>{
 gameState.reset();gameState.game.isPlaying=true;gameState.world.daylight=1;
 const j={position:new THREE.Vector3(0,0,-3)},ai=new Pursuers(new THREE.Scene(),j),p=ai._makePerson('animal-control',0,0);ai.animalControl=p;
 p.group.rotation.y=0;assert.equal(ai._canSee(p),true);
 const clear=ai.radarContacts()[0];assert.ok(clear.nearSight?.some(v=>v.z<j.position.z+.1),'unmarked detection behind the cone');
 ai.voxels={terrainHeightAt:()=>0,hasLineOfSight:()=>false,raycast:()=>({t:1})};
 assert.equal(ai._canSee(p),false);
 assert.ok(ai.radarContacts()[0].nearSight.every(v=>Math.hypot(v.x,v.z)<=1.01));
});
test('a slope beyond visible street does not shrink that clear street out of the fan',async()=>{
 const {sightFan}=await import('../src/core/Perception.js');
 const world={terrainHeightAt:(x,z)=>z>20?-20:0,raycast:(x,y,z,dx,dy,dz,length)=>{
  for(let t=0;t<length;t+=.1){const pz=z+dz*t,py=y+dy*t;if(py< (pz>20?-20:0))return {t};}return null;
 }};
 const fan=sightFan(world,{x:0,y:0,z:0},0,40,1,false);
 assert.ok(fan[Math.floor(fan.length/2)].z>=19,'distant downslope incorrectly clips the nearby visible street');
});
test('tank sight shading uses the target body height so a giant can be seen over low cover',async()=>{
 const {sightFan}=await import('../src/core/Perception.js');
 const world={terrainHeightAt:()=>0,raycast:(x,y,z,dx,dy,dz,length)=>{
  const t=4/dz;return t>0&&t<length&&y+dy*t<3?{t}:null;
 }};
 const low=sightFan(world,{x:0,y:0,z:0},0,12,0,false,2,.5);
 const giant=sightFan(world,{x:0,y:0,z:0},0,12,0,false,2,8);
 assert.ok(low[0].z<5);assert.ok(giant[0].z>=11,'the tank can see a tall target, but its map cannot');
});
