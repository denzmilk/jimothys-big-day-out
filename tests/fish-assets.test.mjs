import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

for(const name of ['fish-silver','fish-blue','fish-striped'])test(`${name}: delivered skin crosses its swim-loop seam continuously`,async()=>{
 const b=await fs.readFile(new URL(`../public/assets/models/ocean/${name}.glb`,import.meta.url));
 const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''),mixer=new THREE.AnimationMixer(g.scene),clip=g.animations[0];assert.equal(g.animations.length,1);mixer.clipAction(clip).play();
 const meshes=[];g.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});assert.ok(meshes.length);
 function points(time){mixer.setTime(time);g.scene.updateMatrixWorld(true);return meshes.flatMap(o=>{o.skeleton.update();const a=o.geometry.attributes.position;return Array.from({length:a.count},(_,i)=>o.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(a,i)).applyMatrix4(o.matrixWorld));});}
 const first=points(0),last=points(clip.duration-1e-5);const gap=Math.max(...first.map((p,i)=>p.distanceTo(last[i])));assert.ok(gap<.0001,`${name} seam moves ${gap} m`);
 for(const hz of [30,60,120]){let before=points(0),peak=0;for(let i=1;i<=Math.ceil(clip.duration*hz)*2;i++){const after=points(i/hz);for(let v=0;v<after.length;v++)peak=Math.max(peak,after[v].distanceTo(before[v])*hz);before=after;}assert.ok(peak<.85,`${name} ${hz} Hz skin velocity ${peak} m/s`);}
});
