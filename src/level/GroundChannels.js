import * as THREE from 'three';
import {GroundChannelField,groundChannelShader} from '../core/GroundChannelField.js';
import {GROUND_CHANNEL as C,VOXEL} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';

export class GroundChannels {
 constructor(scene,jimothy,voxels){
  this.jimothy=jimothy;this.voxels=voxels;this.field=new GroundChannelField((x,z)=>voxels.terrainHeightAt(x,z));voxels.channels=this.field;
  this.texture=new THREE.DataTexture(this.field.data,C.FIELD_TEXTURE,C.FIELD_TEXTURE,THREE.RedFormat,THREE.FloatType);
  this.uniforms={channelMap:{value:this.texture},channelOrigin:{value:new THREE.Vector2()},channelDirt:{value:new THREE.Color(VOXEL.MATERIALS[C.DIRT_MATERIAL].color)}};
  this.bind(voxels.material);this.depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});this.bind(this.depth,true);
  voxels.renderBatches.depthMaterial=this.depth;for(const b of voxels.renderBatches.banks)b.mesh.customDepthMaterial=this.depth;
  this.field.centerAt(jimothy.position.x,jimothy.position.z);this.sync();
  this.dust=[];this.clods=[];this.serial=0;this.pose=new THREE.Object3D();
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(C.DUST_COUNT*3),3));geo.setAttribute('opacity',new THREE.BufferAttribute(new Float32Array(C.DUST_COUNT),1));
  const mat=new THREE.PointsMaterial({color:C.DUST_COLOR,size:C.DUST_SIZE,transparent:true,depthWrite:false});
  mat.onBeforeCompile=s=>{s.vertexShader='attribute float opacity; varying float dustAlpha;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndustAlpha=opacity;');s.fragmentShader='varying float dustAlpha;\n'+s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat r=length(gl_PointCoord-.5)*2.;diffuseColor.a*=dustAlpha*(1.-smoothstep(.15,1.,r));');};
  this.cloud=new THREE.Points(geo,mat);this.cloud.frustumCulled=false;geo.setDrawRange(0,0);scene.add(this.cloud);
  this.chunks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(C.CLOD_SIZE,0),new THREE.MeshStandardMaterial({color:VOXEL.MATERIALS[C.DIRT_MATERIAL].color}),C.CLOD_COUNT);this.chunks.count=0;this.chunks.frustumCulled=false;this.chunks.castShadow=true;scene.add(this.chunks);
 }
 bind(material,depth=false){
  const previous=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
   previous.call(material,shader);Object.assign(shader.uniforms,this.uniforms);
   shader.vertexShader=shader.vertexShader.replace('if(sandWeight>.5)transformed.y+=sandOffset(position.xz);','if(sandWeight>.5&&abs(channelOffset(position.xz))<.0001)transformed.y+=sandOffset(position.xz);');
   shader.vertexShader=groundChannelShader()+'attribute float terrainWeight; varying vec3 channelPoint; varying float channelMask;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    channelPoint=position;channelMask=terrainWeight;if(terrainWeight>.5)transformed.y+=channelOffset(position.xz);`);
   if(!depth){
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
     if(terrainWeight>.5){float e=${C.FIELD_CELL.toFixed(8)};objectNormal=normalize(objectNormal+vec3(-(channelOffset(position.xz+vec2(e,0.))-channelOffset(position.xz-vec2(e,0.)))/(2.*e),0.,-(channelOffset(position.xz+vec2(0.,e))-channelOffset(position.xz-vec2(0.,e)))/(2.*e)));}`);
    shader.fragmentShader=groundChannelShader()+'uniform vec3 channelDirt; varying vec3 channelPoint; varying float channelMask;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
     if(channelMask>.5){float cut=channelOffset(channelPoint.xz),grain=fract(sin(dot(floor(channelPoint.xz*${C.DIRT_GRAIN_SCALE.toFixed(4)}),vec2(127.1,311.7)))*43758.5453);
     diffuseColor.rgb=mix(diffuseColor.rgb,channelDirt*(1.+(grain-.5)*${C.DIRT_GRAIN.toFixed(4)}),smoothstep(0.,${C.DIRT_REVEAL.toFixed(4)},abs(cut)));}`);
   }
  };material.customProgramCacheKey=()=>cacheKey+'-crash-furrow';material.needsUpdate=true;
 }
 update(dt){
  const j=this.jimothy.position;this.field.centerAt(j.x,j.z);this.field.update();this.voxels.removedCount+=this.field.removed;
  if(this.field.removed)eventBus.emit(Events.WORLD_DEMOLISHED,{voxels:this.field.removed,x:j.x,z:j.z,bounds:this.field.bounds,groundOnly:true});this.sync();this.effects(dt);
 }
 effects(dt){
  for(let i=0;i<Math.min(C.DUST_PER_FRAME,this.field.changed.length);i++){
   const p=this.field.changed[Math.floor(i*this.field.changed.length/C.DUST_PER_FRAME)],a=this.serial++*Math.PI*(3-Math.sqrt(5)),d=Math.hypot(p.dx,p.dz)||1,dx=p.dx/d,dz=p.dz/d;
   if(this.dust.length<C.DUST_COUNT)this.dust.push({x:p.x,y:p.y,z:p.z,vx:dx*C.DUST_SPEED,vz:dz*C.DUST_SPEED,life:C.DUST_LIFE});
   if(this.clods.length<C.CLOD_COUNT)this.clods.push({x:p.x,y:p.y,z:p.z,vx:dx*C.CLOD_SPEED,vz:dz*C.CLOD_SPEED,vy:C.CLOD_LIFT,life:C.CLOD_LIFE,a});
  }
  this.dust=this.dust.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=C.DUST_RISE*dt;return p.life>0;});
  const pos=this.cloud.geometry.attributes.position,opacity=this.cloud.geometry.attributes.opacity;
  this.dust.forEach((p,i)=>{pos.setXYZ(i,p.x,p.y,p.z);opacity.setX(i,C.DUST_OPACITY*p.life/C.DUST_LIFE);});pos.needsUpdate=opacity.needsUpdate=true;this.cloud.geometry.setDrawRange(0,this.dust.length);
  this.clods=this.clods.filter(p=>{p.life-=dt;p.vy-=C.CLOD_GRAVITY*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;return p.life>0&&p.y>this.voxels.terrainHeightAt(p.x,p.z)+this.field.sample(p.x,p.z);});
  this.clods.forEach((p,i)=>{this.pose.position.set(p.x,p.y,p.z);this.pose.rotation.set(p.a+p.life,p.a,p.life);this.pose.scale.setScalar(p.life/C.CLOD_LIFE);this.pose.updateMatrix();this.chunks.setMatrixAt(i,this.pose.matrix);});this.chunks.count=this.clods.length;this.chunks.instanceMatrix.needsUpdate=true;
 }
 sync(){if(this.version!==this.field.version){this.version=this.field.version;this.texture.needsUpdate=true;this.uniforms.channelOrigin.value.set(this.field.x,this.field.z);}}
 reset(){this.field.reset();this.dust=[];this.clods=[];this.chunks.count=0;this.cloud.geometry.setDrawRange(0,0);this.sync();}
 snapshot(){return {cells:this.field.cells,pending:this.field.pending.length,work:this.field.work,dust:this.dust.length,clods:this.clods.length};}
}
