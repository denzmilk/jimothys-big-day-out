import test from'node:test';import assert from'node:assert/strict';import * as THREE from'three';import{RigidBatches}from'../src/core/RigidBatches.js';
test('different furniture silhouettes share a material draw and retain per-item transforms',()=>{
 const scene=new THREE.Scene(),a=new THREE.Group(),b=new THREE.Group();a.add(new THREE.Mesh(new THREE.BoxGeometry(2,1,3),new THREE.MeshStandardMaterial({color:0xff0000})));b.add(new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,2),new THREE.MeshStandardMaterial({color:0x00ff00})));a.position.set(3,1,4);b.position.set(-2,2,1);scene.add(a,b);
 const batches=new RigidBatches(scene,8,1000);batches.update([{key:'table',root:a},{key:'lamp',root:b}]);assert.equal(batches.pools.size,1);assert.equal(batches.live.size,2);
 const matrix=new THREE.Matrix4();for(const root of[a,b]){const e=batches.live.get(root.uuid)[0];e.pool.mesh.getMatrixAt(e.instanceId,matrix);assert.deepEqual(matrix.elements,root.matrixWorld.elements);assert.equal(root.children[0].visible,false);}
 const pool=[...batches.pools.values()][0],colors=pool.mesh.geometry.attributes.color;assert.ok(Array.from(colors.array).some((v,i)=>i%3===0&&v===1));assert.ok(Array.from(colors.array).some((v,i)=>i%3===1&&v===1));
 batches.update([{key:'table',root:a}]);assert.equal(batches.live.size,1);batches.clear();assert.equal(batches.pools.size,0);assert.equal(scene.children.length,2);
});
