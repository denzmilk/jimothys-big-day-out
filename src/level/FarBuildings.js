import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {VoxelBatches} from '../core/VoxelBatches.js';
import {BUILDINGS as C,VOXEL,VOXEL_BATCH,LOD_BUILDINGS as L} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import * as Layout from './Layout.js';

export class FarBuildings {
 constructor(scene,coverage){
  this.entries=[];this.damaged=new Set();this.grid=new Map();this.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
  this.material.onBeforeCompile=shader=>{
   shader.uniforms.columnCoverage={value:coverage.texture};shader.uniforms.coverageGrid={value:new THREE.Vector3(coverage.origin,coverage.size,coverage.columnSize)};
   shader.vertexShader='varying vec3 lodPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlodPosition=position;');
   shader.fragmentShader='varying vec3 lodPosition;uniform sampler2D columnCoverage;uniform vec3 coverageGrid;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    vec2 uv=(floor(lodPosition.xz/coverageGrid.z)-coverageGrid.x+.5)/coverageGrid.y;
    if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThan(uv,vec2(1.)))&&texture2D(columnCoverage,uv).r>.5)discard;`);
  };
  this.material.customProgramCacheKey=()=> 'distant-building-coverage';this.batches=new VoxelBatches(scene,[this.material],{...VOXEL_BATCH,VERTICES:L.BATCH_VERTICES,INSTANCES:L.BATCH_INSTANCES});
  const B=Layout.Masterplan.BOUNDS,buildings=Layout.buildingsIntersecting(-B,-B,B,B);
  for(const b of buildings){const entry={building:b,id:this.entries.length,box:new THREE.Box3()};const geo=this.geometry(b);geo.computeBoundingBox();entry.box.copy(geo.boundingBox);geo.clearGroups();geo.addGroup(0,geo.getAttribute('position').count,0);this.batches.set(entry,geo);geo.dispose();this.entries.push(entry);
   for(let x=Math.floor(entry.box.min.x/L.CELL);x<=Math.floor(entry.box.max.x/L.CELL);x++)for(let z=Math.floor(entry.box.min.z/L.CELL);z<=Math.floor(entry.box.max.z/L.CELL);z++){const key=`${x},${z}`;if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(entry);}
  }
  for(const bank of this.batches.banks){bank.mesh.castShadow=false;bank.mesh.receiveShadow=false;bank.mesh.userData.farDetail=true;}
  eventBus.on(Events.WORLD_DEMOLISHED,e=>this.damage(e));
 }
 geometry(b){
  const s=VOXEL.SIZE,front=b.front||0,rotated=front%2,w=(rotated?b.vd:b.vw)*s,d=(rotated?b.vw:b.vd)*s,h=b.vh*s,home=b.type==='craftsman'||b.type==='shed',porch=b.type==='craftsman'?C.PORCH_DEPTH:0;
  const wall=home?C.PALETTE[b.palette||0]:b.type==='warehouse'?6:3,roof=C.ROOFS[(b.palette||0)%C.ROOFS.length],pieces=[];
  const add=(geo,mat)=>{const color=new THREE.Color(VOXEL.MATERIALS[mat].color),colors=new Float32Array(geo.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3)color.toArray(colors,i);geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.deleteAttribute('uv');pieces.push(geo);};
  const box=(sx,sy,sz,x,y,z,mat)=>{const geo=new THREE.BoxGeometry(sx,sy,sz).toNonIndexed();geo.translate(x,y,z);add(geo,mat);};
  const base=Math.min(...[[0,0],[b.w,0],[0,b.d],[b.w,b.d]].map(([x,z])=>Layout.terrain.surfaceHeight(b.x+x,b.z+z))),foundation=Math.max(0,b.vy*s-base);
  if(foundation)box(w,foundation,d,w/2,-foundation/2,d/2,6);
  box(w,h,d-porch,w/2,h/2,(d+porch)/2,wall);
  const quad=(a,b,c,d,mat)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3));geo.computeVertexNormals();add(geo,mat);};
  if(home){
   const hip=b.style===2?Math.min(w/2,(d-porch)/2):0,rise=(hip||w/2)*C.ROOF_PITCH[b.style||0];
   const a=[0,h,porch],b0=[w,h,porch],c=[w,h,d],d0=[0,h,d],r0=[w/2,h+rise,porch+hip],r1=[w/2,h+rise,d-hip];
   quad(a,d0,r1,r0,roof);quad(r0,r1,c,b0,roof);quad(a,r0,b0,b0,hip?roof:wall);quad(c,r1,d0,d0,hip?roof:wall);
   if(porch){box(C.PORCH_WIDTH,L.ROOF_THICKNESS,porch,w/2,C.PORCH_HEIGHT,porch/2,roof);box(C.TRIM,C.PORCH_HEIGHT,C.TRIM,w/2-C.PORCH_WIDTH/2,C.PORCH_HEIGHT/2,C.TRIM/2,13);box(C.TRIM,C.PORCH_HEIGHT,C.TRIM,w/2+C.PORCH_WIDTH/2,C.PORCH_HEIGHT/2,C.TRIM/2,13);}
  }else box(w,L.ROOF_THICKNESS,d,w/2,h+L.ROOF_THICKNESS/2,d/2,roof);
  // Flat panes keep the distant silhouette readable without glass passes.
  for(let y=C.WINDOW_SILL;y+C.WINDOW_HEIGHT<h;y+=C.STOREY)for(let x=C.WINDOW_SPACING/2;x+C.WINDOW_WIDTH/2<w;x+=C.WINDOW_SPACING){
   const x0=x-C.WINDOW_WIDTH/2,x1=x+C.WINDOW_WIDTH/2,y1=y+C.WINDOW_HEIGHT,z0=porch-L.WINDOW_THICKNESS,z1=d+L.WINDOW_THICKNESS;
   quad([x0,y,z0],[x0,y1,z0],[x1,y1,z0],[x1,y,z0],4);quad([x1,y,z1],[x1,y1,z1],[x0,y1,z1],[x0,y,z1],4);
  }
  for(let y=C.WINDOW_SILL;y+C.WINDOW_HEIGHT<h;y+=C.STOREY)for(let z=porch+C.WINDOW_SPACING/2;z+C.WINDOW_WIDTH/2<d;z+=C.WINDOW_SPACING){
   const z0=z-C.WINDOW_WIDTH/2,z1=z+C.WINDOW_WIDTH/2,y1=y+C.WINDOW_HEIGHT,x0=-L.WINDOW_THICKNESS,x1=w+L.WINDOW_THICKNESS;
   quad([x0,y,z0],[x0,y,z1],[x0,y1,z1],[x0,y1,z0],4);quad([x1,y,z1],[x1,y,z0],[x1,y1,z0],[x1,y1,z1],4);
  }
  let geo=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();
  // Match VoxelCity's four frontage transforms exactly.
  const matrix=new THREE.Matrix4();if(front===1)matrix.makeRotationY(-Math.PI/2).setPosition(b.vw*s,0,0);if(front===2)matrix.makeRotationY(Math.PI).setPosition(b.vw*s,0,b.vd*s);if(front===3)matrix.makeRotationY(Math.PI/2).setPosition(0,0,b.vd*s);
  geo.applyMatrix4(matrix);geo.translate(b.vx*s,b.vy*s,b.vz*s);return geo;
 }
 damage({bounds}){
  if(!bounds)return;const box=new THREE.Box3(new THREE.Vector3(...bounds.min),new THREE.Vector3(...bounds.max)),seen=new Set();
  for(let x=Math.floor(box.min.x/L.CELL);x<=Math.floor(box.max.x/L.CELL);x++)for(let z=Math.floor(box.min.z/L.CELL);z<=Math.floor(box.max.z/L.CELL);z++)for(const entry of this.grid.get(`${x},${z}`)||[]){
   if(seen.has(entry)||!entry.box.intersectsBox(box))continue;seen.add(entry);this.damaged.add(entry.id);for(const item of this.batches.entries.get(entry)||[])if(item)item.bank.mesh.setVisibleAt(item.instance,false);
  }
 }
 reset(){for(const entry of this.entries)if(this.damaged.has(entry.id))for(const item of this.batches.entries.get(entry)||[])if(item)item.bank.mesh.setVisibleAt(item.instance,true);this.damaged.clear();}
 snapshot(){return{buildings:this.entries.length,damaged:this.damaged.size,styles:[...new Set(this.entries.map(e=>`${e.building.type}:${e.building.style}`))],...this.batches.stats()};}
}
