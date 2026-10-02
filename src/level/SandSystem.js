import * as THREE from 'three';
import {BEACH as C,VOXEL} from '../core/Constants.js';
import {SandField,sandShader} from '../core/SandField.js';
import {eventBus,Events} from '../core/EventBus.js';

export class SandSystem {
  constructor(scene,jimothy,voxels){
    this.jimothy=jimothy;this.voxels=voxels;this.clock=0;this.drops=[];this.serial=0;
    this.field=new SandField((x,z)=>!!voxels.terrain?.sandAt?.(x,z));voxels.sand=this.field;
    this.texture=new THREE.DataTexture(this.field.data,C.TEXTURE_SIZE,C.TEXTURE_SIZE,THREE.RedFormat,THREE.FloatType);
    this.uniforms={sandMap:{value:this.texture},sandOrigin:{value:new THREE.Vector2()},sandDry:{value:new THREE.Color(VOXEL.MATERIALS[C.DRY_MATERIAL].color)},sandWet:{value:new THREE.Color(VOXEL.MATERIALS[C.WET_MATERIAL].color)}};
    this.field.centerAt(jimothy.body.position.x,jimothy.body.position.z);
    this.bind(voxels.material);
    this.grains=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(C.GRAIN_SIZE,0),new THREE.MeshStandardMaterial({color:C.GRAIN_COLOR}),C.GRAINS);
    this.grains.count=0;scene.add(this.grains);this.pose=new THREE.Object3D();
    eventBus.on(Events.WORLD_IMPACT,h=>{
      const ground=voxels.terrainHeightAt(h.x,h.z);
      if(Math.abs(h.y-ground)<h.radius&&this.field.stamp(h.x,h.z,h.radius,C.IMPACT_DEPTH))this.scatter(h.x,ground,h.z);
    });
    this.sync();
  }
  bind(material){
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.uniforms);
      shader.vertexShader=`${sandShader()} attribute float sandWeight; varying vec3 sandPoint; varying float sandMask;\n`+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
       if(sandWeight>.5){float e=${C.CELL.toFixed(8)};objectNormal=normalize(objectNormal+vec3(-(sandOffset(position.xz+vec2(e,0.))-sandOffset(position.xz-vec2(e,0.)))/(2.*e),0.,-(sandOffset(position.xz+vec2(0.,e))-sandOffset(position.xz-vec2(0.,e)))/(2.*e)));}`);
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
       sandMask=sandWeight;sandPoint=position;if(sandWeight>.5)transformed.y+=sandOffset(position.xz);`);
      shader.fragmentShader=sandShader()+'uniform vec3 sandDry,sandWet; varying vec3 sandPoint; varying float sandMask;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
       if(sandMask>.5){diffuseColor.rgb=mix(sandWet,sandDry,smoothstep(${C.WET_BLEND_LOW.toFixed(3)},${C.WET_BLEND_HIGH.toFixed(3)},sandPoint.y));diffuseColor.rgb*=1.+sandOffset(sandPoint.xz)/${C.MAX_DEPTH.toFixed(3)}*${C.TRACK_DARKEN.toFixed(3)};float grain=fract(sin(dot(floor(sandPoint.xz*${C.NOISE_SCALE.toFixed(1)}),vec2(127.1,311.7)))*43758.5453);diffuseColor.rgb*=1.+(grain-.5)*${C.NOISE_STRENGTH.toFixed(4)};}`);
    };
    material.customProgramCacheKey=()=> 'sand-compaction-v1';material.needsUpdate=true;
  }
  scatter(x,y,z){for(let i=0;i<C.GRAINS_PER_STAMP;i++){
    if(this.drops.length>=C.GRAINS)break;const a=this.serial++*Math.PI*(3-Math.sqrt(5));
    this.drops.push({x,y,z,vx:Math.sin(a)*C.GRAIN_SPEED,vz:Math.cos(a)*C.GRAIN_SPEED,vy:C.GRAIN_LIFT,life:C.GRAIN_LIFE});
  }}
  update(dt){
    const j=this.jimothy,p=j.body.position;this.field.centerAt(p.x,p.z);this.clock+=dt;
    if(j.grounded&&j.speed>C.MIN_SPEED&&!j.swimming&&this.clock>=C.FOOT_INTERVAL){
      this.clock=0;
      if(j.move?.kind==='roll'){
        if(this.field.stamp(p.x,p.z,Math.max(C.FOOT_RADIUS,j.radius),C.ROLL_DEPTH))this.scatter(p.x,p.y-j.radius,p.z);
      }else for(const foot of j.legs.snapshot())if(foot.stance&&this.field.stamp(foot.x,foot.z,C.FOOT_RADIUS,C.FOOT_DEPTH))this.scatter(foot.x,foot.y,foot.z);
    }
    this.field.update(dt);this.sync();
    this.drops=this.drops.filter(p=>{p.life-=dt;if(p.life<=0)return false;p.vy-=C.GRAVITY*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;return p.y>this.voxels.terrainHeightAt(p.x,p.z)+this.field.sample(p.x,p.z);});
    this.grains.count=this.drops.length;
    this.drops.forEach((p,i)=>{this.pose.position.set(p.x,p.y,p.z);this.pose.scale.setScalar(p.life/C.GRAIN_LIFE);this.pose.updateMatrix();this.grains.setMatrixAt(i,this.pose.matrix);});
    this.grains.instanceMatrix.needsUpdate=true;if(this.grains.count)this.grains.computeBoundingSphere();
  }
  sync(){if(this.version!==this.field.version){this.version=this.field.version;this.texture.needsUpdate=true;this.uniforms.sandOrigin.value.set(this.field.x,this.field.z);}}
  reset(){this.field.reset();this.drops=[];this.grains.count=0;this.clock=0;this.sync();}
  snapshot(){return{cells:this.field.cells.size,pending:this.field.pending.length,stamps:this.field.stamps,work:this.field.lastWork,grains:this.drops.length};}
}
