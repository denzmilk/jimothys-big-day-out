import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};const {RollCollector}=await import('../src/gameplay/RollCollector.js'),{gameState}=await import('../src/core/GameState.js');
test('a later car can displace tiny carried scraps without exceeding the body attachment budget',()=>{
 const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group);gameState.player.fatness=400;
 const j={radius:36,group,body:{position:new THREE.Vector3(0,36,0)},move:{kind:'roll'}},v={terrainHeightAt:()=>0,groundHeightAt:()=>0,solidAtWorld:()=>false};
 const c=new RollCollector(scene,j,v),geo=new THREE.BoxGeometry(.2,.2,.2),mat=new THREE.MeshBasicMaterial();
 for(let i=0;i<64;i++){const mesh=new THREE.Mesh(geo,mat);mesh.position.set(0,.1,0);scene.add(mesh);c.entities.set(`snack-${i}`,{id:`snack-${i}`,kind:'snack',mesh,size:.2});}
 for(let i=0;i<12;i++)c.update(1/60);assert.equal(c.attached.length,64);
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,1.4,4.5),mat);mesh.position.set(0,.7,0);scene.add(mesh);c.entities.set('late-car',{id:'late-car',kind:'car',size:4.5,mass:1100,mesh});c.update(1/60);
 assert.ok(c.attached.some(e=>e.id==='late-car'));assert.equal(c.attached.length,64);assert.equal(mesh.parent,group);assert.ok([...c.entities.values()].some(e=>e.kind==='snack'&&!e.attached&&e.mesh.parent===scene));
 c.reset();assert.equal(c.attached.length,0);geo.dispose();mesh.geometry.dispose();mat.dispose();
});
