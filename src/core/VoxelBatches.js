import * as THREE from 'three';
import {VOXEL_BATCH as C} from '../core/Constants.js';

/** Bounded buffer banks let chunk replacement retain per-chunk frustum tests
 * in every render pass, while WEBGL_multi_draw submits each bank once. */
export class VoxelBatches {
 constructor(scene,materials,limits=C){this.limits=limits;this.scene=scene;this.materials=materials;this.banks=[];this.entries=new Map();}
 part(geometry,group){
  const part=new THREE.BufferGeometry();
  for(const [name,attribute]of Object.entries(geometry.attributes))part.setAttribute(name,new THREE.BufferAttribute(attribute.array.subarray(group.start*attribute.itemSize,(group.start+group.count)*attribute.itemSize),attribute.itemSize));
  return part;
 }
 set(key,geometry){
  const previous=this.entries.get(key)||[],next=[];
  for(const [materialIndex,material]of this.materials.entries()){
   const group=geometry.groups.find(g=>g.materialIndex===materialIndex);let old=previous[materialIndex];
   if(!group?.count){if(old)this.release(old);continue;}
   const part=this.part(geometry,group),count=group.count;
   if(old&&count<=old.reserved){old.bank.mesh.setGeometryAt(old.id,part);next[materialIndex]=old;}
   else{
    if(old)this.release(old);
    const reserved=Math.ceil(count*this.limits.RESERVE),bank=this.findBank(materialIndex,reserved);
    const id=bank.mesh.addGeometry(part,reserved),instance=bank.mesh.addInstance(id);
    bank.used+=reserved;bank.count++;next[materialIndex]={bank,id,instance,reserved};
   }
   part.dispose();
  }
  this.entries.set(key,next);
 }
 findBank(materialIndex,reserved){
  let bank=this.banks.find(b=>b.materialIndex===materialIndex&&b.capacity-b.used>=reserved&&b.count<this.limits.INSTANCES);
  if(bank){if(bank.mesh.unusedVertexCount<reserved)bank.mesh.optimize();return bank;}
  const capacity=Math.max(this.limits.VERTICES,reserved),mesh=new THREE.BatchedMesh(this.limits.INSTANCES,capacity,0,this.materials[materialIndex]);
  mesh.castShadow=true;mesh.receiveShadow=true;
  // Its own per-object test uses the current main/shadow camera. A stale
  // aggregate sphere must not reject newly streamed chunks before that test.
  mesh.frustumCulled=false;this.scene.add(mesh);
  bank={mesh,materialIndex,capacity,used:0,count:0};this.banks.push(bank);return bank;
 }
 release(entry){const b=entry.bank;b.mesh.deleteGeometry(entry.id);b.used-=entry.reserved;b.count--;if(!b.count){b.mesh.removeFromParent();b.mesh.dispose();this.banks.splice(this.banks.indexOf(b),1);}}
 remove(key){const entries=this.entries.get(key);if(!entries)return;for(const entry of entries)if(entry)this.release(entry);this.entries.delete(key);}
 clear(){for(const b of this.banks){b.mesh.removeFromParent();b.mesh.dispose();}this.banks=[];this.entries.clear();}
 stats(){return{banks:this.banks.length,vertices:this.banks.reduce((n,b)=>n+b.used,0),capacity:this.banks.reduce((n,b)=>n+b.capacity,0)};}
}
