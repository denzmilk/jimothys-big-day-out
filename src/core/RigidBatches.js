import * as THREE from 'three';
import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';

// Different furniture shapes share a draw while retaining their source roots
// for collection, physics and breakage. BatchedMesh culls each item separately
// in both the main and shadow views; an unseen chair does not widen a whole
// model's instanced bounding box across several houses.
export class RigidBatches{
 constructor(scene,capacity,vertices){this.scene=scene;this.capacity=capacity;this.vertices=vertices;this.pools=new Map();this.assemblies=new Map();this.live=new Map();}
 assembly(key,root){
  if(this.assemblies.has(key))return this.assemblies.get(key);
  root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),groups=new Map();
  root.traverse(o=>{
   if(!o.isMesh)return;
   const m=o.material,solid=!m.map&&!m.normalMap&&!m.transparent&&!m.emissive?.getHex(),poolKey=solid?`${m.type}:${m.roughness}:${m.metalness}:${m.side}:${m.flatShading}`:m.uuid;
   if(!groups.has(poolKey))groups.set(poolKey,{source:m,solid,geometries:[]});
   const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
   for(const name of Object.keys(geo.attributes))if(!['position','normal','uv','color'].includes(name))geo.deleteAttribute(name);
   if(!geo.attributes.normal)geo.computeVertexNormals();const count=geo.attributes.position.count;
   if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(count*2),2));
   if(!geo.attributes.color){const colors=new Float32Array(count*3);for(let i=0;i<count;i++)(solid?m.color:new THREE.Color(0xffffff)).toArray(colors,i*3);geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));}
   geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));groups.get(poolKey).geometries.push(geo);
  });
  const parts=[];
  for(const [poolKey,g]of groups){
   let pool=this.pools.get(poolKey);
   if(!pool){const material=g.source.clone();if(g.solid){material.color.set(0xffffff);material.vertexColors=true;}
    const mesh=new THREE.BatchedMesh(this.capacity,this.vertices,this.vertices*3,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.perObjectFrustumCulled=true;this.scene.add(mesh);pool={mesh,material};this.pools.set(poolKey,pool);
   }
   const geometry=mergeGeometries(g.geometries);g.geometries.forEach(geo=>geo.dispose());const geometryId=pool.mesh.addGeometry(geometry);geometry.dispose();parts.push({pool,geometryId});
  }
  this.assemblies.set(key,parts);return parts;
 }
 update(items){
  const keep=new Set(items.map(p=>p.root.uuid));
  for(const [id,entries]of this.live)if(!keep.has(id)){entries.forEach(e=>e.pool.mesh.deleteInstance(e.instanceId));this.live.delete(id);}
  for(const {key,root,visible=true}of items){
   let entries=this.live.get(root.uuid);if(!entries){entries=this.assembly(key,root).map(part=>({...part,instanceId:part.pool.mesh.addInstance(part.geometryId)}));this.live.set(root.uuid,entries);}
   root.updateWorldMatrix(true,false);for(const e of entries){e.pool.mesh.setMatrixAt(e.instanceId,root.matrixWorld);e.pool.mesh.setVisibleAt(e.instanceId,visible);}
   root.traverse(o=>{if(o.isMesh)o.visible=false;});
  }
 }
 clear(){for(const p of this.pools.values()){p.mesh.removeFromParent();p.mesh.dispose();p.material.dispose();}this.pools.clear();this.assemblies.clear();this.live.clear();}
}
