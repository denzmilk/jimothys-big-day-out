import * as THREE from 'three';
import {GLAZING as C,GLASS_SHARDS} from './Constants.js';

// Imported glazing often packs all windows into one mesh. Split connected,
// coplanar triangles once per model; clones then share the pane geometries.
export function splitGlassPanes(mesh) {
  const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
  const pos=geo.attributes.position,triangles=[],edges=new Map();
  const key=v=>v.toArray().map(n=>Math.round(n/C.VERTEX_WELD)).join(',');
  for(let i=0;i<pos.count;i+=3){
    const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(pos,i+j));
    const normal=new THREE.Triangle(...vertices).getNormal(new THREE.Vector3());
    const t={start:i,normal,links:[],visited:false},index=triangles.length;triangles.push(t);
    for(let j=0;j<3;j++){
      const edge=[key(vertices[j]),key(vertices[(j+1)%3])].sort().join('|');
      for(const other of edges.get(edge)||[])if(Math.abs(normal.dot(triangles[other].normal))>=C.COPLANAR_DOT){t.links.push(other);triangles[other].links.push(index);}
      if(!edges.has(edge))edges.set(edge,[]);edges.get(edge).push(index);
    }
  }
  const panes=[];
  for(let i=0;i<triangles.length;i++){
    if(triangles[i].visited)continue;
    const queue=[i],group=[];
    while(queue.length){const t=triangles[queue.pop()];if(t.visited)continue;t.visited=true;group.push(t);queue.push(...t.links);}
    const geometry=new THREE.BufferGeometry();
    for(const [name,attribute] of Object.entries(geo.attributes)){
      const values=[];
      for(const t of group)for(let v=0;v<3;v++)for(let c=0;c<attribute.itemSize;c++)values.push(attribute.getComponent(t.start+v,c));
      geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,attribute.itemSize));
    }
    const pane=mesh.clone();pane.geometry=geometry;pane.userData={...mesh.userData,glassPane:`${mesh.name}-${panes.length}`};panes.push(pane);
  }
  geo.dispose();return panes;
}

export function paneHit(mesh,point,radius){
  mesh.updateWorldMatrix(true,false);
  const pos=mesh.geometry.attributes.position,triangle=new THREE.Triangle(),closest=new THREE.Vector3();
  for(let i=0;i<pos.count;i+=3){
    [triangle.a,triangle.b,triangle.c].forEach((v,j)=>v.fromBufferAttribute(pos,i+j).applyMatrix4(mesh.matrixWorld));
    triangle.closestPointToPoint(point,closest);
    if(closest.distanceToSquared(point)<=radius*radius)return true;
  }
  return false;
}

export function panePoints(mesh){
  mesh.updateWorldMatrix(true,false);
  const pos=mesh.geometry.attributes.position,points=[];
  // Barycentric samples cover each triangle without emitting a whole window
  // as one sheet. The shard budget is independent of an imported mesh's size.
  for(let i=0;i<GLASS_SHARDS.PER_PANE;i++){
    const t=(i%(pos.count/3))*3,u=Math.sqrt((i+.5)/GLASS_SHARDS.PER_PANE),v=(i*.61803398875)%1;
    const a=new THREE.Vector3().fromBufferAttribute(pos,t).multiplyScalar(1-u);
    a.addScaledVector(new THREE.Vector3().fromBufferAttribute(pos,t+1),u*(1-v));
    a.addScaledVector(new THREE.Vector3().fromBufferAttribute(pos,t+2),u*v);
    points.push(a.applyMatrix4(mesh.matrixWorld));
  }
  return points;
}
