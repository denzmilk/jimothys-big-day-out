import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {oceanSites,generateOceanColumn}from '../src/level/OceanLayout.js';import{VoxelWorld}from '../src/level/VoxelWorld.js';import * as Terrain from '../src/level/Terrain.js';import{VOXEL}from '../src/core/Constants.js';
test('ruin stones occupy fine voxels and edits survive a rebuilt column',()=>{
 const w=new VoxelWorld(new THREE.Scene()),s=oceanSites().find(s=>s.kind==='ruin'),size=VOXEL.SIZE*VOXEL.CHUNK_XZ,cx=Math.floor(s.x/size),cz=Math.floor(s.z/size);w.terrain=Terrain;
 for(const _ of generateOceanColumn(w,cx,cz)){};
 let cell;for(const chunk of w.chunks.values())for(let i=0;i<chunk.data.length;i++)if(chunk.data[i]&&chunk.data[i]!==VOXEL.EMPTY){const lx=i%VOXEL.CHUNK_XZ,ly=Math.floor(i/VOXEL.CHUNK_XZ)%VOXEL.CHUNK_Y,lz=Math.floor(i/(VOXEL.CHUNK_XZ*VOXEL.CHUNK_Y));cell={x:(chunk.cx*VOXEL.CHUNK_XZ+lx+.5)*VOXEL.SIZE,y:(chunk.cy*VOXEL.CHUNK_Y+ly+.5)*VOXEL.SIZE,z:(chunk.cz*VOXEL.CHUNK_XZ+lz+.5)*VOXEL.SIZE};break;}
 assert(cell);assert(w.solidAtWorld(cell.x,cell.y,cell.z));assert(w.damageSphere(cell.x,cell.y,cell.z,.5,{digsTerrain:false}).length>0);assert.equal(w.solidAtWorld(cell.x,cell.y,cell.z),false);
 // The generator is base data. The edit overlay must still win over it.
 for(const _ of generateOceanColumn(w,cx,cz)){};assert.equal(w.solidAtWorld(cell.x,cell.y,cell.z),false);
});
