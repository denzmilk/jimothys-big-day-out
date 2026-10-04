import * as THREE from 'three';
import {TOOLS as C} from './Constants.js';

// M64 keeps collision endpoints and the rendered paths in one owner. A large
// cone drawn independently of targeting could spray visibly through a wall.
export class ToolFlow {
 constructor(scene,voxels,entities){
  Object.assign(this,{scene,voxels,entities});this.time=0;this.life=0;this.paths=[];this.particles=[];this.origin=new THREE.Vector3();this.direction=new THREE.Vector3(0,0,1);this.profile=null;this.tool=null;this.blockedMuzzle=false;
  this.dummy=new THREE.Object3D();this.yAxis=new THREE.Vector3(0,1,0);this.zAxis=new THREE.Vector3(0,0,1);
  const tube=new THREE.CylinderGeometry(1,1,1,C.FLOW_TUBE_SEGMENTS),sphere=new THREE.SphereGeometry(1,...C.FLOW_SPHERE_SEGMENTS);
  this.beam=new THREE.Mesh(tube,new THREE.MeshBasicMaterial({color:C.FLOW_CORE_COLOR,transparent:true,opacity:C.FLOW_TUBE_OPACITY,depthWrite:false}));
  const pixels=new Uint8Array(C.FLOW_TEXTURE_SIZE*4);for(let i=0;i<C.FLOW_TEXTURE_SIZE;i++){pixels.fill(255,i*4,i*4+3);pixels[i*4+3]=Math.round(255*(C.FLOW_WAVE_BASE+(1-C.FLOW_WAVE_BASE)*Math.sin(i/C.FLOW_TEXTURE_SIZE*Math.PI*2)**2));}
  this.waterTexture=new THREE.DataTexture(pixels,1,C.FLOW_TEXTURE_SIZE);this.waterTexture.wrapS=this.waterTexture.wrapT=THREE.RepeatWrapping;this.waterTexture.magFilter=this.waterTexture.minFilter=THREE.LinearFilter;this.waterTexture.needsUpdate=true;this.beam.material.map=this.waterTexture;
  this.core=new THREE.Mesh(tube,new THREE.MeshBasicMaterial({color:C.FLOW_CORE_COLOR}));
  this.rings=new THREE.InstancedMesh(new THREE.TorusGeometry(1,C.FLOW_SKIN,...C.FLOW_RING_SEGMENTS,C.FLOW_ARC),new THREE.MeshBasicMaterial({transparent:true,opacity:C.FLOW_RING_OPACITY,depthWrite:false}),C.FLOW_RINGS);
  this.mist=new THREE.InstancedMesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{opacity:{value:C.FLOW_MIST_OPACITY},edge:{value:C.FLOW_MIST_EDGE},tint:{value:new THREE.Color(C.FLOW_CORE_COLOR)}},
   vertexShader:`varying vec2 vUv;
    void main(){vUv=uv;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);
     vec2 scale=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
     center.xy+=position.xy*scale;gl_Position=projectionMatrix*center;}`,
   fragmentShader:`uniform float opacity;uniform float edge;uniform vec3 tint;varying vec2 vUv;
    void main(){float radius=length(vUv*2.0-1.0);if(radius>=1.0)discard;
     gl_FragColor=vec4(tint,opacity*(1.0-smoothstep(edge,1.0,radius)));
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`}),C.FLOW_MIST_LAYERS);
  this.drops=new THREE.InstancedMesh(sphere,new THREE.MeshBasicMaterial({transparent:true,opacity:C.FLOW_TUBE_OPACITY,depthWrite:false}),C.FLOW_PARTICLES);
  for(const mesh of [this.beam,this.core,this.rings,this.mist,this.drops]){mesh.frustumCulled=false;scene.add(mesh);}this.stop();
 }
 solid(from,to){
  const delta=to.clone().sub(from),length=delta.length();if(!length)return null;delta.divideScalar(length);
  const steps=Math.ceil(length/C.FLOW_STEP);
  for(let i=1;i<=steps;i++){const distance=Math.min(length,i*C.FLOW_STEP),point=from.clone().addScaledVector(delta,distance);if(this.voxels.solidAtWorld(point.x,point.y,point.z))return{distance:Math.max(0,distance-C.FLOW_STEP),point:point.addScaledVector(delta,-C.FLOW_STEP-C.FLOW_SKIN)};}
  return null;
 }
 candidates(origin,range){
  // M65: a dancing/bubbled human still blocks rays. Collection reparents
  // carried meshes away from the scene, so they remain excluded here.
  return [...this.entities()].filter(e=>!e.held&&(!e.attached||e.mesh.parent===this.scene)&&e.mesh.parent&&e.mesh.position.distanceTo(origin)<range+(e.size||0))
   .sort((a,b)=>a.mesh.position.distanceToSquared(origin)-b.mesh.position.distanceToSquared(origin)).slice(0,C.FLOW_CANDIDATES)
   .map(entity=>{const box=new THREE.Box3().setFromObject(entity.mesh);box.expandByScalar(C.FLOW_CONTACT_PAD);return{entity,box};});
 }
 trace(origin,direction,range,candidates){
  const far=origin.clone().addScaledVector(direction,range),solid=this.solid(origin,far);let distance=solid?solid.distance:range,end=solid?solid.point:far,entity=null,hit=solid?'world':null;
  const ray=new THREE.Ray(origin,direction),at=new THREE.Vector3();
  for(const candidate of candidates){if(candidate.box.containsPoint(origin)){distance=0;end=origin.clone();entity=candidate.entity;hit=entity.id;break;}const point=ray.intersectBox(candidate.box,at);if(!point)continue;const d=origin.distanceTo(point);if(d<distance){distance=d;end=point.clone();entity=candidate.entity;hit=entity.id;}}
  return{end,hit,entity,distance};
 }
 prepare(definition,muzzle,direction,body,radius=1,profile=C.FLOW_PROFILES[definition.id]){
  const origin=muzzle.clone(),blocked=this.solid(new THREE.Vector3().copy(body),muzzle),range=definition.range*Math.min(C.SIZE_REACH_MAX,Math.max(1,Math.sqrt(radius)));
  if(blocked){const point=blocked.point;return{profile,origin:point.clone(),direction,blockedMuzzle:true,paths:[{end:point.clone(),hit:'world',entity:null,distance:0}],targets:[]};}
  const candidates=this.candidates(origin,range),paths=[this.trace(origin,direction,range,candidates)],targets=[];
  if(profile.style==='jet'||profile.trace==='ray'){
   const first=paths[0];if(first.entity)targets.push({entity:first.entity,point:first.end,distance:first.distance});
  }else{
   const right=new THREE.Vector3().crossVectors(direction,this.yAxis);if(right.lengthSq()<Number.EPSILON)right.set(1,0,0);right.normalize();const up=new THREE.Vector3().crossVectors(right,direction).normalize(),spread=Math.tan(Math.acos(definition.cone));
   for(let i=1;i<C.FLOW_RAYS;i++){const a=(i-1)*Math.PI*2/(C.FLOW_RAYS-1),ray=direction.clone().addScaledVector(right,Math.cos(a)*spread).addScaledVector(up,Math.sin(a)*spread).normalize();paths.push(this.trace(origin,ray,range,candidates));}
   for(const {entity,box}of candidates){
    if(profile.style==='suction'&&entity.kind!=='food')continue;
    const point=box.getCenter(new THREE.Vector3());if(entity.kind==='food')point.y+=C.SUCTION_CLEARANCE;
    const delta=point.clone().sub(origin),distance=delta.length();if(distance>range||distance<C.FLOW_SKIN||delta.dot(direction)/distance<definition.cone)continue;
    const path=this.trace(origin,delta.normalize(),distance,candidates);
    if(path.hit&&path.entity!==entity)continue;
    path.target=true;paths.push(path);targets.push({entity,point:profile.style==='suction'?entity.mesh.getWorldPosition(new THREE.Vector3()):path.end,distance});if(targets.length>=C.FLOW_TARGETS)break;
   }
  }
  return{profile,origin,direction,blockedMuzzle:false,paths:paths.slice(0,C.FLOW_PATHS),targets};
 }
 apply(plan,definition){this.profile=plan.profile;this.tool=definition.id;this.origin.copy(plan.origin);this.direction.copy(plan.direction);this.paths=plan.paths;this.blockedMuzzle=plan.blockedMuzzle;}
 pulse(plan,definition){
  this.apply(plan,definition);this.life=definition.interval+C.FLOW_FADE;
  const inward=this.profile.style==='suction',style=this.profile.style,color=this.profile.color,foodPaths=this.paths.filter(p=>p.target);
  for(let i=0;i<C.FLOW_PARTICLES_PER_USE&&this.particles.length<C.FLOW_PARTICLES;i++){
   const path=inward&&foodPaths.length?foodPaths[i%foodPaths.length]:this.paths[0];
   const a=(i+this.time)*Math.PI*(3-Math.sqrt(5)),spread=new THREE.Vector3(Math.sin(a),Math.cos(a),Math.sin(a*2));
   const position=(inward?path.end:this.origin).clone();if(inward&&!foodPaths.length)position.copy(this.origin).addScaledVector(this.direction,Math.min(C.FLOW_SUCTION_MISS,path.distance));
   const velocity=inward?this.origin.clone().sub(position).normalize().multiplyScalar(C.FLOW_SUCTION_SPEED):this.direction.clone().multiplyScalar(C.FLOW_PARTICLE_SPEED);
   if(path.hit&&!inward){position.copy(path.end);velocity.multiplyScalar(-1);}
   velocity.addScaledVector(spread,C.FLOW_PARTICLE_SPEED*C.FLOW_SCATTER[style]);this.particles.push({position,velocity,life:C.FLOW_PARTICLE_LIFE,color:style==='gust'?C.FLOW_LEAF_COLORS[i%C.FLOW_LEAF_COLORS.length]:color,size:C.FLOW_PARTICLE_SIZE,style,intake:inward?this.origin.clone():null});
  }
  this.draw();
 }
 follow(plan,definition){this.apply(plan,definition);}
 update(dt){
  this.time+=dt;this.life=Math.max(0,this.life-dt);
  this.particles=this.particles.filter(p=>{p.life-=dt;if(p.life<=0||p.intake&&p.position.distanceTo(p.intake)<p.velocity.length()*dt+C.FLOW_RADIUS)return false;const next=p.position.clone().addScaledVector(p.velocity,dt);if(this.solid(p.position,next))return false;p.position.copy(next);if(!p.intake)p.velocity.y-=C.FLOW_PARTICLE_GRAVITY*dt;return true;});this.draw();
 }
 draw(){
  const active=this.life>0&&!!this.profile,style=this.profile?.style,color=new THREE.Color(this.profile?.color||C.FLOW_CORE_COLOR),first=this.paths[0];
  this.beam.visible=this.core.visible=active&&style==='jet'&&first.distance>C.FLOW_SKIN;
  this.rings.count=this.mist.count=0;
  if(this.beam.visible){
   const delta=first.end.clone().sub(this.origin),length=delta.length(),pulse=1+C.FLOW_WOBBLE*Math.sin(this.time*C.EFFECT_SPEED);
   this.beam.position.copy(this.origin).addScaledVector(delta,.5);this.beam.quaternion.setFromUnitVectors(this.yAxis,delta.normalize());this.beam.scale.set(C.FLOW_RADIUS*pulse,length,C.FLOW_RADIUS*pulse);this.beam.material.color.copy(color);this.core.position.copy(this.beam.position);this.core.quaternion.copy(this.beam.quaternion);this.core.scale.copy(this.beam.scale);this.core.scale.x*=C.FLOW_CORE_SHARE;this.core.scale.z*=C.FLOW_CORE_SHARE;
   this.waterTexture.repeat.y=length*C.FLOW_WAVE_REPEAT;this.waterTexture.offset.y=this.time*C.FLOW_WAVE_SPEED;
  }
  if(active&&style!=='jet'){
   if(style==='foam'){
    this.mist.count=C.FLOW_MIST_LAYERS;
    // A continuous central plume keeps the fan from reading as separate bubbles.
    for(let i=0;i<this.mist.count;i++){const central=i<C.FLOW_MIST_CORE_LAYERS,index=central?i:i-C.FLOW_MIST_CORE_LAYERS,count=central?C.FLOW_MIST_CORE_LAYERS:C.FLOW_MIST_LAYERS-C.FLOW_MIST_CORE_LAYERS,path=central?first:this.paths[(index+1)%this.paths.length],fraction=((index/count+this.time*C.FLOW_RING_SPEED)%1),delta=path.end.clone().sub(this.origin),r=Math.min(C.FLOW_MIST_MAX,C.FLOW_MIST_SIZE+fraction*delta.length()*C.FLOW_MIST_SPREAD,path.hit?Math.max(C.FLOW_SKIN,delta.length()*(1-fraction)):Infinity);
     this.dummy.position.copy(this.origin).addScaledVector(delta,fraction);this.dummy.scale.set(r,r,r);this.dummy.quaternion.identity();this.dummy.updateMatrix();this.mist.setMatrixAt(i,this.dummy.matrix);
    }this.mist.instanceMatrix.needsUpdate=true;this.mist.material.uniforms.tint.value.copy(color);
   }else{
    const drawn=style==='suction'?this.paths.filter(p=>p.target):this.paths,paths=drawn.length?drawn:[first];this.rings.count=C.FLOW_RINGS;
    for(let i=0;i<this.rings.count;i++){const path=paths[i%paths.length],delta=path.end.clone().sub(this.origin);if(style==='suction'&&!path.target)delta.clampLength(0,C.FLOW_SUCTION_MISS);const distance=delta.length();let fraction=(i/C.FLOW_RINGS+this.time*C.FLOW_RING_SPEED)%1;if(style==='suction')fraction=1-fraction;
     const r=Math.min(C.FLOW_RING_MAX,C.FLOW_RING_MIN+distance*fraction*C.FLOW_RING_SPREAD,path.hit?Math.max(C.FLOW_SKIN,distance*(1-fraction)):Infinity);this.dummy.position.copy(this.origin).addScaledVector(delta,fraction);this.dummy.quaternion.setFromUnitVectors(this.zAxis,delta.normalize());this.dummy.rotateZ(this.time*C.FLOW_RING_SPEED+i);this.dummy.scale.setScalar(r);this.dummy.updateMatrix();this.rings.setMatrixAt(i,this.dummy.matrix);this.rings.setColorAt(i,color);
    }this.rings.instanceMatrix.needsUpdate=true;this.rings.instanceColor.needsUpdate=true;
   }
  }
  this.drops.count=this.particles.length;
  this.particles.forEach((p,i)=>{this.dummy.position.copy(p.position);this.dummy.scale.setScalar(p.size*p.life/C.FLOW_PARTICLE_LIFE);this.dummy.quaternion.identity();if(p.style==='gust'){this.dummy.scale.multiply(new THREE.Vector3(...C.FLOW_LEAF_SCALE));this.dummy.rotation.set(this.time*C.FLOW_RING_SPEED+i,i,this.time*C.FLOW_RING_SPEED);}this.dummy.updateMatrix();this.drops.setMatrixAt(i,this.dummy.matrix);this.drops.setColorAt(i,new THREE.Color(p.color));});this.drops.instanceMatrix.needsUpdate=true;if(this.drops.instanceColor)this.drops.instanceColor.needsUpdate=true;
  for(const mesh of [this.rings,this.mist,this.drops])mesh.visible=mesh.count>0;
 }
 stop(){this.life=0;this.particles=[];this.beam.visible=this.core.visible=this.rings.visible=this.mist.visible=this.drops.visible=false;this.rings.count=this.mist.count=this.drops.count=0;}
 reset(){this.stop();this.paths=[];this.profile=null;this.tool=null;this.time=0;this.blockedMuzzle=false;}
 snapshot(){return{tool:this.tool,style:this.profile?.style||null,visible:this.life>0,origin:this.origin.toArray(),direction:this.direction.toArray(),paths:this.paths.map(p=>({end:p.end.toArray(),hit:p.hit})),blockedMuzzle:this.blockedMuzzle,particles:this.particles.length};}
}
