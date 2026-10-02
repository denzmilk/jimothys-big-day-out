import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {VoxelWorld}from '../src/level/VoxelWorld.js';import{VOXEL,TERRAIN}from '../src/core/Constants.js';
function world(){const w=new VoxelWorld(new THREE.Scene());w.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(x,y,z)=>y<0?1:0};w.set(0,-1,0,1);for(const x of [-1,0])for(const z of [-1,0])w.generated.add(`${x},${z}`);return w;}
test('road height probes skip empty air above intact ground',()=>{const w=world();let calls=0;const get=w.get;w.get=function(...args){calls++;return get.apply(this,args);};assert.equal(w.groundHeightAt(.1,.1,8),0);assert.ok(calls<6,`height probe read ${calls} empty cells`);});
test('indexed support agrees with an exact downward scan above structures, seams, tunnels and craters',()=>{
 const w=world(),s=VOXEL.SIZE;for(let x=-4;x<4;x++)for(let z=-4;z<4;z++){w.set(x,-1,z,1);for(let y=2;y<70;y++)if((x*x+z*z+y)%11===0)w.set(x,y,z,3);}
 w.damageSphere(.2,-.3,.2,.65);w.damageSphere(-.5,-3,-.5,.65);
 function reference(x,z,from){const [vx,,vz]=w.worldToVoxel(x,0,z),top=Math.floor((from+s*.75)/s),bottom=Math.min(Math.floor(-TERRAIN.DEPTH/s)-2,top);for(let y=top;y>=bottom;y--)if(w.get(vx,y,vz))return y===-1?0:(y+1)*s;return bottom*s;}
 for(let x=-.7;x<.8;x+=.27)for(let z=-.7;z<.8;z+=.29)for(let y=-4;y<18;y+=.67)assert.equal(w.groundHeightAt(x,z,y),reference(x,z,y));
});
