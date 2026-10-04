import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {InstanceBatches} from '../core/InstanceBatches.js';
import {OCEAN as C,TERRAIN,VOXEL,RUBBLE} from '../core/Constants.js';
import {oceanSites,ruinPieces,oceanHash as hash,generateOceanColumn} from './OceanLayout.js';
import * as Terrain from './Terrain.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';
import {FishMotion} from '../core/FishMotion.js';

export class OceanSystem {
 constructor(scene,jimothy,voxels,camera,sky){
  Object.assign(this,{scene,jimothy,voxels,camera,sky});this.sites=oceanSites();this.active=new Set();this.damage=new Set();this.parts=[];this.fish=[];this.plants=[];this.creatures=[];this.bubbles=[];this.time=0;this.streamClock=0;this.bubbleClock=0;this.ventClock=0;this.serial=0;this.ready=false;this.underwater=false;
  this.batches=new InstanceBatches(scene,C.MAX_PARTS+C.PLANT_LIMIT+C.CREATURE_COUNT);this.models={};this.wrecks={};this.pose=new THREE.Object3D();this.fishPoint=new THREE.Vector3();this.fishInverse=new THREE.Quaternion();this.rayForward=new THREE.Vector3();this.color=new THREE.Color();
  const generator=voxels.generator;voxels.generator=function*(world,cx,cz){yield*generator(world,cx,cz);yield*generateOceanColumn(world,cx,cz);};
  const loader=new GLTFLoader(),names=[...C.WRECKS,...C.FISH,'kelp','seagrass','crab','starfish','urn','barrel'];
  this.loading=Promise.all(names.map(async name=>{const g=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/models/ocean/${name}.glb`);this.models[name]=g;if(C.WRECKS.includes(name))this.wrecks[name]=g.scene.children.map((part,i)=>this.preparePart(part,`${name}-${i}`));})).then(()=>{this.makePlants();this.ready=true;}).catch(e=>console.error('Ocean assets failed',e));
  this.makeEffects();this.contactRay=new THREE.Raycaster();
  eventBus.on(Events.SWIM_CONTACT,q=>this.swimContact(q));
  eventBus.on(Events.WORLD_IMPACT,h=>this.impact(h));
  eventBus.on(Events.WORLD_DEMOLISHED,h=>{
   const site=this.sites.find(s=>s.kind==='ruin'&&Math.hypot(s.x-h.x,s.z-h.z)<C.SITE_RADIUS);
   if(site&&h.bounds?.max[1]<TERRAIN.SEA_LEVEL)this.stoneDebris(site,h);
  });
  eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.parts.find(p=>p.id===id);if(!p)return;p.attached=true;this.damage.add(p.id);eventBus.emit(Events.PROP_SUSPEND,{id});});
  eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{const p=this.parts.find(p=>p.id===id);if(!p)return;p.attached=false;p.loose=true;p.life=C.LOOSE_LIFE;p.mesh.position.set(position.x,ground+p.half[1],position.z);eventBus.emit(Events.PROP_RELEASE,{id,position:p.mesh.position});});
 }
 preparePart(source,key){
  source.updateWorldMatrix(true,true);const root=new THREE.Group(),box=new THREE.Box3().setFromObject(source),centre=box.getCenter(new THREE.Vector3()),half=box.getSize(new THREE.Vector3()).multiplyScalar(.5);
  source.traverse(o=>{if(!o.isMesh)return;const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld).translate(-centre.x,-centre.y,-centre.z),m=new THREE.Mesh(geometry,o.material);m.receiveShadow=true;root.add(m);});
  return {root,centre,half,key,name:source.name};
 }
 addPart(template,site,index,kind='wreckage',offset=null){
  const id=`${site.id}:${kind}:${index}`;if(this.damage.has(id)||this.parts.length>=C.MAX_PARTS)return;
  const mesh=template.root.clone(),pose=new THREE.Object3D();pose.position.set(site.x,site.y-site.burial,site.z);pose.rotation.set(site.tilt,site.yaw,site.tilt);pose.updateMatrixWorld();mesh.position.copy(offset||template.centre).applyMatrix4(pose.matrixWorld);mesh.quaternion.copy(pose.quaternion);
  const p={id,site:site.id,kind,key:template.key,mesh,half:template.half.toArray().map(v=>Math.max(C.PART_MIN,v)),loose:false,attached:false,life:C.LOOSE_LIFE};this.parts.push(p);this.scene.add(mesh);
  if(kind==='artifact'){mesh.rotation.set(0,site.yaw,0);mesh.position.y=this.voxels.groundHeightAt(mesh.position.x,mesh.position.z,Terrain.surfaceHeight(mesh.position.x,mesh.position.z)+C.FISH_CLEARANCE)+p.half[1];}
  const volume=p.half.reduce((a,b)=>a*b,8),mass=volume*(kind==='stone'?C.STONE_DENSITY:C.WOOD_DENSITY);
  eventBus.emit(Events.PROP_CREATE,{...p,mass});eventBus.emit(Events.ENTITY_REGISTER,{id,mesh,kind:'ocean-'+kind,size:Math.max(...p.half)*2});return p;
 }
 populateSite(site){
  this.active.add(site.id);
  if(site.kind==='wreck'){
   const templates=this.wrecks[site.family],hull=templates.filter(t=>!t.name.toLowerCase().includes('sail')),missing=hull[site.seed%hull.length],height=Math.max(...hull.map(t=>t.centre.y+t.half.y));
   const kept=templates.filter((t,i)=>t!==missing&&(hull.length<=4||hash(site.seed,i)>C.WRECK_MISSING));
   const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(site.tilt,site.yaw,site.tilt)),vertex=new THREE.Vector3();let bottom=Infinity;
   for(const t of kept.filter(t=>hull.includes(t)))t.root.traverse(o=>{if(!o.isMesh)return;const positions=o.geometry.attributes.position;for(let i=0;i<positions.count;i++)bottom=Math.min(bottom,vertex.fromBufferAttribute(positions,i).add(t.centre).applyQuaternion(rotation).y);});
   // Seat the listed hull, rather than rotating its original keel through the
   // seabed and accidentally burying most of a small boat.
   const placed={...site,y:site.y-bottom,burial:Math.min(site.burial,height*C.WRECK_BURY_FRACTION)};
   templates.forEach((t,i)=>{if(kept.includes(t))this.addPart(t,placed,i);});
  }
  for(let i=0;i<C.ARTIFACTS;i++){
   const name=site.kind==='wreck'?'barrel':'urn',source=this.models[name];this.artifactTemplates??={};this.artifactTemplates[name]??=this.preparePart(source.scene,name);
   const a=hash(site.seed,i+77)*Math.PI*2,r=C.ARTIFACT_RING*(.5+hash(site.seed,i+91));this.addPart(this.artifactTemplates[name],site,i,'artifact',new THREE.Vector3(Math.sin(a)*r,site.burial+this.artifactTemplates[name].half.y,Math.cos(a)*r));
  }
 }
 removePart(p){eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});eventBus.emit(Events.PROP_REMOVE,{id:p.id});p.mesh.removeFromParent();const i=this.parts.indexOf(p);if(i>=0)this.parts.splice(i,1);}
 breakPart(p,h){
  if(p.loose||p.attached||h.radius<Math.max(C.BREAK_MIN,Math.max(...p.half)*C.PART_BREAK_RATIO))return;
  while(this.parts.filter(p=>p.loose).length>=C.MAX_LOOSE){const old=this.parts.find(p=>p.loose&&!p.attached);if(!old)return;this.removePart(old);}
  p.loose=true;p.life=C.LOOSE_LIFE;this.damage.add(p.id);const d=p.mesh.position.clone().sub(new THREE.Vector3(h.x,h.y,h.z));d.y=0;if(!d.lengthSq())d.x=1;d.normalize().multiplyScalar(C.PART_SPEED);d.y=C.PART_LIFT;
  eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity:d.toArray(),spin:C.PART_SPIN});this.emitBubbles(p.mesh.position,C.ARTIFACTS);
 }
 impact(h){
  if(h.radius<C.BREAK_MIN)return;
  for(const p of [...this.parts])if(p.mesh.position.distanceTo(new THREE.Vector3(h.x,h.y,h.z))<h.radius+Math.max(...p.half))this.breakPart(p,h);
  for(const p of this.plants)if(!p.broken&&Math.hypot(p.x-h.x,p.y-h.y,p.z-h.z)<h.radius){
   this.damage.add(p.id);p.broken=true;
   if(this.parts.filter(p=>p.loose).length<C.MAX_LOOSE){this.artifactTemplates??={};this.artifactTemplates[p.kind]??=this.preparePart(this.models[p.kind].scene,p.kind);
    const part=this.addPart(this.artifactTemplates[p.kind],{id:p.id,x:p.x,y:p.y,z:p.z,yaw:p.yaw,tilt:0,burial:0},0,'kelp');if(part)this.breakPart(part,{...h,radius:Math.max(h.radius,C.PLANT_BREAK_RATIO)});
   }
  }
 }
 swimContact({from,to,radius,receive}){
  const start=new THREE.Vector3(from.x,from.y,from.z),direction=new THREE.Vector3(to.x,to.y,to.z).sub(start),length=direction.length();if(length<1e-6)return;
  direction.divideScalar(length);this.contactRay.set(start,direction);this.contactRay.far=length+radius;
  let nearest=null;
  for(const p of this.parts){
   if(p.loose||p.attached||p.mesh.position.distanceTo(start)>length+radius+Math.hypot(...p.half))continue;
   p.mesh.updateWorldMatrix(true,true);const hit=this.contactRay.intersectObject(p.mesh,true)[0];if(hit&&(!nearest||hit.distance<nearest.distance))nearest=hit;
  }
  if(nearest)receive(start.addScaledVector(direction,Math.max(0,nearest.distance-radius-C.CONTACT_MARGIN)));
 }
 stoneDebris(site,h){
  if(this.parts.filter(p=>p.loose).length>=C.MAX_LOOSE)return;
  this.stoneTemplate??=(()=>{const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(C.STONE_CHUNK,C.STONE_CHUNK,C.STONE_CHUNK),new THREE.MeshStandardMaterial({color:VOXEL.MATERIALS[10].color}));root.add(mesh);return{root,centre:new THREE.Vector3(),half:new THREE.Vector3().setScalar(C.STONE_CHUNK/2),key:'ruin-stone'};})();
  const p=this.addPart(this.stoneTemplate,{...site,id:`rubble-${this.serial++}`,x:h.x,z:h.z,y:h.bounds.max[1],burial:0,tilt:0},0,'stone');if(p)this.breakPart(p,{x:h.x-1,y:h.bounds.max[1],z:h.z});
 }
 stream(){
  const j=this.jimothy.position;
  const near=this.sites.filter(s=>Math.hypot(s.x-j.x,s.z-j.z)<C.STREAM_RADIUS).sort((a,b)=>Math.hypot(a.x-j.x,a.z-j.z)-Math.hypot(b.x-j.x,b.z-j.z)).slice(0,C.MAX_SITES);
  const keep=new Set(near.map(s=>s.id));
  for(const id of this.active)if(!keep.has(id)){for(const p of [...this.parts])if(p.site===id&&!p.attached&&!p.loose)this.removePart(p);this.active.delete(id);}
  for(const site of near)if(!this.active.has(site.id))this.populateSite(site);
 }
 makePlants(){
  this.plantMeshes=[];
  for(const name of ['kelp','seagrass','crab','starfish']){
   const root=this.models[name].scene,geos=[];root.updateMatrixWorld(true);
   root.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);const colors=new Float32Array(geo.attributes.position.count*3);for(let i=0;i<colors.length;i+=3)o.material.color.toArray(colors,i);geo.setAttribute('color',new THREE.BufferAttribute(colors,3));for(const key of Object.keys(geo.attributes))if(!['position','normal','color'].includes(key))geo.deleteAttribute(key);geos.push(geo);});
   const geometry=mergeGeometries(geos),material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1});geos.forEach(g=>g.dispose());
   if(name==='kelp'||name==='seagrass'){
    const uniforms={currentTime:{value:0},swimmer:{value:new THREE.Vector3()},swimmerRadius:{value:1}};
    material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader='uniform float currentTime,swimmerRadius;uniform vec3 swimmer;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     vec3 root=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;vec2 away=root.xz-swimmer.xz;float bend=(1.-smoothstep(0.,swimmerRadius,length(away)))*${C.PLANT_BEND.toFixed(3)};
     transformed.x+=position.y*position.y*(sin(currentTime*${C.CURRENT_SPEED.toFixed(3)}+root.x)*${C.CURRENT_BEND.toFixed(3)}+normalize(away+vec2(.001)).x*bend);
     transformed.z+=position.y*position.y*cos(currentTime*${C.CURRENT_SPEED.toFixed(3)}+root.z)*${C.CURRENT_BEND.toFixed(3)};`);};material.customProgramCacheKey=()=>`ocean-current-${name}`;material.userData.uniforms=uniforms;
   }
   const mesh=new THREE.InstancedMesh(geometry,material,name==='kelp'||name==='seagrass'?C.PLANT_LIMIT:C.CREATURE_COUNT);mesh.count=0;mesh.receiveShadow=true;this.scene.add(mesh);this.plantMeshes.push({name,mesh});
  }
 }
 populateHabitat(){
  const j=this.jimothy.position,R=C.PLANT_RADIUS,S=C.PLANT_GRID;this.habitat={x:j.x,z:j.z};this.plants=[];this.clearCreatures();
  for(let iz=Math.floor((j.z-R)/S);iz<=Math.ceil((j.z+R)/S);iz++)for(let ix=Math.floor((j.x-R)/S);ix<=Math.ceil((j.x+R)/S);ix++){
   const h=hash(ix,iz),x=(ix+h)*S,z=(iz+hash(iz,ix))*S,y=Terrain.surfaceHeight(x,z),id=`sea-plant:${ix}:${iz}`;
   if(this.plants.length>=C.PLANT_LIMIT||h>C.HABITAT_SHARE||y>-C.SITE_DEPTH||Math.hypot(x-j.x,z-j.z)>R||this.damage.has(id))continue;
   this.plants.push({id,x,y,z,kind:hash(ix+7,iz)>.5?'kelp':'seagrass',scale:C.PLANT_SCALE_MIN+hash(iz,ix+13)*C.PLANT_SCALE_RANGE,yaw:h*Math.PI*2});
  }
  for(let i=0;i<Math.min(C.CREATURE_COUNT,this.plants.length);i++){const p=this.plants[Math.floor(i*this.plants.length/C.CREATURE_COUNT)];const kind=i%2?'crab':'starfish',mesh=this.models[kind].scene.clone();mesh.position.set(p.x,p.y,p.z);const creature={...p,id:`ocean-creature:bed:${this.serial++}`,kind,mesh,phase:i};this.creatures.push(creature);if(kind==='crab')eventBus.emit(Events.PHYSICAL_ACTOR_CREATE,{id:creature.id,kind:'animal',mesh});}
  this.clearFish(f=>Math.hypot(f.home.x-j.x,f.home.z-j.z)>C.FISH_DESPAWN_RADIUS);
  for(let school=0;school<C.SCHOOL_COUNT;school++){
   const angle=hash(Math.floor(j.x),school)*Math.PI*2,r=C.SCHOOL_RADIUS,home={x:j.x+Math.sin(angle)*r,z:j.z+Math.cos(angle)*r};
   if(Terrain.surfaceHeight(home.x,home.z)>-C.SITE_DEPTH)continue;
   const existing=this.fish.filter(f=>f.kind===C.FISH[school]).length;
   for(let i=existing;i<C.SCHOOL_SIZE;i++)this.addFish(C.FISH[school],home,i);
  }
  if(this.fish.length&&!this.fish.some(f=>f.large)&&Terrain.surfaceHeight(j.x,j.z)<-C.SITE_DEPTH)this.addFish(C.FISH[3+Math.floor(hash(Math.floor(j.x),Math.floor(j.z))*2)],{x:j.x+C.SCHOOL_RADIUS,z:j.z},0,true);
 }
 addFish(kind,home,index,large=false){
  if(this.fish.length>=C.FISH_LIMIT||(!large&&this.fish.length>=C.FISH_LIMIT-1&&!this.fish.some(f=>f.large)))return;
  const asset=this.models[kind];asset.userData??={};asset.userData.half??=new THREE.Box3().setFromObject(asset.scene).getSize(new THREE.Vector3()).multiplyScalar(.5).addScalar(C.FISH_MARGIN);
  const half=asset.userData.half,phase=hash(index,Math.floor(home.x))*Math.PI*2,yaw=phase,fish={half,probes:[[0,0,0],[half.x,0,0],[-half.x,0,0],[0,0,half.z],[0,0,-half.z],[0,half.y,0],[0,-half.y,0]]};let at=null;
  for(let i=0;i<C.FISH_SPAWN_ATTEMPTS;i++){
   const a=phase+i*Math.PI*2/C.FISH_SPAWN_ATTEMPTS,x=home.x+Math.sin(a)*C.SCHOOL_RADIUS/2,z=home.z+Math.cos(a)*C.SCHOOL_RADIUS/2,y=Math.max(Terrain.surfaceHeight(x,z)+C.FISH_CLEARANCE+half.y,-C.SITE_DEPTH);
   if(this.fishClear(fish,x,y,z,yaw)){at=new THREE.Vector3(x,y,z);break;}
  }if(!at)return;
  const visual=clone(asset.scene),mesh=new THREE.Group();mesh.add(visual);this.scene.add(mesh);mesh.position.copy(at);mesh.rotation.y=yaw;
  const mixer=new THREE.AnimationMixer(visual);for(const clip of asset.animations)mixer.clipAction(clip).play();mixer.setTime(phase);
  Object.assign(fish,{id:`ocean-creature:fish:${this.serial++}`,mesh,visual,mixer,kind,home,phase,large,depth:at.y,motion:new FishMotion(yaw,large?C.LARGE_SPEED:C.FISH_SPEED)});this.fish.push(fish);
  // A rotated world AABB would rotate a second time with the actor proxy.
  const collisionHalf=half.toArray().map(v=>THREE.MathUtils.clamp(v-C.FISH_MARGIN,RUBBLE.ANIMAL_MIN,RUBBLE.ANIMAL_MAX));
  eventBus.emit(Events.PHYSICAL_ACTOR_CREATE,{id:fish.id,kind:'fish',mesh,collisionHalf,collisionOffset:[0,0,0]});
 }
 fishClear(f,x,y,z,yaw){
  const sine=Math.sin(yaw),cosine=Math.cos(yaw);
  for(const [dx,dy,dz] of f.probes){
   const px=x+dx*cosine+dz*sine,py=y+dy,pz=z-dx*sine+dz*cosine,bottom=Terrain.surfaceHeight(px,pz);
   if(bottom>=-C.SITE_DEPTH||py<bottom+C.FISH_CLEARANCE||py>TERRAIN.SEA_LEVEL-C.FISH_SURFACE||this.voxels.physicalSolidAtWorld(px,py,pz))return false;
   for(const part of this.parts){
    if(part.loose||part.attached||Math.hypot(px-part.mesh.position.x,py-part.mesh.position.y,pz-part.mesh.position.z)>Math.hypot(...part.half)+C.FISH_MARGIN)continue;
    this.fishPoint.set(px,py,pz).sub(part.mesh.position).applyQuaternion(this.fishInverse.copy(part.mesh.quaternion).invert());
    if(Math.abs(this.fishPoint.x)<part.half[0]+C.FISH_MARGIN&&Math.abs(this.fishPoint.y)<part.half[1]+C.FISH_MARGIN&&Math.abs(this.fishPoint.z)<part.half[2]+C.FISH_MARGIN)return false;
   }
  }return true;
 }
 clearFish(remove=()=>true){for(const f of this.fish.filter(remove)){eventBus.emit(Events.PHYSICAL_ACTOR_REMOVE,{id:f.id});f.mixer.stopAllAction();f.mixer.uncacheRoot(f.visual);f.visual.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});f.mesh.removeFromParent();}this.fish=this.fish.filter(f=>!remove(f));}
 clearCreatures(){for(const p of this.creatures)eventBus.emit(Events.PHYSICAL_ACTOR_REMOVE,{id:p.id});this.creatures=[];}
 makeEffects(){
  const geo=new THREE.BufferGeometry();this.bubbleData=new Float32Array(C.BUBBLES*3);geo.setAttribute('position',new THREE.BufferAttribute(this.bubbleData,3));geo.setDrawRange(0,0);
  this.bubbleMesh=new THREE.Points(geo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{bubbleColor:{value:new THREE.Color(C.BUBBLE_COLOR)}},vertexShader:`void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=${(C.BUBBLE_SIZE*C.BUBBLE_SCREEN_SCALE).toFixed(2)}/max(1.,-p.z);}`,fragmentShader:`uniform vec3 bubbleColor;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float a=smoothstep(.5,.85,r)*(1.-smoothstep(.9,1.,r));gl_FragColor=vec4(bubbleColor,a*${C.BUBBLE_OPACITY.toFixed(3)});}` }));this.scene.add(this.bubbleMesh);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{strength:{value:0},rayTime:{value:0},rayColor:{value:new THREE.Color(C.RAY_COLOR)}},vertexShader:'attribute float rayFloor;varying float aboveFloor;varying vec2 v;varying vec3 rayNormal,rayView;void main(){v=uv;aboveFloor=(modelMatrix*instanceMatrix*vec4(position,1.)).y-rayFloor;vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);mat3 im=mat3(instanceMatrix);vec3 squaredScale=vec3(dot(im[0],im[0]),dot(im[1],im[1]),dot(im[2],im[2]));rayNormal=mat3(modelViewMatrix)*im*(normal/squaredScale);rayView=-p.xyz;gl_Position=projectionMatrix*p;}',fragmentShader:`varying float aboveFloor;varying vec2 v;varying vec3 rayNormal,rayView;uniform vec3 rayColor;uniform float strength,rayTime;void main(){float edge=pow(abs(dot(normalize(rayNormal),normalize(rayView))),2.);float fade=smoothstep(0.,.25,v.y)*(1.-smoothstep(.65,1.,v.y));float shafts=.85+.15*sin(v.y*25.+rayTime*.2);gl_FragColor=vec4(rayColor,edge*fade*shafts*strength*smoothstep(0.,${C.RAY_FLOOR_FADE.toFixed(3)},aboveFloor));}`});
  this.rayMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.1,C.RAY_RADIUS,1,C.RAY_SEGMENTS,1,true),material,C.RAYS);this.rayMesh.geometry.setAttribute('rayFloor',new THREE.InstancedBufferAttribute(new Float32Array(C.RAYS),1));this.rayMesh.count=0;this.rayMesh.frustumCulled=false;this.scene.add(this.rayMesh);
 }
 emitBubbles(p,count=1){for(let i=0;i<count&&this.bubbles.length<C.BUBBLES;i++)this.bubbles.push({x:p.x,y:p.y,z:p.z,life:C.BUBBLE_LIFE,phase:this.serial++});}
 update(dt){
  if(!this.ready||!gameState.game.isPlaying)return;this.time+=dt;this.streamClock+=dt;const j=this.jimothy.position;
  if(this.streamClock>=C.STREAM_INTERVAL){this.stream();this.streamClock=0;}
  if(!this.habitat||Math.hypot(j.x-this.habitat.x,j.z-this.habitat.z)>C.PLANT_REFRESH)this.populateHabitat();
  if(this.jimothy.move?.kind==='roll')this.impact({...this.jimothy.body.position,radius:this.jimothy.radius});
  for(const p of [...this.parts])if(!p.attached&&(p.loose&&(p.life-=dt)<=0||p.mesh.position.distanceTo(j)>C.DESPAWN_RADIUS+this.jimothy.radius))this.removePart(p);
  for(const f of this.fish){
   f.phase+=dt*(f.large?C.LARGE_SPEED:C.FISH_SPEED)/C.SCHOOL_RADIUS;
   f.motion.update(dt,{position:f.mesh.position,home:f.home,phase:f.phase,swimmer:this.jimothy.body.position,radius:this.jimothy.radius,large:f.large,depth:f.depth,time:this.time,clear:(x,y,z,yaw)=>this.fishClear(f,x,y,z,yaw)});
   f.mesh.rotation.y=f.motion.yaw;f.mixer.update(dt);
  }
  for(const batch of this.plantMeshes){
   const items=(batch.name==='kelp'||batch.name==='seagrass'?this.plants:this.creatures).filter(p=>p.kind===batch.name&&!p.broken);batch.mesh.count=items.length;
   items.forEach((p,i)=>{const crab=p.kind==='crab',offset=crab?Math.sin(this.time*C.CRAB_SPEED+p.phase)*C.CRAB_RANGE:0;this.pose.position.set(p.x+offset,crab?this.voxels.physicalGroundHeightAt(p.x+offset,p.z,Terrain.surfaceHeight(p.x+offset,p.z)+C.FISH_CLEARANCE):p.y,p.z);this.pose.rotation.set(0,p.yaw,0);this.pose.scale.setScalar(crab||p.kind==='starfish'?1:p.scale);this.pose.updateMatrix();batch.mesh.setMatrixAt(i,this.pose.matrix);if(p.mesh){p.mesh.position.copy(this.pose.position);p.mesh.quaternion.copy(this.pose.quaternion);}});batch.mesh.instanceMatrix.needsUpdate=true;if(items.length)batch.mesh.computeBoundingSphere();
   const u=batch.mesh.material.userData.uniforms;if(u){u.currentTime.value=this.time;u.swimmer.value.copy(j);u.swimmerRadius.value=this.jimothy.radius+C.FLEE_RADIUS;}
  }
  this.bubbleClock+=dt;this.ventClock+=dt;
  if(this.jimothy.diving&&this.bubbleClock>=C.BUBBLE_INTERVAL){this.emitBubbles(this.jimothy.body.position);this.bubbleClock=0;}
  if(this.ventClock>=C.VENT_INTERVAL){for(const id of this.active){const s=this.sites.find(s=>s.id===id);if(s.seed%2===0)this.emitBubbles(new THREE.Vector3(s.x,s.y+C.FISH_CLEARANCE,s.z));}this.ventClock=0;}
  this.bubbles=this.bubbles.filter(p=>{p.life-=dt;p.y+=C.BUBBLE_SPEED*dt;p.x+=Math.sin(this.time+p.phase)*C.BUBBLE_DRIFT*dt;return p.life>0&&p.y<TERRAIN.SEA_LEVEL&&Math.hypot(p.x-j.x,p.z-j.z)<C.PLANT_RADIUS;});
  this.bubbles.forEach((p,i)=>{this.bubbleData[i*3]=p.x;this.bubbleData[i*3+1]=p.y;this.bubbleData[i*3+2]=p.z;});this.bubbleMesh.geometry.setDrawRange(0,this.bubbles.length);this.bubbleMesh.geometry.attributes.position.needsUpdate=true;this.bubbleMesh.geometry.computeBoundingSphere();
  this.batches.update(this.parts.map(p=>({key:p.key,root:p.mesh})));
 }
 afterCamera(){
  const p=this.camera.position,day=gameState.world.daylight??1,depth=TERRAIN.SEA_LEVEL-p.y;
  this.underwater=depth>C.CAMERA_WATER_MARGIN&&Terrain.surfaceHeight(p.x,p.z)<p.y;
  gameState.world.underwater=this.underwater;this.sky.visible=!this.underwater;
  this.rayMesh.count=0;this.bubbleMesh.visible=this.underwater;this.rayMesh.visible=this.underwater&&day>C.RAY_DAY_MIN;
  if(!this.underwater)return;
  this.color.set(C.NIGHT_FOG).lerp(new THREE.Color(C.FOG_COLOR),day);this.color.multiplyScalar(Math.max(C.MIN_LIGHT,Math.exp(-depth*C.DEPTH_DIM)));this.scene.fog.color.copy(this.color);this.scene.background.copy(this.color);this.scene.fog.near=C.FOG_NEAR;this.scene.fog.far=THREE.MathUtils.lerp(C.NIGHT_FAR,C.FOG_FAR,day)*Math.exp(-depth*C.DEPTH_DIM);
  this.rayMesh.material.uniforms.strength.value=C.RAY_OPACITY*day*Math.exp(-depth*C.DEPTH_DIM);this.rayMesh.material.uniforms.rayTime.value=this.time;
  if(!this.rayMesh.visible)return;const sun=this.sky.material.uniforms.sunDir.value;if(sun.y<=0)return;
  this.camera.getWorldDirection(this.rayForward).setY(0).normalize().multiplyScalar(C.RAY_FORWARD);
  for(let i=0;i<C.RAYS;i++){
   const a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(i/C.RAYS)*C.RAY_SPREAD,x=p.x+this.rayForward.x+Math.sin(a)*r,z=p.z+this.rayForward.z+Math.cos(a)*r,y=Terrain.surfaceHeight(x,z)+C.RAY_START_MARGIN;
   const height=Math.min(-y,C.RAY_DEPTH_MAX,C.RAY_LENGTH_MAX*sun.y);if(height<=0)continue;
   const hit=this.voxels.raycast(x,y,z,sun.x,sun.y,sun.z,height/sun.y);if(hit)continue;
   const length=height/sun.y,centre=new THREE.Vector3(x,y,z).addScaledVector(sun,length/2);this.pose.position.copy(centre);this.pose.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP,sun);this.pose.scale.set(1,length,1);this.pose.updateMatrix();this.rayMesh.geometry.attributes.rayFloor.setX(this.rayMesh.count,y-C.RAY_START_MARGIN);this.rayMesh.setMatrixAt(this.rayMesh.count++,this.pose.matrix);
  }
  this.rayMesh.instanceMatrix.needsUpdate=true;this.rayMesh.geometry.attributes.rayFloor.needsUpdate=true;
 }
 reset(){for(const p of [...this.parts])this.removePart(p);this.batches.clear();this.clearFish();this.active.clear();this.damage.clear();this.plants=[];this.clearCreatures();this.habitat=null;this.bubbles=[];this.bubbleMesh.geometry.setDrawRange(0,0);this.rayMesh.count=0;this.time=this.streamClock=this.bubbleClock=this.ventClock=0;this.underwater=false;this.sky.visible=true;for(const b of this.plantMeshes||[])b.mesh.count=0;}
 snapshot(){return{ready:this.ready,underwater:this.underwater,sites:[...this.active].map(id=>{const s=this.sites.find(s=>s.id===id);return{id,kind:s.kind,family:s.family,x:s.x,z:s.z};}),totalSites:this.sites.length,parts:this.parts.length,loose:this.parts.filter(p=>p.loose).length,damage:this.damage.size,fish:this.fish.length,fishKinds:[...new Set(this.fish.map(f=>f.kind))],plants:this.plants.filter(p=>!p.broken).length,creatures:this.creatures.length,bubbles:this.bubbles.length,rays:this.rayMesh.visible?this.rayMesh.count:0};}
}
