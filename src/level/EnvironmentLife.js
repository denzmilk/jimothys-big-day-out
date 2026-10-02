import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {ENVIRONMENT as C} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';
import * as Layout from './Layout.js';
const hash=(x,z)=>{let h=(Math.imul(x,374761393)^Math.imul(z,668265263))>>>0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};

export class EnvironmentLife {
 constructor(scene,jimothy,voxels){
  this.scene=scene;this.jimothy=jimothy;this.voxels=voxels;this.ready=false;this.time=0;this.plants=[];this.animals=[];this.batches=[];this.flattened=new Set();this.center=null;
  this.wind=new THREE.Vector2();this.uniforms={lifeTime:{value:0},lifeWind:{value:this.wind},lifePlayer:{value:new THREE.Vector3()},lifeRadius:{value:1}};
  this.matrix=new THREE.Object3D();
  const loader=new GLTFLoader(),base=import.meta.env.BASE_URL+'assets/models/';
  this.loading=Promise.all([...C.PLANTS.map(n=>loader.loadAsync(base+'nature/'+n+'.glb')),...C.ANIMALS.map(n=>loader.loadAsync(base+'wildlife/'+n+'.glb'))]).then(models=>{
   this.models=models.slice(C.PLANTS.length);
   models.slice(0,C.PLANTS.length).forEach((g,index)=>{
    g.scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(g.scene),height=box.max.y-box.min.y,scale=C.PLANT_HEIGHT[index]/height;
    g.scene.traverse(o=>{if(!o.isMesh)return;
     const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);geo.translate(0,-box.min.y,0);geo.scale(scale,scale,scale);
     const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.clone());
     for(const material of materials){material.side=THREE.DoubleSide;if(index<2)material.color.multiply(new THREE.Color(C.GRASS_TINT));
     material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.uniforms);
      shader.vertexShader='uniform float lifeTime,lifeRadius;uniform vec2 lifeWind;uniform vec3 lifePlayer;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
       vec3 root=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
       vec2 away=root.xz-lifePlayer.xz;float proximity=(1.-smoothstep(0.,lifeRadius,length(away)))*(1.-step(${C.TRAMPLE_HEIGHT.toFixed(2)},abs(root.y-lifePlayer.y)));
       float gust=sin(lifeTime*${C.GUST_HZ.toFixed(2)}+root.x*.17+root.z*.13)*.5+.5;
       vec3 bend=vec3(lifeWind.x,0.,lifeWind.y)*(gust+.3)+vec3(away.x,0.,away.y)/max(.1,length(away))*proximity*${C.BEND.toFixed(2)};
       vec3 localBend=vec3(dot(instanceMatrix[0].xyz,bend),dot(instanceMatrix[1].xyz,bend),dot(instanceMatrix[2].xyz,bend))/max(.01,dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz));
       transformed+=localBend*position.y*position.y;
      `);
     };
     material.customProgramCacheKey=()=>`living-foliage-${index}`;
     }
     const mesh=new THREE.InstancedMesh(geo,Array.isArray(o.material)?materials:materials[0],C.PLANT_LIMIT);mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;this.scene.add(mesh);this.batches.push({index,mesh,items:[]});
    });
   });
   this._particles();this.ready=true;this.reset();
  }).catch(e=>console.error('Environment assets failed',e));
  eventBus.on(Events.WORLD_IMPACT,h=>{
   for(const p of this.plants)if(Math.hypot(p.x-h.x,p.y-h.y,p.z-h.z)<h.radius){this.flattened.add(p.key);p.flat=1;}
   for(const a of this.animals)if(a.mesh.position.distanceTo(new THREE.Vector3(h.x,h.y,h.z))<h.radius+C.FLEE_RADIUS)a.flee=C.FLEE_SECONDS;
  });
 }
 _clear(x,z){
  const cls=Layout.Masterplan.classAt(x,z),K=Layout.Masterplan.CLASS;
  return (cls===K.LAND||cls===K.PARK)&&!this.buildings.some(b=>x>b.x-C.WALL_GAP&&x<b.x+b.w+C.WALL_GAP&&z>b.z-C.WALL_GAP&&z<b.z+b.d+C.WALL_GAP);
 }
 _populate(){
  const j=this.jimothy.position,R=C.RADIUS,S=C.GRID;this.center={x:j.x,z:j.z};this.plants=[];
  this.buildings=Layout.Masterplan.buildingsIn(j.x-R,j.z-R,j.x+R,j.z+R);
  for(let iz=Math.floor((j.z-R)/S);iz<Math.ceil((j.z+R)/S);iz++)for(let ix=Math.floor((j.x-R)/S);ix<Math.ceil((j.x+R)/S);ix++){
   const h=hash(ix,iz),x=(ix+h)*S,z=(iz+hash(iz,ix))*S;
   if(this.plants.length>=C.PLANT_LIMIT||Math.hypot(x-j.x,z-j.z)>R||!this._clear(x,z))continue;
   const y=this.voxels.terrainHeightAt(x,z),key=`${ix},${iz}`;
   const kind=h<C.GRASS_SHARE?(h<C.GRASS_SHARE/2?0:1):2+Math.min(C.PLANTS.length-3,Math.floor((h-C.GRASS_SHARE)/(1-C.GRASS_SHARE)*(C.PLANTS.length-2)));
   this.plants.push({x,y,z,key,kind,yaw:h*Math.PI*2,scale:C.SCALE_MIN+h*C.SCALE_RANGE,flat:this.flattened.has(key)?1:0});
  }
  for(const b of this.batches){b.items=this.plants.filter(p=>p.kind===b.index);b.mesh.count=b.items.length;}
  // Keep neighbours across window shifts: replacing them here cancels a flee
  // just when Jimothy approaches the edge of the vegetation window (M30).
  this.animals=this.animals.filter(a=>{if(Math.hypot(a.mesh.position.x-j.x,a.mesh.position.z-j.z)<=R)return true;this._removeAnimal(a);return false;});
  for(let i=this.animals.length;i<C.ANIMAL_COUNT&&this.plants.length;i++){
   const p=this.plants[Math.floor(hash(i,Math.floor(j.x))*this.plants.length)],index=i%C.ANIMALS.length,source=this.models[index],visual=clone(source.scene),mesh=new THREE.Group();
   const box=new THREE.Box3().setFromObject(visual),size=box.getSize(new THREE.Vector3());
   const scale=C.ANIMAL_SIZE[index]/(index===2?Math.max(size.x,size.z):size.y);visual.scale.multiplyScalar(scale);visual.position.y-=box.min.y*scale;visual.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});mesh.add(visual);mesh.position.set(p.x,p.y+(index===2?C.BIRD_HEIGHT:0),p.z);this.scene.add(mesh);
   const mixer=new THREE.AnimationMixer(visual),actions={};for(const c of source.animations)actions[c.name]=mixer.clipAction(c);
   this.animals.push({mesh,visual,mixer,actions,kind:C.ANIMALS[index],bird:index===2,home:{x:p.x,z:p.z},heading:hash(i,7)*Math.PI*2,flee:0,phase:i,animation:null});
  }
 }
 _removeAnimal(a){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.visual);a.visual.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});a.mesh.removeFromParent();}
 _particles(){
  const geometry=new THREE.BufferGeometry();this.particlePositions=new Float32Array(C.PARTICLE_COUNT*3);geometry.setAttribute('position',new THREE.BufferAttribute(this.particlePositions,3));
  this.particles=new THREE.Points(geometry,new THREE.PointsMaterial({color:C.PARTICLE_COLOR,size:C.PARTICLE_SIZE,transparent:true,opacity:C.PARTICLE_OPACITY,depthWrite:false}));
  this.particles.frustumCulled=false;this.scene.add(this.particles);
 }
 update(dt){
  if(!this.ready||!gameState.game.isPlaying)return;this.time+=dt;
  const j=this.jimothy.position;
  if(!this.center||Math.hypot(j.x-this.center.x,j.z-this.center.z)>C.REFRESH)this._populate();
  this.wind.set(C.WIND_X*(1+C.GUST*Math.sin(this.time*C.GUST_HZ)),C.WIND_Z*(1+C.GUST*Math.cos(this.time*C.GUST_HZ)));
  gameState.world.wind=[this.wind.x,this.wind.y];this.uniforms.lifeTime.value=this.time;this.uniforms.lifePlayer.value.copy(j);this.uniforms.lifeRadius.value=this.jimothy.radius+C.BEND_RADIUS;
  this.bent=0;
  for(const p of this.plants){
   const near=Math.hypot(p.x-j.x,p.z-j.z)<this.uniforms.lifeRadius.value&&Math.abs(p.y-j.y)<C.TRAMPLE_HEIGHT;
   if(near){this.bent++;if(this.jimothy.move?.kind==='roll')p.flat=1;}
   if(!this.flattened.has(p.key))p.flat=Math.max(0,p.flat-dt/C.REBOUND_SECONDS);
  }
  for(const b of this.batches){b.items.forEach((p,i)=>{
   this.matrix.position.set(p.x,p.y,p.z);this.matrix.rotation.set(0,p.yaw,0);this.matrix.scale.set(p.scale,p.scale*(1-p.flat*C.FLATTEN),p.scale);this.matrix.updateMatrix();b.mesh.setMatrixAt(i,this.matrix.matrix);
  });b.mesh.instanceMatrix.needsUpdate=true;}
  for(const a of this.animals){
   const p=a.mesh.position,dx=p.x-j.x,dz=p.z-j.z,dist=Math.hypot(dx,dz);
   if(dist<C.FLEE_RADIUS)a.flee=C.FLEE_SECONDS;else a.flee=Math.max(0,a.flee-dt);
   a.phase+=dt;const alarm=a.flee>0;
   if(alarm)a.heading=Math.atan2(dx,dz);else a.heading+=Math.sin(a.phase*C.WANDER_HZ)*dt*C.TURN_RATE;
   const speed=alarm?C.FLEE_SPEED:a.bird?C.BIRD_SPEED:C.WALK_SPEED;
   const nx=p.x+Math.sin(a.heading)*speed*dt,nz=p.z+Math.cos(a.heading)*speed*dt;
   if(a.bird||this._clear(nx,nz)){
    const ground=this.voxels.terrainHeightAt(nx,nz);
    if(a.bird||Math.abs(ground-p.y)<C.MAX_STEP){p.x=nx;p.z=nz;p.y=a.bird?Math.max(p.y,ground+C.BIRD_HEIGHT):ground;}else a.heading+=Math.PI/2;
   }else a.heading+=Math.PI/2;
   if(Math.hypot(p.x-a.home.x,p.z-a.home.z)>C.ROAM_RADIUS&&!alarm)a.heading=Math.atan2(a.home.x-p.x,a.home.z-p.z);
   if(a.bird)p.y+=Math.sin(a.phase)*dt*C.BIRD_BOB;
   a.mesh.rotation.y=a.heading;
   const name=a.bird?'Flying':'Walking';if(a.animation!==name){a.actions[a.animation]?.stop();a.actions[name]?.play();a.animation=name;}
   a.mixer.update(dt*(alarm?C.RUN_RATE:1));
  }
  for(let i=0;i<C.PARTICLE_COUNT;i++){
   const x=j.x+(((hash(i,1)*C.PARTICLE_SPAN+this.time*this.wind.x)%C.PARTICLE_SPAN+C.PARTICLE_SPAN)%C.PARTICLE_SPAN)-C.PARTICLE_SPAN/2;
   const z=j.z+(((hash(i,2)*C.PARTICLE_SPAN+this.time*this.wind.y)%C.PARTICLE_SPAN+C.PARTICLE_SPAN)%C.PARTICLE_SPAN)-C.PARTICLE_SPAN/2;
   this.particlePositions.set([x,j.y+C.PARTICLE_BASE+hash(i,3)*C.PARTICLE_HEIGHT+Math.sin(this.time+ i)*C.PARTICLE_BOB,z],i*3);
  }
  this.particles.geometry.attributes.position.needsUpdate=true;
 }
 reset(){for(const a of this.animals)this._removeAnimal(a);this.animals=[];this.time=0;this.flattened.clear();this.center=null;if(this.ready)this.update(0);}
 snapshot(){return {ready:this.ready,plants:this.plants.length,flowers:this.plants.filter(p=>p.kind>=2&&p.kind<=4).length,animals:this.animals.length,animalTypes:[...new Set(this.animals.map(a=>a.kind))],bent:this.bent||0,flattened:this.flattened.size,wind:this.wind.toArray(),particles:this.ready?C.PARTICLE_COUNT:0};}
}
