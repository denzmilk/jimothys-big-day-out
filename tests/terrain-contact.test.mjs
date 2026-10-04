import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {VoxelWorld} from '../src/level/VoxelWorld.js';import {VOXEL} from '../src/core/Constants.js';
function ground(){const w=new VoxelWorld(new THREE.Scene()),s=VOXEL.SIZE,h=(x,z)=>2+.45*x+.8*z;w.terrain={surfaceHeight:h,topSolidVoxelY:(x,z)=>Math.floor(h(x,z)/s-.5),materialAtVoxel:(x,y,z)=>y<=Math.floor(h((x+.5)*s,(z+.5)*s)/s-.5)?8:0};for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)w.generated.add(`${x},${z}`);return w;}
test('intact ground occupancy agrees with its continuous visible surface',()=>{
 const w=ground();let misses=0;for(let x=-1;x<1;x+=.067)for(let z=-1;z<1;z+=.079){const y=w.terrain.surfaceHeight(x,z);if(w.solidAtWorld(x,y+.02,z)||!w.solidAtWorld(x,y-.02,z))misses++;}assert.equal(misses,0);w.clear();
});
test('continuous surface occupancy preserves walls, excavated air and underground ceilings',()=>{
 const w=ground(),s=VOXEL.SIZE,x=.11,z=.11,top=w.terrain.topSolidVoxelY(x,z);
 w.set(0,top+1,0,3);assert.equal(w.solidAtWorld(x,(top+1.5)*s,z),true);
 w.set(0,top+1,0,VOXEL.EMPTY);w.set(0,top,0,VOXEL.EMPTY);assert.equal(w.solidAtWorld(x,(top+.5)*s,z),false);
 w.set(0,top-3,0,VOXEL.EMPTY);assert.equal(w.solidAtWorld(x,(top-2.5)*s,z),false);assert.equal(w.solidAtWorld(x,(top-1.5)*s,z),true);w.clear();
});
