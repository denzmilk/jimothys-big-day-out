import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Keep the original assembly for ray hits and breakage, but draw identical
 * rigid assemblies in batches. Matrices are sampled after physics/collection. */
export class InstanceBatches {
  constructor(scene,capacity){this.scene=scene;this.capacity=capacity;this.cache=new Map();this.enabled=true;}
  assembly(key,root){
    if(this.cache.has(key))return this.cache.get(key);
    const groups=new Map();root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();
    root.traverse(o=>{
      if(!o.isMesh)return;
      const source=o.material,solid=source.isMeshStandardMaterial&&!source.isMeshPhysicalMaterial&&!source.map&&!source.normalMap&&!source.transparent&&!source.vertexColors&&source.emissive.getHex()===0;
      const key=solid?`solid:${source.roughness}:${source.metalness}:${source.side}`:source.uuid;
      if(!groups.has(key)){
        const material=solid?source.clone():source;
        if(solid){material.color.set(0xffffff);material.vertexColors=true;material.userData.batchOwned=true;}
        groups.set(key,{material,geometries:[],castShadow:o.castShadow,receiveShadow:o.receiveShadow});
      }
      let geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
      // Only position/normal/UV are used by the imported rigid materials.
      for(const name of Object.keys(geo.attributes))if(!['position','normal','uv','color'].includes(name))geo.deleteAttribute(name);
      if(!geo.getAttribute('normal'))geo.computeVertexNormals();
      if(!geo.getAttribute('uv'))geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count*2),2));
      if(solid){const colors=new Float32Array(geo.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3)source.color.toArray(colors,i);geo.setAttribute('color',new THREE.BufferAttribute(colors,3));}
      geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));groups.get(key).geometries.push(geo);
    });
    const parts=[];
    for(const g of groups.values()){
      const geometry=mergeGeometries(g.geometries);for(const geo of g.geometries)geo.dispose();
      const mesh=new THREE.InstancedMesh(geometry,g.material,this.capacity);mesh.count=0;mesh.castShadow=g.castShadow;mesh.receiveShadow=g.receiveShadow;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(mesh);parts.push(mesh);
    }
    const entry={parts,count:0};this.cache.set(key,entry);return entry;
  }
  update(assemblies){
    for(const e of this.cache.values())e.count=0;
    for(const {key,root,visible=true}of assemblies){
      root.traverse(o=>{if(o.isMesh)o.visible=!this.enabled;});
      if(!this.enabled||!visible)continue;
      const e=this.assembly(key,root);root.updateWorldMatrix(true,false);
      if(e.count>=this.capacity)throw new Error('Instance batch capacity exceeded');
      for(const mesh of e.parts)mesh.setMatrixAt(e.count,root.matrixWorld);e.count++;
    }
    // Unused window/traffic-light variants must not accumulate over a long run.
    for(const [key,e]of this.cache){
      if(!e.count){this.disposeEntry(e);this.cache.delete(key);continue;}
      for(const mesh of e.parts){mesh.count=e.count;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
    }
  }
  disposeEntry(entry){for(const mesh of entry.parts){mesh.removeFromParent();mesh.geometry.dispose();if(mesh.material.userData.batchOwned)mesh.material.dispose();mesh.dispose();}}
  clear(){for(const e of this.cache.values())this.disposeEntry(e);this.cache.clear();}
}
