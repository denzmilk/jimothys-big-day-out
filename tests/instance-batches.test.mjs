import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {InstanceBatches} from '../src/core/InstanceBatches.js';
const material=new THREE.MeshStandardMaterial();
function car(){const root=new THREE.Group();for(const x of [-1,1]){const part=new THREE.Mesh(new THREE.BoxGeometry(),material);part.position.x=x;root.add(part);}return root;}
test('batched geometry preserves transformed assembly bounds and reduces duplicate draws',()=>{
 const scene=new THREE.Scene(),batch=new InstanceBatches(scene,8),a=car(),b=a.clone();scene.add(a,b);a.position.set(4,2,8);a.rotation.y=.7;b.position.set(-8,4,2);
 const expected=new THREE.Box3().setFromObject(a).union(new THREE.Box3().setFromObject(b));batch.update([{key:'car',root:a},{key:'car',root:b}]);
 const e=batch.cache.get('car');assert.equal(e.parts.length,1);assert.equal(e.parts[0].count,2);const actual=new THREE.Box3().setFromObject(e.parts[0]);
 assert.ok(actual.min.distanceTo(expected.min)<1e-5);assert.ok(actual.max.distanceTo(expected.max)<1e-5);assert.ok(a.children.every(p=>!p.visible));
 const hits=new THREE.Raycaster(new THREE.Vector3(-9,4,10),new THREE.Vector3(0,0,-1)).intersectObject(b,true);assert.ok(hits.length,'hidden source assembly remains hittable');
});
test('broken/attached assemblies update without retaining stale variants or leaked geometry',()=>{
 const scene=new THREE.Scene(),batch=new InstanceBatches(scene,8),root=car(),carrier=new THREE.Group();scene.add(carrier);carrier.add(root);carrier.rotation.z=1;carrier.position.y=10;
 batch.update([{key:'whole',root}]);const old=batch.cache.get('whole').parts[0];let disposed=false;old.geometry.addEventListener('dispose',()=>disposed=true);
 root.remove(root.children[0]);batch.update([{key:'broken',root}]);assert.ok(disposed);assert.equal(batch.cache.size,1);assert.equal(old.parent,null);
 const m=new THREE.Matrix4();batch.cache.get('broken').parts[0].getMatrixAt(0,m);assert.ok(new THREE.Vector3().setFromMatrixPosition(m).distanceTo(root.getWorldPosition(new THREE.Vector3()))<1e-5);
 batch.clear();assert.equal(batch.cache.size,0);assert.equal(scene.children.length,1);
});
test('plain coloured pieces share one draw without losing their colours',()=>{
 const scene=new THREE.Scene(),batch=new InstanceBatches(scene,8),root=car();root.children[0].material=new THREE.MeshStandardMaterial({color:0xff0000});root.children[1].material=new THREE.MeshStandardMaterial({color:0x0000ff});batch.update([{key:'colours',root}]);const e=batch.cache.get('colours');assert.equal(e.parts.length,1);const colors=e.parts[0].geometry.attributes.color;assert.equal(colors.getX(0),1);assert.equal(colors.getZ(colors.count-1),1);
});
