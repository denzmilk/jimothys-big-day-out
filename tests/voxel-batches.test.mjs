import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {VoxelBatches} from '../src/core/VoxelBatches.js';
function piece(x){const g=new THREE.BoxGeometry().toNonIndexed();g.translate(x,0,0);g.clearGroups();g.addGroup(0,30,0);g.addGroup(30,6,1);return g;}
test('opaque and glass chunk geometry is preserved in separate cullable banks',()=>{
 const scene=new THREE.Scene(),b=new VoxelBatches(scene,[new THREE.MeshStandardMaterial(),new THREE.MeshPhysicalMaterial({transmission:1})]),g=piece(7);b.set('one',g);b.set('two',piece(-7));
 assert.equal(b.banks.length,2);assert.equal(b.entries.size,2);
 for(const e of b.entries.get('one')){const range=e.bank.mesh.getGeometryRangeAt(e.id),position=e.bank.mesh.geometry.getAttribute('position'),group=g.groups[e.bank.materialIndex];assert.equal(range.vertexCount,group.count);for(let i=0;i<group.count;i++)assert.equal(position.getX(range.vertexStart+i),g.getAttribute('position').getX(group.start+i));assert.ok(e.bank.mesh.perObjectFrustumCulled);}
 b.clear();assert.equal(scene.children.length,0);
});
test('replacement, unloading and reset cannot retain old chunk instances',()=>{
 const scene=new THREE.Scene(),b=new VoxelBatches(scene,[new THREE.MeshStandardMaterial(),new THREE.MeshPhysicalMaterial()]);
 for(let i=0;i<100;i++){b.set('one',piece(i));b.set('two',piece(-i));b.remove('one');}
 assert.equal(b.entries.size,1);assert.equal(b.banks.reduce((n,x)=>n+x.mesh.instanceCount,0),2);assert.equal(b.banks.length,2);b.clear();assert.equal(scene.children.length,0);
});
