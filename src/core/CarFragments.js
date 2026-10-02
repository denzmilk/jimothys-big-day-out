import * as THREE from 'three';
import {STREET} from './Constants.js';

// Preserve the imported palette and every authored triangle. These cached
// fragments only replace a car when it breaks; intact cars keep their draws.
export function buildCarFragments(root){
  const C=STREET.CAR,box=new THREE.Box3(),parts=[],materials=new Map();
  for(const mesh of root.children){
    if(mesh.userData.glassPane!==undefined)continue;
    mesh.updateMatrix();mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix));
  }
  const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  for(const mesh of root.children){
    if(mesh.userData.glassPane!==undefined)continue;
    const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(mesh.matrix);
    const position=geo.attributes.position,groups=new Map(),point=new THREE.Vector3();
    for(let i=0;i<position.count;i+=3){
      point.set(0,0,0);for(let j=0;j<3;j++)point.add(new THREE.Vector3().fromBufferAttribute(position,i+j));point.divideScalar(3);
      const height=(point.y-box.min.y)/size.y,length=(point.z-box.min.z)/size.z,side=(point.x-center.x)/size.x;
      let part='chassis';
      if(mesh.name.includes('wheel'))part='wheel';
      else if(height>C.PANEL_ROOF)part='roof';
      else if(length>C.PANEL_FRONT)part=height<C.PANEL_BUMPER?'front-bumper':'bonnet';
      else if(length<C.PANEL_REAR)part=height<C.PANEL_BUMPER?'rear-bumper':'rear-panel';
      else if(height>C.PANEL_FLOOR&&Math.abs(side)>C.PANEL_SIDE)part=side<0?'left-panel':'right-panel';
      if(!groups.has(part))groups.set(part,[]);groups.get(part).push(i);
    }
    for(const [part,triangles] of groups){
      const geometry=new THREE.BufferGeometry();
      for(const [name,attribute] of Object.entries(geo.attributes)){
        const values=[];
        for(const i of triangles)for(let j=0;j<3;j++)for(let c=0;c<attribute.itemSize;c++)values.push(attribute.getComponent(i+j,c));
        geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,attribute.itemSize));
      }
      // Detached sheet metal exposes its back face as it tumbles.
      if(!materials.has(mesh.material)){const material=mesh.material.clone();material.side=THREE.DoubleSide;materials.set(mesh.material,material);}
      const piece=new THREE.Mesh(geometry,materials.get(mesh.material));piece.name=mesh.name;piece.userData.part=part;parts.push(piece);
    }
    geo.dispose();
  }
  return parts;
}
