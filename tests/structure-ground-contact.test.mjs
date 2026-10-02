import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {VoxelWorld} from '../src/level/VoxelWorld.js';
import {VOXEL} from '../src/core/Constants.js';

test('structure walls meet a smoothed terrain surface inside the same voxel',()=>{
 const w=new VoxelWorld(new THREE.Scene()),s=VOXEL.SIZE,ground=-10,top=Math.ceil(ground/s)-1;
 w.terrain={surfaceHeight:()=>ground,topSolidVoxelY:()=>top,materialAtVoxel:(_x,y)=>y<=top?12:0};
 for(let x=0;x<8;x++)for(let z=0;z<8;z++)w.set(x,top,z,12);
 for(let y=top;y<top+5;y++)w.set(3,y,3,6);
 w.remeshDirty();
 const meshes=[...w.chunks.values()].filter(c=>c.mesh).map(c=>new THREE.Mesh(c.mesh.geometry,w.material));
 const y=(ground+(top+1)*s)/2;
 const hit=new THREE.Raycaster(new THREE.Vector3(s,y,3.5*s),new THREE.Vector3(1,0,0),0,s*5).intersectObjects(meshes)[0];
 assert(hit,'there must be a wall in the gap between the smooth ground and the next voxel');
 assert(Math.abs(hit.point.x-3*s)<1e-6);
});
