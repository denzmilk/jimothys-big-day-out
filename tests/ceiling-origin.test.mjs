import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
globalThis.localStorage={getItem:()=>null};
const {JimothyController}=await import('../src/gameplay/JimothyController.js');
const {VoxelWorld}=await import('../src/level/VoxelWorld.js');
const {VOXEL,PLAYER_CONFIG:P}=await import('../src/core/Constants.js');
function fixture(ceiling){
 const w=new VoxelWorld(new THREE.Scene()),s=VOXEL.SIZE;w.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(_x,y)=>y<0?1:0};
 for(const x of [-1,0])for(const z of [-1,0])w.generated.add(`${x},${z}`);
 for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++){w.set(x,-1,z,1);if(z===2)for(let y=0;y<7;y++)w.set(x,y,z,1);if(ceiling!==undefined)w.set(x,ceiling,z,6);}
 return {voxels:w,radius:P.RADIUS};
}
test('a step ceiling probe can leave its starting ledge before seeking overhead solid',()=>{
 const j=fixture();assert.equal(JimothyController.prototype._ceilingLimit.call(j,.1,.1,.55,1.8,true),1.8);
});
test('leaving a ledge still catches a separate roof and ordinary upward sweeps keep their ceiling',()=>{
 const j=fixture(10),limit=JimothyController.prototype._ceilingLimit.call(j,.1,.1,.55,2,true);assert.ok(Math.abs(limit-(10*VOXEL.SIZE-j.radius))<.03);
 const normal=fixture(6);assert.ok(JimothyController.prototype._ceilingLimit.call(normal,.1,.1,.55,2)<1);
});
test('a frame without horizontal integration keeps intent, while a moved body still stops at a wall',()=>{
 const j={radius:P.RADIUS,climbHeight:P.CLIMB_HEIGHT,grounded:false,voxels:{solidAtWorld:()=>true},_prevX:0,_prevZ:0,vel:new THREE.Vector3(0,0,6)},p=new THREE.Vector3(0,1,0);
 JimothyController.prototype._resolveVoxels.call(j,p);assert.equal(j.vel.z,6);
 p.z=.1;JimothyController.prototype._resolveVoxels.call(j,p);assert.equal(p.z,0);assert.equal(j.vel.z,0);
});
