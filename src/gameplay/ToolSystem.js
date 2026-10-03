import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TOOLS as C} from '../core/Constants.js';
import {gameState} from '../core/GameState.js';
import {eventBus,Events} from '../core/EventBus.js';
import * as Layout from '../level/Layout.js';

export class ToolSystem {
 constructor(scene,jimothy,input,voxels){
  Object.assign(this,{scene,jimothy,input,voxels});this.catalog=C.CATALOG;this.pickups=[];this.models=new Map();this.entities=new Map();this.statuses=new Map();this.paint=[];this.particles=[];this.cooldown=0;this.time=0;this.shots=0;this.equipped=null;this.ready=false;
  this.ball=new THREE.SphereGeometry(1,10,6);this.bubbleMaterial=new THREE.MeshStandardMaterial({color:C.BUBBLE_COLOR,transparent:true,opacity:C.BUBBLE_OPACITY,roughness:C.BUBBLE_ROUGHNESS,depthWrite:false});this.paintMaterial=new THREE.MeshStandardMaterial({color:C.PAINT_BASE,roughness:C.PAINT_ROUGHNESS});
  this.effects=new THREE.InstancedMesh(this.ball,new THREE.MeshBasicMaterial({transparent:true,opacity:C.EFFECT_OPACITY,depthWrite:false}),C.EFFECT_LIMIT);this.effects.count=0;this.effects.frustumCulled=false;scene.add(this.effects);this.matrix=new THREE.Object3D();
  eventBus.on(Events.ENTITY_REGISTER,e=>this.entities.set(e.id,e));eventBus.on(Events.ENTITY_UNREGISTER,({id})=>{this.releaseStatus(id);this.entities.delete(id);});eventBus.emit(Events.ENTITY_LIST,{receive:items=>{for(const e of items)this.entities.set(e.id,e);}});
  eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.pickups.find(p=>p.id===id);if(p){p.attached=true;eventBus.emit(Events.PROP_SUSPEND,{id});}});
  eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{const p=this.pickups.find(p=>p.id===id);if(p){p.attached=false;p.loose=true;p.mesh.position.set(position.x,ground+p.half[1],position.z);eventBus.emit(Events.PROP_RELEASE,{id,position:p.mesh.position});}});
  eventBus.on(Events.WORLD_IMPACT,h=>{for(const p of this.pickups)if(!p.held&&!p.attached&&p.mesh.position.distanceTo(new THREE.Vector3(h.x,h.y,h.z))<h.radius+p.size){p.loose=true;eventBus.emit(Events.PROP_RELEASE,{id:p.id,position:p.mesh.position});}for(const [id,s]of this.statuses)if(s.entity.mesh.position.distanceTo(new THREE.Vector3(h.x,h.y,h.z))<h.radius+C.BUBBLE_RADIUS)this.releaseStatus(id);});
  eventBus.on(Events.PLAYER_PICKUP,({fat})=>{gameState.tools.energy=Math.min(C.ENERGY_MAX,gameState.tools.energy+(fat||0)*C.ENERGY_PER_FAT);});
  eventBus.on(Events.GAME_OVER,()=>{this.drop();this.clearStatuses();});eventBus.on(Events.PLAYER_LAUNCHED,e=>{if(!e.keepTool)this.drop();});
  this.panel=document.createElement('div');this.panel.id='tool-hud';this.panel.setAttribute('aria-live','polite');document.body.appendChild(this.panel);
  const loader=new GLTFLoader();this.loading=Promise.all(this.catalog.map(async d=>{const gltf=await loader.loadAsync(import.meta.env.BASE_URL+`assets/models/tools/${d.id}.glb`);const root=gltf.scene;root.scale.setScalar(C.MODEL_SCALE);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3());root.position.sub(center);root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});this.models.set(d.id,{root,half:box.getSize(new THREE.Vector3()).multiplyScalar(.5)});})).then(()=>{this.ready=true;this.spawn();}).catch(e=>console.error('Tool model load failed',e));
 }
 spawn(){
  for(let i=0;i<this.catalog.length&&this.pickups.length<C.LIMIT;i++){
   const d=this.catalog[i],model=this.models.get(d.id),mesh=new THREE.Group();mesh.add(model.root.clone(true));let spot=null;
   for(let n=0;n<C.SITE_SCAN*C.SITE_SCAN;n++){
    const a=(i+n/C.SITE_SCAN)*Math.PI*(3-Math.sqrt(5)),r=C.SITE_RING+Math.floor(n/C.SITE_SCAN)*C.SITE_STEP,x=C.SPAWN_X+Math.sin(a)*r,z=C.SPAWN_Z+Math.cos(a)*r;
    if(!Layout.isFootpathAtWorld(x,z)||this.pickups.some(p=>Math.hypot(p.mesh.position.x-x,p.mesh.position.z-z)<C.SITE_SEPARATION))continue;
    const y=this.voxels.groundHeightAt(x,z,this.voxels.terrainHeightAt(x,z)+C.HEIGHT_REACH);if(this.voxels.solidAtWorld(x,y+C.CLEARANCE+model.half.y,z))continue;spot=new THREE.Vector3(x,y+C.CLEARANCE+model.half.y,z);break;
   }
   if(!spot){console.error('No reachable tool site',d.id);continue;}
   mesh.position.copy(spot);this.scene.add(mesh);const p={id:`tool:${d.id}`,type:d.id,kind:'tool',mesh,half:model.half.toArray(),size:Math.max(...model.half.toArray())*2,mass:C.MASS,loose:false,attached:false,held:false,home:spot.clone()};this.pickups.push(p);eventBus.emit(Events.PROP_CREATE,p);eventBus.emit(Events.ENTITY_REGISTER,p);
  }
 }
 allowed(){return gameState.game.isPlaying&&!gameState.game.paused&&!gameState.player.stunned&&!this.input.suppressed&&gameState.arrival.phase==='done'&&this.jimothy.move?.kind!=='roll';}
 nearest(){let best=null,distance=C.PICKUP_REACH+this.jimothy.radius;const j=this.jimothy.body.position;for(const p of this.pickups){if(p.held||p.attached)continue;const v=p.mesh.position;if(Math.abs(v.y-(j.y-this.jimothy.radius))>C.HEIGHT_REACH+this.jimothy.radius)continue;const d=Math.hypot(v.x-j.x,v.z-j.z);if(d<distance&&this.clear(j,v)){best=p;distance=d;}}return best;}
 equip(p){if(!p||p.attached||p.held||!this.ready)return;this.drop();this.equipped=p;p.held=true;p.mesh.visible=true;eventBus.emit(Events.PROP_SUSPEND,{id:p.id});eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});gameState.tools.equipped=p.type;this.cooldown=0;this.pose();}
 drop(){const p=this.equipped;if(!p)return;const j=this.jimothy.body.position,dir=this.direction(),r=this.jimothy.radius+C.PILE_DISTANCE,x=j.x+dir.x*r,z=j.z+dir.z*r,y=this.voxels.groundHeightAt(x,z,j.y+C.HEIGHT_REACH);p.mesh.scale.setScalar(1);p.mesh.quaternion.identity();p.mesh.position.set(x,y+p.half[1]+C.CLEARANCE,z);p.held=false;p.loose=true;this.equipped=null;gameState.tools.equipped=null;eventBus.emit(Events.ENTITY_REGISTER,p);eventBus.emit(Events.PROP_RELEASE,{id:p.id,position:p.mesh.position});}
 direction(){if(this.aimOverride)return new THREE.Vector3(this.aimOverride.x,this.aimOverride.y,this.aimOverride.z).normalize();const j=this.jimothy,yaw=j.aimYaw??j.yaw,pitch=j.aimPitch||0;return new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));}
 pose(){const p=this.equipped;if(!p)return;const j=this.jimothy,r=j.radius,dir=this.direction(),right=new THREE.Vector3(dir.z,0,-dir.x);p.mesh.visible=j.move?.kind!=='roll';p.mesh.position.copy(j.body.position).addScaledVector(dir,r*C.HOLD_FORWARD).addScaledVector(right,r*C.HOLD_SIDE);p.mesh.position.y+=Math.max(C.HOLD_MIN_HEIGHT,r*C.HOLD_HEIGHT);p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);p.mesh.scale.setScalar(Math.min(C.HOLD_SCALE_MAX,Math.max(1,Math.sqrt(r))));}
 clear(from,to){const d=to.clone().sub(from),length=d.length();if(!length)return true;d.divideScalar(length);for(let t=C.RAY_STEP;t<length-C.CONTACT_PAD;t+=C.RAY_STEP)if(this.voxels.solidAtWorld(from.x+d.x*t,from.y+d.y*t,from.z+d.z*t))return false;return true;}
 targets(d){const origin=new THREE.Vector3().copy(this.jimothy.body.position),dir=this.direction(),range=d.range*Math.min(C.SIZE_REACH_MAX,Math.max(1,Math.sqrt(this.jimothy.radius))),list=[];for(const e of this.entities.values()){
   if(e.attached||e.held||!e.mesh.parent)continue;const point=e.mesh.getWorldPosition(new THREE.Vector3());if(e.kind==='person')point.y+=C.PERSON_HEIGHT;const delta=point.clone().sub(origin),distance=delta.length();if(distance>range||distance<C.CLEARANCE||delta.dot(dir)/distance<d.cone-C.CONTACT_PAD/distance||!this.clear(origin,point))continue;list.push({entity:e,point,distance});
  }list.sort((a,b)=>a.distance-b.distance);return list.slice(0,C.TARGET_LIMIT);}
 force(e,dir,force){const gain=force/Math.max(1,(e.mass||C.FORCE_MASS)/C.FORCE_MASS),velocity=[dir.x*gain,dir.y*gain+C.FORCE_LIFT,dir.z*gain];e.loose=true;eventBus.emit(Events.PROP_UNSUPPORTED,{id:e.id});eventBus.emit(Events.TOOL_FORCE,{mesh:e.mesh,velocity,spin:e.kind==='bin'?[dir.z*C.BIN_SPIN,0,-dir.x*C.BIN_SPIN]:null});
  if(e.kind==='food'){const position=e.mesh.getWorldPosition(new THREE.Vector3()).addScaledVector(dir,force*C.FOOD_PUSH_STEP);position.y=this.voxels.groundHeightAt(position.x,position.z,position.y+C.HEIGHT_REACH)+C.CLEARANCE;eventBus.emit(Events.FOOD_SHIFT,{id:e.id,position});}}
 bubble(e){if(e.kind!=='person'||this.statuses.has(e.id)||this.statuses.size>=C.STATUS_LIMIT)return false;
  const visual=new THREE.Mesh(this.ball,this.bubbleMaterial);visual.scale.setScalar(C.BUBBLE_RADIUS);this.scene.add(visual);const s={entity:e,age:0,life:C.BUBBLE_LIFE,base:e.mesh.position.clone(),visual,kind:'bubble'};this.statuses.set(e.id,s);eventBus.emit(Events.ENTITY_ATTACH,{id:e.id});e.attached=true;return true;}
 releaseStatus(id){const s=this.statuses.get(id);if(!s)return;this.statuses.delete(id);s.visual?.removeFromParent();const e=s.entity;e.attached=false;const pos=e.mesh.getWorldPosition(new THREE.Vector3()),ground=this.voxels.groundHeightAt(pos.x,pos.z,pos.y+C.HEIGHT_REACH);this.scene.attach(e.mesh);e.mesh.position.set(pos.x,ground,pos.z);eventBus.emit(Events.ENTITY_RELEASE,{id,position:e.mesh.position.clone(),ground});}
 clearStatuses(){for(const id of [...this.statuses.keys()])this.releaseStatus(id);}
 splat(e,color){
  e.mesh.updateWorldMatrix(true,true);const origin=new THREE.Vector3().copy(this.jimothy.body.position),box=new THREE.Box3().setFromObject(e.mesh),center=box.getCenter(new THREE.Vector3());
  const ray=new THREE.Raycaster(origin,center.sub(origin).normalize());const hit=ray.intersectObject(e.mesh,true).find(h=>!h.object.userData.toolPaint);if(!hit)return;
  if(this.paint.length>=C.PAINT_LIMIT)this.removePaint(this.paint[0]);const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld),m=new THREE.Mesh(this.ball,this.paintMaterial.clone());m.userData.toolPaint=true;m.material.color.setHex(color);m.scale.set(C.PAINT_RADIUS,C.PAINT_RADIUS,C.PAINT_CLEARANCE);
  // Paint belongs on the struck surface, including animated humans; an
  // entity-size offset placed it in midair beside thin props (M43).
  m.position.copy(e.mesh.worldToLocal(hit.point.clone().addScaledVector(normal,C.PAINT_CLEARANCE)));m.quaternion.copy(e.mesh.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal));e.mesh.add(m);this.paint.push({mesh:m,life:C.PAINT_LIFE,owner:e});
 }
 removePaint(p){p.mesh.removeFromParent();p.mesh.material.dispose();this.paint.splice(this.paint.indexOf(p),1);}
 burst(d,point=null,count=C.CONTACTS){const origin=point||this.equipped?.mesh.position||this.jimothy.body.position,dir=this.direction();for(let i=0;i<count&&this.particles.length<C.EFFECT_LIMIT;i++){const phase=(this.shots*C.CONTACTS+i)*Math.PI*(3-Math.sqrt(5)),offset=new THREE.Vector3(Math.sin(phase),Math.cos(phase),Math.sin(phase/2)).multiplyScalar(C.EFFECT_SPREAD);this.particles.push({position:new THREE.Vector3().copy(origin),velocity:dir.clone().multiplyScalar(C.EFFECT_SPEED).add(offset),life:C.EFFECT_LIFE,color:d.color,size:C.EFFECT_SIZE*(d.mode==='extinguisher'?C.CONTACTS:1)});}}
 use(dt){if(!this.equipped||!this.allowed()||this.cooldown>0)return false;const d=this.catalog.find(d=>d.id===this.equipped.type);if(gameState.tools.energy<d.cost)return false;gameState.tools.energy-=d.cost;this.cooldown=d.interval;this.shots++;const targets=this.targets(d),dir=this.direction(),j=this.jimothy;let affected=0;
  for(const {entity:e,point}of targets){
   if(['water','air','extinguisher'].includes(d.mode)){
    if(e.kind==='person'){eventBus.emit(Events.HUMAN_IMPACT,{id:e.id,x:point.x-dir.x,y:point.y,z:point.z-dir.z,radius:C.CONTACT_PAD,source:'tool'});}else this.force(e,dir,d.force);affected++;
   }else if(d.mode==='bubble'){if(this.bubble(e)){affected++;break;}}
   else if(['suction','magnet'].includes(d.mode)&&e.kind==='food'){
    const pile=new THREE.Vector3(j.body.position.x,point.y,j.body.position.z).addScaledVector(dir,j.radius+C.PILE_DISTANCE);const destination=point.clone().lerp(pile,Math.min(1,C.SUCTION_SPEED*Math.max(dt,d.interval)/Math.max(C.CLEARANCE,point.distanceTo(pile))));destination.y=this.voxels.groundHeightAt(destination.x,destination.z,Math.max(point.y,j.body.position.y)+C.HEIGHT_REACH)+C.CLEARANCE;
    // Ground-hugging suction follows uphill kerbs instead of tracing through
    // the hillside at the food's previous height; walls still block the path.
    const from=point.clone(),to=destination.clone();from.y+=C.SUCTION_CLEARANCE;to.y+=C.SUCTION_CLEARANCE;if(this.clear(from,to))eventBus.emit(Events.FOOD_SHIFT,{id:e.id,position:destination});
   }else if(d.mode==='paint'){this.splat(e,d.color);affected++;break;}
   else if(d.mode==='confetti'&&e.kind==='person'){eventBus.emit(Events.WORLD_IMPACT,{x:point.x,y:point.y,z:point.z,radius:C.CONTACT_PAD,source:'confetti'});affected++;}
  }
  if(d.mode==='extinguisher'){const v=j.vel.clone().addScaledVector(dir,-d.force);eventBus.emit(Events.PLAYER_LAUNCHED,{velocity:[v.x,d.force,v.z],seconds:d.interval,mass:C.FORCE_MASS,keepTool:true});}
  if(affected)eventBus.emit(Events.TOOL_CHAOS,{points:C.CHAOS});this.burst(d);return true;
 }
 update(dt){if(!this.ready||gameState.game.paused)return;this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);const pickup=this.input.consumeTool(),drop=this.input.consumeDrop();if(this.allowed()){if(drop)this.drop();if(pickup)this.equip(this.nearest());if(this.input.toolUse)this.use(dt);}this.pose();
  for(const [id,s]of this.statuses){s.age+=dt;if(s.age>=s.life||!gameState.game.isPlaying){this.releaseStatus(id);continue;}s.entity.mesh.position.copy(s.base);s.entity.mesh.position.y+=Math.min(s.age,C.BUBBLE_RISE)+Math.sin(s.age*C.STATUS_HZ)*C.STATUS_WOBBLE;s.visual.position.copy(s.entity.mesh.position);s.visual.position.y+=C.PERSON_HEIGHT;}
  for(const p of [...this.paint]){p.life-=dt;if(p.life<=0||!this.entities.has(p.owner.id))this.removePaint(p);}
  this.particles=this.particles.filter(p=>{p.life-=dt;p.position.addScaledVector(p.velocity,dt);return p.life>0;});this.effects.count=this.particles.length;this.particles.forEach((p,i)=>{this.matrix.position.copy(p.position);this.matrix.scale.setScalar(p.size*p.life/C.EFFECT_LIFE);this.matrix.updateMatrix();this.effects.setMatrixAt(i,this.matrix.matrix);this.effects.setColorAt(i,new THREE.Color(p.color));});this.effects.instanceMatrix.needsUpdate=true;if(this.effects.instanceColor)this.effects.instanceColor.needsUpdate=true;
  for(const p of this.pickups)if(!p.held&&!p.attached)p.mesh.visible=p.mesh.position.distanceTo(this.jimothy.body.position)<C.RENDER_DISTANCE+this.jimothy.radius;
  const near=this.nearest(),d=this.catalog.find(d=>d.id===this.equipped?.type),energy=Math.round(gameState.tools.energy);const text=d?`${d.name} · FOOD ENERGY ${energy}/${C.ENERGY_MAX}\n${d.description}\nMouse / V / RB use · G / B drop${near?' · T / LB swap: '+this.catalog.find(d=>d.id===near.type).name:''}`:near?`T / LB pick up ${this.catalog.find(d=>d.id===near.type).name}`:'';if(this.panel.textContent!==text)this.panel.textContent=text;this.panel.hidden=!text;
 }
 reset(){this.clearStatuses();this.equipped=null;for(const p of this.pickups){eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});eventBus.emit(Events.PROP_REMOVE,{id:p.id});p.mesh.removeFromParent();}this.pickups=[];for(const p of [...this.paint])this.removePaint(p);this.particles=[];this.effects.count=0;this.cooldown=0;this.time=0;this.shots=0;this.aimOverride=null;gameState.tools.equipped=null;if(this.ready)this.spawn();}
 snapshot(){return {ready:this.ready,catalog:this.catalog.map(d=>d.id),equipped:this.equipped?.type||null,heldVisible:!!this.equipped?.mesh.visible,energy:+gameState.tools.energy.toFixed(2),pickups:this.pickups.map(p=>({id:p.id,type:p.type,x:p.mesh.position.x,y:p.mesh.position.y,z:p.mesh.position.z,held:p.held,attached:p.attached})),effects:this.particles.length,statuses:this.statuses.size,paint:this.paint.length,shots:this.shots,limit:C.LIMIT};}
}
