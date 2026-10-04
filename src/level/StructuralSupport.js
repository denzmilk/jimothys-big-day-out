import * as THREE from 'three';
import {SUPPORT as C,VOXEL,BUILDINGS,GLAZING,SEWER} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import * as Layout from './Layout.js';
import {rubbleBoxes} from '../core/RubbleShapes.js';
import {planSewerStairs} from './SewerStairs.js';

export class StructuralSupport {
 constructor(scene,jimothy,voxels){
  this.scene=scene;this.jimothy=jimothy;this.voxels=voxels;this.pending=new Map();this.fragments=[];this.pieces=new Map();this.serial=0;
  this.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});this.cube=new THREE.BoxGeometry(VOXEL.SIZE,VOXEL.SIZE,VOXEL.SIZE).toNonIndexed();
  this.stairs=voxels.terrain===Layout.terrain?Layout.Masterplan.sewerNetwork().flatMap(n=>n.entrances).map(e=>planSewerStairs(e,voxels.terrain)):[];
  eventBus.on(Events.WORLD_DEMOLISHED,e=>{
   if(!e.bounds)return;
   if(!e.collapse)for(const b of [...Layout.buildingsIntersecting(e.bounds.min[0],e.bounds.min[2],e.bounds.max[0],e.bounds.max[2]),...Layout.landmarkStructuresIn(e.bounds.min[0],e.bounds.min[2],e.bounds.max[0],e.bounds.max[2])]){
    if(this.pending.size>=C.PENDING)break;
    const margin=BUILDINGS.ROOF_OVERHANG+VOXEL.SIZE;
    const key=`${b.vx},${b.vz}`,previous=this.pending.get(key);
    const bottom=Math.min(e.bounds.min[1],b.type==='landmark'?b.vy*VOXEL.SIZE:Infinity,...[[0,0],[b.w,0],[0,b.d],[b.w,b.d]].map(([x,z])=>voxels.terrainHeightAt(b.x+x,b.z+z)))-VOXEL.SIZE;
    this.pending.set(key,{min:[b.x-margin,Math.min(bottom,previous?.min[1]??Infinity),b.z-margin],max:[b.x+b.w+margin,(b.vy+b.vh)*VOXEL.SIZE+Math.max(b.w,b.d)*Math.max(...BUILDINGS.ROOF_PITCH),b.z+b.d+margin]});
   }
   if(!e.collapse)for(const p of this.stairs){
    if(this.pending.size>=C.PENDING)break;
    const s=VOXEL.SIZE,margin=SEWER.STAIR_DOOR_CELLS,bounds={min:[(p.ox-margin)*s,(p.floor-1)*s,(p.oz-margin)*s],max:[(p.ox+p.n+margin)*s,(p.top+1)*s,(p.oz+p.n+margin)*s]};
    if(bounds.min.some((v,i)=>v>e.bounds.max[i])||bounds.max.some((v,i)=>v<e.bounds.min[i]))continue;
    this.pending.set(`sewer:${p.ox},${p.oz}`,bounds);
   }
   if(e.cells)this.gather(e.cells);
  });
  eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.fragments.find(p=>p.id===id);if(p){p.attached=true;eventBus.emit(Events.PROP_SUSPEND,{id});}});
  eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{const p=this.fragments.find(p=>p.id===id);if(p){p.attached=false;p.life=C.SECTION_LIFE;p.mesh.position.set(position.x,ground+p.half[1],position.z);eventBus.emit(Events.PROP_RELEASE,{id,position:p.mesh.position});}});
 }
 gather(cells){
  const step=C.SECTION_CELLS*VOXEL.SIZE;
  for(const cell of cells){
   if(cell.mat===GLAZING.MATERIAL_ID||(cell.mat!==SEWER.WALKWAY_MATERIAL&&cell.y<=this.voxels.terrainHeightAt(cell.x,cell.z)+VOXEL.SIZE))continue;
   const key=`${Math.floor(cell.x/step)},${Math.floor(cell.y/step)},${Math.floor(cell.z/step)}`;
   let list=this.pieces.get(key);if(!list){if(this.pieces.size>=C.PENDING)continue;list=[];this.pieces.set(key,list);}if(list.length<C.SECTION_VOXELS)list.push(cell);
  }
 }
 update(dt){
  // Nearby cave-ins must not wait behind a larger structure at the edge of a wide crater.
  const distance=b=>Math.hypot((b.min[0]+b.max[0])/2-this.jimothy.position.x,(b.min[2]+b.max[2])/2-this.jimothy.position.z);
  for(const [key,bounds]of [...this.pending].sort((a,b)=>distance(a[1])-distance(b[1]))){
   const active=this.voxels.damageQueue.filter(j=>j.kind==='support').length;if(active>=C.ACTIVE)break;
   if(!this.footprintLoaded(bounds))continue;
   if(this.voxels.queueSupport(bounds,key))this.pending.delete(key);break;
  }
  for(const p of [...this.fragments])if(!p.attached){p.life-=dt;if(p.life<=0||p.mesh.position.distanceTo(this.jimothy.position)>Layout.Masterplan.BOUNDS)this.remove(p);}
  const first=this.pieces.entries().next().value;if(first){this.pieces.delete(first[0]);this.spawn(first[1]);}
 }
 footprintLoaded(bounds){
  // A partially streamed building must not lose a support that has yet to load.
  const span=VOXEL.SIZE*VOXEL.CHUNK_XZ;
  for(let x=Math.floor(bounds.min[0]/span);x<=Math.floor(bounds.max[0]/span);x++)for(let z=Math.floor(bounds.min[2]/span);z<=Math.floor(bounds.max[2]/span);z++)if(!this.voxels.isLoadedAtWorld((x+.5)*span,(z+.5)*span))return false;
  return true;
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
  const p={id:`structure-piece:${this.serial++}`,kind:'building',mesh,half:half.toArray(),size:Math.max(half.x,half.y,half.z)*2,mass:Math.max(C.SECTION_MASS_MIN,Math.min(C.SECTION_MASS_MAX,cells.length*VOXEL.SIZE**3*C.SECTION_DENSITY)),shapes:rubbleBoxes(cells,center),spawnSafe:true,loose:true,attached:false,life:C.SECTION_LIFE};
  this.fragments.push(p);eventBus.emit(Events.PROP_CREATE,p);eventBus.emit(Events.ENTITY_REGISTER,p);
  eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity:[0,-C.SECTION_DROP,0],spin:Math.sin(this.serial)*C.SECTION_SPIN});
 }
 key(x,y,z){return `${Math.round(x/VOXEL.SIZE-.5)},${Math.round(y/VOXEL.SIZE-.5)},${Math.round(z/VOXEL.SIZE-.5)}`;}
 remove(p){eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});eventBus.emit(Events.PROP_REMOVE,{id:p.id});p.mesh.removeFromParent();p.mesh.geometry.dispose();this.fragments.splice(this.fragments.indexOf(p),1);}
 reset(){for(const p of [...this.fragments])this.remove(p);this.pending.clear();this.pieces.clear();this.serial=0;}
 snapshot(){return {pending:this.pending.size,pieces:this.pieces.size,fragments:this.fragments.length,attached:this.fragments.filter(p=>p.attached).length};}
}
