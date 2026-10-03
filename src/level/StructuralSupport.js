import * as THREE from 'three';
import {SUPPORT as C,VOXEL,BUILDINGS,GLAZING} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import * as Layout from './Layout.js';

export class StructuralSupport {
 constructor(scene,jimothy,voxels){
  this.scene=scene;this.jimothy=jimothy;this.voxels=voxels;this.pending=new Map();this.fragments=[];this.pieces=new Map();this.serial=0;
  this.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});this.cube=new THREE.BoxGeometry(VOXEL.SIZE,VOXEL.SIZE,VOXEL.SIZE).toNonIndexed();
  eventBus.on(Events.WORLD_DEMOLISHED,e=>{
   if(!e.bounds)return;
   if(!e.collapse)for(const b of [...Layout.buildingsIntersecting(e.bounds.min[0],e.bounds.min[2],e.bounds.max[0],e.bounds.max[2]),...Layout.landmarkStructuresIn(e.bounds.min[0],e.bounds.min[2],e.bounds.max[0],e.bounds.max[2])]){
    if(this.pending.size>=C.PENDING)break;
    const margin=BUILDINGS.ROOF_OVERHANG+VOXEL.SIZE;
    const bottom=Math.min(b.type==='landmark'?b.vy*VOXEL.SIZE:Infinity,...[[0,0],[b.w,0],[0,b.d],[b.w,b.d]].map(([x,z])=>voxels.terrainHeightAt(b.x+x,b.z+z)))-VOXEL.SIZE;
    this.pending.set(`${b.vx},${b.vz}`,{min:[b.x-margin,bottom,b.z-margin],max:[b.x+b.w+margin,(b.vy+b.vh)*VOXEL.SIZE+Math.max(b.w,b.d)*Math.max(...BUILDINGS.ROOF_PITCH),b.z+b.d+margin]});
   }
   if(e.cells)this.gather(e.cells);
  });
  eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.fragments.find(p=>p.id===id);if(p){p.attached=true;eventBus.emit(Events.PROP_SUSPEND,{id});}});
  eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{const p=this.fragments.find(p=>p.id===id);if(p){p.attached=false;p.life=C.SECTION_LIFE;p.mesh.position.set(position.x,ground+p.half[1],position.z);eventBus.emit(Events.PROP_RELEASE,{id,position:p.mesh.position});}});
 }
 gather(cells){
  const step=C.SECTION_CELLS*VOXEL.SIZE;
  for(const cell of cells){
   if(cell.mat===GLAZING.MATERIAL_ID||cell.y<=this.voxels.terrainHeightAt(cell.x,cell.z)+VOXEL.SIZE)continue;
   const key=`${Math.floor(cell.x/step)},${Math.floor(cell.y/step)},${Math.floor(cell.z/step)}`;
   let list=this.pieces.get(key);if(!list){if(this.pieces.size>=C.PENDING)continue;list=[];this.pieces.set(key,list);}if(list.length<C.SECTION_VOXELS)list.push(cell);
  }
 }
 update(dt){
  for(const [key,bounds]of this.pending){
   const active=this.voxels.damageQueue.filter(j=>j.kind==='support').length;if(active>=C.ACTIVE)break;
   if(!this.voxels.isLoadedAtWorld(bounds.min[0],bounds.min[2])||!this.voxels.isLoadedAtWorld(bounds.max[0],bounds.max[2])){continue;}
   if(this.voxels.queueSupport(bounds,key))this.pending.delete(key);break;
  }
  for(const p of [...this.fragments])if(!p.attached){p.life-=dt;if(p.life<=0||p.mesh.position.distanceTo(this.jimothy.position)>Layout.Masterplan.BOUNDS)this.remove(p);}
  const first=this.pieces.entries().next().value;if(first){this.pieces.delete(first[0]);this.spawn(first[1]);}
 }
 spawn(cells){
  if(this.fragments.length>=C.SECTION_LIMIT){const old=this.fragments.find(p=>!p.attached);if(!old)return;this.remove(old);}
  const min=new THREE.Vector3(Infinity,Infinity,Infinity),max=min.clone().negate();
  for(const p of cells){min.min(new THREE.Vector3(p.x,p.y,p.z));max.max(new THREE.Vector3(p.x,p.y,p.z));}
  const center=min.clone().add(max).multiplyScalar(.5),half=max.clone().sub(min).addScalar(VOXEL.SIZE).multiplyScalar(.5);
  if(Math.max(half.x,half.y,half.z)<C.SECTION_MIN)return;
  const positions=[],normals=[],colors=[],index=new Set(cells.map(p=>this.key(p.x,p.y,p.z))),color=new THREE.Color(),base=this.cube.attributes.position,normal=this.cube.attributes.normal;
  for(const cell of cells){color.set(VOXEL.MATERIALS[cell.mat].color);
   for(let face=0;face<6;face++){const start=face*6,nx=normal.getX(start),ny=normal.getY(start),nz=normal.getZ(start);if(index.has(this.key(cell.x+nx*VOXEL.SIZE,cell.y+ny*VOXEL.SIZE,cell.z+nz*VOXEL.SIZE)))continue;
    for(let i=start;i<start+6;i++){positions.push(base.getX(i)+cell.x-center.x,base.getY(i)+cell.y-center.y,base.getZ(i)+cell.z-center.z);normals.push(nx,ny,nz);colors.push(color.r,color.g,color.b);}
   }
  }
  if(!positions.length)return;
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeBoundingSphere();
  const mesh=new THREE.Mesh(geo,this.material);mesh.position.copy(center);mesh.castShadow=mesh.receiveShadow=true;this.scene.add(mesh);
  const p={id:`structure-piece:${this.serial++}`,kind:'building',mesh,half:half.toArray(),size:Math.max(half.x,half.y,half.z)*2,mass:C.SECTION_MASS,loose:true,attached:false,life:C.SECTION_LIFE};
  this.fragments.push(p);eventBus.emit(Events.PROP_CREATE,p);eventBus.emit(Events.ENTITY_REGISTER,p);
 }
 key(x,y,z){return `${Math.round(x/VOXEL.SIZE-.5)},${Math.round(y/VOXEL.SIZE-.5)},${Math.round(z/VOXEL.SIZE-.5)}`;}
 remove(p){eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});eventBus.emit(Events.PROP_REMOVE,{id:p.id});p.mesh.removeFromParent();p.mesh.geometry.dispose();this.fragments.splice(this.fragments.indexOf(p),1);}
 reset(){for(const p of [...this.fragments])this.remove(p);this.pending.clear();this.pieces.clear();this.serial=0;}
 snapshot(){return {pending:this.pending.size,pieces:this.pieces.size,fragments:this.fragments.length,attached:this.fragments.filter(p=>p.attached).length};}
}
