import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {VoxelWorld}from '../src/level/VoxelWorld.js';import{SandField}from '../src/core/SandField.js';import{VOXEL}from '../src/core/Constants.js';
test('deformed rendered triangles and contact agree; digging removes the sand skin',()=>{
 const w=new VoxelWorld(new THREE.Scene()),s=VOXEL.SIZE;
 w.terrain={sandAt:()=>12,surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(x,y,z)=>y<0?12:0};w.sand=new SandField(()=>true);w.sand.centerAt(0,0);
 for(let x=0;x<8;x++)for(let z=0;z<8;z++)for(let y=-3;y<0;y++)w.set(x,y,z,12);w.generated.add('0,0');w.sand.stamp(.88,.88,.7,.15);w.sand.update(.1);w.remeshDirty();
 const meshes=[];for(const c of w.chunks.values()){if(!c.mesh)continue;const geo=c.mesh.geometry.clone(),p=geo.attributes.position,weight=geo.attributes.sandWeight;for(let i=0;i<p.count;i++)if(weight.getX(i))p.setY(i,p.getY(i)+w.sand.renderSample(p.getX(i),p.getZ(i)));geo.computeBoundingSphere();meshes.push(new THREE.Mesh(geo,w.material));}
 for(let x=.4;x<1.4;x+=.13)for(let z=.4;z<1.4;z+=.13){const ray=new THREE.Raycaster(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0)),hit=ray.intersectObjects(meshes)[0];assert(hit);assert(Math.abs(hit.point.y-w.groundHeightAt(x,z,.1))<.015);}
 assert.equal(w.solidAtWorld(.88,-.01,.88),false);w.damageSphere(.88,-.15,.88,.4);assert.equal(w.sandOffsetAt(.88,.88),0);assert(w.groundHeightAt(.88,.88,.1)<-.3);
});
