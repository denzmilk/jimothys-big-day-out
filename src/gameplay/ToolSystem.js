import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TOOLS as C} from '../core/Constants.js';
import {gameState} from '../core/GameState.js';
import {eventBus,Events} from '../core/EventBus.js';
import * as Layout from '../level/Layout.js';
import {ToolAudio} from '../core/ToolAudio.js';

export class ToolSystem {
 constructor(scene,jimothy,input,voxels){
  Object.assign(this,{scene,jimothy,input,voxels});this.catalog=C.CATALOG;this.pickups=[];this.models=new Map();this.entities=new Map();this.statuses=new Map();this.paint=[];this.particles=[];this.cooldown=0;this.time=0;this.shots=0;this.equipped=null;this.ready=false;this.humans=new Map();this.devices=[];this.clouds=[];this.projectiles=[];this.serial=0;this.blasts=0;
  this.notice='';this.noticeUntil=0;this.discards=0;this.sound=new ToolAudio(()=>this.jimothy.body.position);
  this.ball=new THREE.SphereGeometry(1,10,6);this.bubbleMaterial=new THREE.MeshStandardMaterial({color:C.BUBBLE_COLOR,transparent:true,opacity:C.BUBBLE_OPACITY,roughness:C.BUBBLE_ROUGHNESS,depthWrite:false});this.paintMaterial=new THREE.MeshStandardMaterial({color:C.PAINT_BASE,roughness:C.PAINT_ROUGHNESS});
  this.effects=new THREE.InstancedMesh(this.ball,new THREE.MeshBasicMaterial({transparent:true,opacity:C.EFFECT_OPACITY,depthWrite:false}),C.EFFECT_LIMIT);this.effects.count=0;this.effects.frustumCulled=false;scene.add(this.effects);this.matrix=new THREE.Object3D();
  this.foamMaterial=new THREE.MeshStandardMaterial({color:C.FOAM_COLOR,roughness:C.PAINT_ROUGHNESS});this.rocketGeometry=new THREE.ConeGeometry(C.PROJECTILE_RADIUS,C.PROJECTILE_LENGTH,8);this.rocketMaterial=new THREE.MeshStandardMaterial({color:C.FIREWORK_COLOR});
  this.shieldMesh=new THREE.Mesh(this.ball,this.bubbleMaterial);this.shieldMesh.visible=false;scene.add(this.shieldMesh);
  this.rope=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:C.ROPE_COLOR}));this.rope.visible=false;scene.add(this.rope);
  eventBus.on(Events.HUMAN_REGISTER,p=>this.humans.set(p.id,p));eventBus.on(Events.HUMAN_UNREGISTER,({id})=>{this.releaseStatus(id);this.humans.delete(id);});
  eventBus.on(Events.TRAFFIC_OBSTACLES,({obstacles})=>{for(const p of this.devices)if(!p.attached)obstacles.push({id:p.id,x:p.mesh.position.x,y:p.mesh.position.y,z:p.mesh.position.z,radius:p.half[0]});});
  eventBus.on(Events.ENTITY_REGISTER,e=>this.entities.set(e.id,e));eventBus.on(Events.ENTITY_UNREGISTER,({id})=>{this.releaseStatus(id);this.entities.delete(id);});eventBus.emit(Events.ENTITY_LIST,{receive:items=>{for(const e of items)this.entities.set(e.id,e);}});
  eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=[...this.pickups,...this.devices].find(p=>p.id===id);if(p){p.attached=true;eventBus.emit(Events.PROP_SUSPEND,{id});}});
  eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{const p=[...this.pickups,...this.devices].find(p=>p.id===id);if(p){p.attached=false;p.loose=true;p.mesh.position.set(position.x,ground+p.half[1],position.z);eventBus.emit(Events.PROP_RELEASE,{id,position:p.mesh.position});}});
  eventBus.on(Events.WORLD_IMPACT,h=>{for(const p of [...this.pickups,...this.devices])if(!p.held&&!p.attached&&p.mesh.position.distanceTo(new THREE.Vector3(h.x,h.y,h.z))<h.radius+p.size){p.loose=true;eventBus.emit(Events.PROP_RELEASE,{id:p.id,position:p.mesh.position});}for(const [id,s]of this.statuses)if(s.entity.mesh.position.distanceTo(new THREE.Vector3(h.x,h.y,h.z))<h.radius+C.BUBBLE_RADIUS)this.releaseStatus(id);});
  eventBus.on(Events.PLAYER_PICKUP,({fat})=>{gameState.tools.energy=Math.min(C.ENERGY_MAX,gameState.tools.energy+(fat||0)*C.ENERGY_PER_FAT);});
  eventBus.on(Events.GAME_OVER,()=>{this.drop();this.clearStatuses();this.clearExtras();});eventBus.on(Events.PLAYER_LAUNCHED,e=>{if(!e.keepTool)this.drop();});
  eventBus.on(Events.PLAYER_RIDE,({active})=>{if(active)this.drop();});
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
   const site=Layout.Masterplan.landmarks().find(s=>s.tools.includes(d.id));if(site){const x=site.cache.x,z=site.cache.z,y=this.voxels.groundHeightAt(x,z,this.voxels.terrainHeightAt(x,z)+C.HEIGHT_REACH);spot=new THREE.Vector3(x,y+C.CLEARANCE+model.half.y,z);}
   if(!spot){console.error('No reachable tool site',d.id);continue;}
   mesh.position.copy(spot);this.scene.add(mesh);const p={id:`tool:${d.id}`,type:d.id,kind:'tool',mesh,half:model.half.toArray(),size:Math.max(...model.half.toArray())*2,mass:C.MASS,remaining:d.supply.capacity,loose:false,attached:false,held:false,home:spot.clone()};this.pickups.push(p);eventBus.emit(Events.PROP_CREATE,p);eventBus.emit(Events.ENTITY_REGISTER,p);
  }
 }
 allowed(){return gameState.vehicle.phase==='onFoot'&&gameState.game.isPlaying&&!gameState.game.paused&&!gameState.player.stunned&&!this.input.suppressed&&gameState.arrival.phase==='done'&&this.jimothy.move?.kind!=='roll';}
 nearest(){let best=null,distance=C.PICKUP_REACH+this.jimothy.radius;const j=this.jimothy.body.position;for(const p of this.pickups){if(p.held||p.attached||p.remaining<=0)continue;const v=p.mesh.position;if(Math.abs(v.y-(j.y-this.jimothy.radius))>C.HEIGHT_REACH+this.jimothy.radius)continue;const d=Math.hypot(v.x-j.x,v.z-j.z);if(d<distance&&this.clear(j,v)){best=p;distance=d;}}return best;}
 syncSupply(){const p=this.equipped,d=this.catalog.find(d=>d.id===p?.type);gameState.tools.supply=d?{remaining:p.remaining,capacity:d.supply.capacity,unit:d.supply.unit}:null;}
 notify(message,kind='dry'){if(this.notice!==message||this.time>=this.noticeUntil)this.sound.play(kind,this.jimothy.body.position);this.notice=message;this.noticeUntil=this.time+C.NOTICE_SECONDS;}
 deny(message){this.notify(message);return null;}
 equip(p){if(!p||p.attached||p.held||p.remaining<=0||!this.ready)return;this.drop();this.equipped=p;p.held=true;p.mesh.visible=true;eventBus.emit(Events.PROP_SUSPEND,{id:p.id});eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});gameState.tools.equipped=p.type;this.cooldown=0;this.notice='';this.syncSupply();this.pose();this.sound.play('pickup',p.mesh.position);}
 drop({exhausted=false}={}){
  this.towing=null;this.ropeLife=0;this.rope.visible=false;this.anchor=null;this.sound.stop();
  // M63: the final movement pulse already has a short lifetime. Cancelling it
  // here would charge for an action that never gets a simulation step.
  if(!exhausted)eventBus.emit(Events.PLAYER_TOOL_MOTION,{mode:'clear'});
  const p=this.equipped;if(!p)return;const j=this.jimothy.body.position,dir=this.direction();
  if(!exhausted){const r=this.jimothy.radius+C.PILE_DISTANCE,x=j.x+dir.x*r,z=j.z+dir.z*r,y=this.voxels.groundHeightAt(x,z,j.y+C.HEIGHT_REACH);p.mesh.position.set(x,y+p.half[1]+C.CLEARANCE,z);p.mesh.quaternion.identity();}
  p.mesh.scale.setScalar(1);p.held=false;p.loose=true;this.equipped=null;gameState.tools.equipped=null;this.syncSupply();eventBus.emit(Events.ENTITY_REGISTER,p);eventBus.emit(Events.PROP_RELEASE,{id:p.id,position:p.mesh.position});
  if(exhausted){const velocity=this.jimothy.vel.clone().multiplyScalar(C.DISCARD_INHERIT).clampLength(0,C.DISCARD_INHERIT_MAX).addScaledVector(dir,C.DISCARD_SPEED);velocity.y+=C.DISCARD_LIFT;eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity:velocity.toArray(),spin:C.DISCARD_SPIN});this.discards++;this.notify(`${this.catalog.find(d=>d.id===p.type).name} EMPTY — THROWN AWAY`,'empty');}
 }
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
 releaseStatus(id){const s=this.statuses.get(id);if(!s)return;this.statuses.delete(id);s.visual?.removeFromParent();if(s.ownMaterial)s.visual.material.dispose();for(const b of s.saved||[]){b.bone.quaternion.copy(b.q);b.bone.position.copy(b.position);}if(s.rotation)s.entity.mesh.quaternion.copy(s.rotation);const e=s.entity;e.attached=false;const pos=e.mesh.getWorldPosition(new THREE.Vector3()),ground=this.voxels.groundHeightAt(pos.x,pos.z,pos.y+C.HEIGHT_REACH);this.scene.attach(e.mesh);eventBus.emit(Events.ENTITY_RELEASE,{id,position:pos,ground});}
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
 prepareUse(d,targets,dir){
  const j=this.jimothy,plan={};
  if(['grapple','skates','pogo','glider'].includes(d.mode)){
   if(j.radius>C.MOTION_RADIUS)return this.deny('TOO BIG FOR THIS TOOL');
   if(j.swimming||j.move)return this.deny('WAIT UNTIL YOU CAN MOVE FREELY');
   if(d.mode==='glider'&&j.grounded)return this.deny('OPEN THE GLIDER WHILE AIRBORNE');
   if(d.mode==='pogo'&&!j.grounded)return this.deny('LAND BEFORE THE NEXT HOP');
  }
  if(d.mode==='grapple'){plan.anchor=this.cast(d.range);if(!plan.anchor)return this.deny('AIM AT SOLID SCENERY');}
  if(d.mode==='tow'){plan.target=targets.find(t=>t.entity.kind!=='person'&&t.entity.kind!=='food'&&(t.entity.mass||Infinity)<=Math.min(C.TOW_MASS_MAX,C.TOW_MASS*j.radius*j.radius));if(!plan.target)return this.deny('AIM AT A LIGHT MOVABLE OBJECT');}
  if(['foam','trampoline'].includes(d.mode)){plan.site=this.deploySite(d.mode,dir);if(!plan.site)return this.deny('NO CLEAR PLACE TO DEPLOY');}
  if(d.mode==='firework'&&this.projectiles.length>=C.PROJECTILE_LIMIT)return this.deny('WAIT FOR A ROCKET TO FINISH');
  if(d.mode==='stink'&&this.clouds.length>=C.CLOUD_LIMIT)return this.deny('WAIT FOR A CLOUD TO CLEAR');
  if(['bubble','stun','dance','sick'].includes(d.mode)&&this.statuses.size>=C.STATUS_LIMIT)return this.deny('WAIT FOR AN EFFECT TO FINISH');
  return plan;
 }
 use(dt){
  if(!this.equipped||!this.allowed()||this.cooldown>0)return false;
  const p=this.equipped,d=this.catalog.find(d=>d.id===p.type);
  if(p.remaining<d.supply.cost){this.drop({exhausted:true});return false;}
  if(gameState.tools.energy<d.cost){this.deny('EAT FOOD TO RESTORE ENERGY');return false;}
  const targets=this.targets(d),dir=this.direction(),j=this.jimothy,plan=this.prepareUse(d,targets,dir);if(!plan)return false;
  gameState.tools.energy-=d.cost;p.remaining=Math.max(0,p.remaining-d.supply.cost);this.syncSupply();this.cooldown+=d.interval;this.shots++;this.notice='';let affected=0;
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
   else if(d.mode==='confetti'&&e.kind==='person'){eventBus.emit(Events.WORLD_IMPACT,{x:point.x,y:point.y,z:point.z,radius:C.CONTACT_PAD,source:'confetti',instigator:'player'});affected++;}
  }
  if(d.mode==='extinguisher'){const v=j.vel.clone().addScaledVector(dir,-d.force);eventBus.emit(Events.PLAYER_LAUNCHED,{velocity:[v.x,d.force,v.z],seconds:d.interval,mass:C.FORCE_MASS,keepTool:true,ragdoll:false});}
  affected+=this.extraUse(d,targets,dir,plan);
  if(affected)eventBus.emit(Events.TOOL_CHAOS,{points:C.CHAOS});this.burst(d);
  if(p.remaining<d.supply.cost&&this.equipped===p)this.drop({exhausted:true});return true;
 }
 interrupt(e,kind,d){
  if(e.kind!=='person'||e.attached||this.statuses.has(e.id)||this.statuses.size>=C.STATUS_LIMIT)return false;
  eventBus.emit(Events.ENTITY_ATTACH,{id:e.id});e.attached=true;
  const saved=[],human=this.humans.get(e.id);human?.visual.traverse(b=>{if(b.isBone)saved.push({bone:b,q:b.quaternion.clone(),position:b.position.clone()});});
  const material=this.bubbleMaterial.clone();material.color.setHex(d.color);const visual=new THREE.Mesh(this.ball,material);visual.scale.setScalar(C.STATUS_ICON);this.scene.add(visual);
  this.statuses.set(e.id,{entity:e,kind,age:0,life:d.life||C.STUN_LIFE,base:e.mesh.position.clone(),rotation:e.mesh.quaternion.clone(),saved,visual,ownMaterial:true});return true;
 }
 animateStatus(s,dt){
  const e=s.entity,phase=s.age*C.DANCE_HZ;for(const b of s.saved||[]){b.bone.quaternion.copy(b.q);b.bone.position.copy(b.position);}
  if(s.kind==='bubble'){e.mesh.position.copy(s.base);e.mesh.position.y+=Math.min(s.age,C.BUBBLE_RISE)+Math.sin(s.age*C.STATUS_HZ)*C.STATUS_WOBBLE;}
  else if(s.kind==='dance'||s.kind==='sick')for(const b of s.saved||[]){
   if(b.bone.name==='spine_03'){b.bone.rotation.x+=s.kind==='sick'?C.SICK_BEND:C.DANCE_BEND*Math.sin(phase);b.bone.rotation.z+=Math.sin(phase)*C.DANCE_SWAY;}
   if(s.kind==='dance'&&b.bone.name.startsWith('upperarm_'))b.bone.rotation.z+=Math.sin(phase+(b.bone.name.endsWith('_l')?0:Math.PI))*C.DANCE_ARM;
   if(s.kind==='sick'&&b.bone.name.startsWith('lowerarm_'))b.bone.rotation.x+=C.SICK_ARM;
  }
  else if(s.kind==='repel'){
   const dir=e.mesh.position.clone().sub(s.source);dir.y=0;if(dir.lengthSq()<C.CLEARANCE)dir.set(1,0,0);dir.normalize();const next=e.mesh.position.clone().addScaledVector(dir,C.REPEL_SPEED*dt),h=this.voxels.groundHeightAt(next.x,next.z,e.mesh.position.y+C.HEIGHT_REACH);
   if(Math.abs(h-e.mesh.position.y)<C.REPEL_STEP&&!this.voxels.solidAtWorld(next.x,h+C.PERSON_HEIGHT,next.z)){e.mesh.position.set(next.x,h,next.z);e.mesh.rotation.y=Math.atan2(dir.x,dir.z);}
   for(const b of s.saved||[])if(b.bone.name.startsWith('thigh_'))b.bone.rotation.x+=Math.sin(phase+(b.bone.name.endsWith('_l')?0:Math.PI))*C.DANCE_ARM;
  }
  s.visual.position.copy(e.mesh.position);s.visual.position.y+=s.kind==='bubble'?C.PERSON_HEIGHT:C.STATUS_ICON_HEIGHT;
  if(s.kind==='sick'&&Math.floor(s.age*C.STATUS_HZ)!==Math.floor((s.age-dt)*C.STATUS_HZ))this.burst({color:C.SICK_COLOR,mode:'sick'},s.visual.position,C.SICK_PARTICLES);
 }
 cast(range){const origin=new THREE.Vector3().copy(this.jimothy.body.position),dir=this.direction();for(let t=this.jimothy.radius+C.CLEARANCE;t<=range;t+=C.RAY_STEP){const p=origin.clone().addScaledVector(dir,t);if(this.voxels.solidAtWorld(p.x,p.y,p.z))return p;}return null;}
 motion(mode,dir,force){eventBus.emit(Events.PLAYER_TOOL_MOTION,{mode,dir:dir.toArray(),force,life:C.MOTION_LIFE});}
 extraUse(d,targets,dir,plan){
  const j=this.jimothy;let affected=0;
  if(['stun','dance','sick'].includes(d.mode)){for(const {entity:e}of targets)if(this.interrupt(e,d.mode,d)){affected++;if(d.mode!=='stun')break;}}
  if(d.mode==='glove'){const target=targets.find(t=>t.entity.kind!=='food');if(target){const {entity:e,point}=target;if(e.kind==='person')eventBus.emit(Events.HUMAN_IMPACT,{id:e.id,x:point.x-dir.x,y:point.y,z:point.z-dir.z,radius:C.GLOVE_RADIUS,source:'glove',power:C.GLOVE_POWER});else this.force(e,dir,d.force);affected++;}}
  if(d.mode==='stink'&&this.clouds.length<C.CLOUD_LIMIT){const position=new THREE.Vector3().copy(j.body.position).addScaledVector(dir,C.CLOUD_THROW),material=this.bubbleMaterial.clone();material.color.setHex(d.color);const mesh=new THREE.Mesh(this.ball,material);mesh.position.copy(position);mesh.scale.setScalar(C.CLOUD_RADIUS);this.scene.add(mesh);this.clouds.push({mesh,life:C.CLOUD_LIFE,phase:0});}
  if(d.mode==='plunger'){const e=targets.find(t=>t.entity.kind==='car')?.entity;if(e){eventBus.emit(Events.VEHICLE_TOOL_SLOW,{id:e.id,seconds:C.PLUNGER_LIFE});this.splat(e,d.color);affected++;}}
  if(d.mode==='tow'){this.towing={entity:plan.target.entity,life:C.TOW_LIFE};this.pullTow();affected++;}
  if(d.mode==='grapple'){this.anchor=plan.anchor;this.ropeLife=C.MOTION_LIFE;this.motion('grapple',plan.anchor.clone().sub(j.body.position).normalize(),d.force);}
  if(['skates','pogo','glider'].includes(d.mode)&&j.radius<=C.MOTION_RADIUS)this.motion(d.mode,dir,d.force);
  if(d.mode==='shield'){gameState.tools.shield=C.SHIELD_LIFE;this.shieldMesh.visible=true;}
  if(['foam','trampoline'].includes(d.mode))this.deploy(d.mode,dir,plan.site);
  if(d.mode==='dig'){const x=j.body.position.x+dir.x*(j.radius+C.DIG_FORWARD),z=j.body.position.z+dir.z*(j.radius+C.DIG_FORWARD),y=this.voxels.groundHeightAt(x,z,j.body.position.y+C.HEIGHT_REACH);const hit={x,y:y-C.DIG_DEPTH,z,radius:C.DIG_RADIUS,digsTerrain:true,instigator:'player'};eventBus.emit(Events.WORLD_BLAST,hit);eventBus.emit(Events.WORLD_IMPACT,hit);this.burst(d,new THREE.Vector3(x,y,z));affected++;}
  if(d.mode==='firework'&&this.projectiles.length<C.PROJECTILE_LIMIT){const mesh=new THREE.Mesh(this.rocketGeometry,this.rocketMaterial);mesh.position.copy(j.body.position).addScaledVector(dir,j.radius+C.PROJECTILE_OFFSET);this.scene.add(mesh);this.projectiles.push({mesh,velocity:dir.clone().multiplyScalar(C.PROJECTILE_SPEED).add(new THREE.Vector3(0,C.PROJECTILE_LIFT,0)),life:C.PROJECTILE_LIFE});}
  return affected;
 }
 deploySite(kind,dir){
  const j=this.jimothy.body.position,forward=this.jimothy.radius+C.DEVICE_FORWARD,position=new THREE.Vector3(j.x+dir.x*forward,j.y,j.z+dir.z*forward),ground=this.voxels.groundHeightAt(position.x,position.z,j.y+C.HEIGHT_REACH),half=kind==='foam'?C.FOAM_HALF:C.PAD_HALF;
  position.y=ground+half[1]+C.CLEARANCE;if(!this.clear(j,position)||this.voxels.solidAtWorld(position.x,position.y,position.z))return false;
  return{position,half};
 }
 deploy(kind,dir,site=this.deploySite(kind,dir)){
  if(!site)return false;const {position,half}=site;
  if(this.devices.length>=C.DEVICE_LIMIT)this.removeDevice(this.devices[0]);
  const mesh=new THREE.Group();if(kind==='foam'){const m=new THREE.Mesh(this.ball,this.foamMaterial);m.scale.set(...half);mesh.add(m);}else{const m=this.models.get('trampoline-popper').root.clone(true);m.scale.multiplyScalar(C.PAD_MODEL_SCALE);mesh.add(m);}
  mesh.position.copy(position);this.scene.add(mesh);const p={id:`tool-device:${this.serial++}`,kind,mesh,half:[...half],size:Math.max(...half)*2,mass:C.DEVICE_MASS,life:C.DEVICE_LIFE,bounce:0,loose:false,attached:false};this.devices.push(p);eventBus.emit(Events.PROP_CREATE,p);eventBus.emit(Events.ENTITY_REGISTER,p);return true;
 }
 removeDevice(p){eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});eventBus.emit(Events.PROP_REMOVE,{id:p.id});p.mesh.removeFromParent();this.devices.splice(this.devices.indexOf(p),1);}
 pullTow(){const s=this.towing;if(!s)return;const e=s.entity,j=this.jimothy.body.position,delta=new THREE.Vector3().copy(j).sub(e.mesh.position);if(e.attached||!e.mesh.parent||delta.length()>C.TOW_RANGE||!this.clear(j,e.mesh.position)){this.towing=null;return;}delta.y=0;const distance=delta.length();if(distance>this.jimothy.radius+C.TOW_REST)this.force(e,delta.normalize(),Math.min(C.TOW_SPEED,(distance-this.jimothy.radius-C.TOW_REST)*C.TOW_GAIN));}
 updateExtras(dt){
  const j=this.jimothy;gameState.tools.shield=Math.max(0,(gameState.tools.shield||0)-dt);this.shieldMesh.visible=gameState.tools.shield>0&&gameState.game.isPlaying;this.shieldMesh.position.copy(j.body.position);this.shieldMesh.scale.setScalar(j.radius+C.SHIELD_PAD);
  if(this.towing){this.towing.life-=dt;if(this.towing.life<=0||this.equipped?.type!=='tow-reel'||!this.allowed())this.towing=null;else this.pullTow();}
  this.ropeLife=Math.max(0,(this.ropeLife||0)-dt);const end=this.towing?.entity.mesh.position||(this.ropeLife>0?this.anchor:null);this.rope.visible=!!end&&!!this.equipped;if(this.rope.visible){const a=this.rope.geometry.attributes.position;a.setXYZ(0,...this.equipped.mesh.position.toArray());a.setXYZ(1,end.x,end.y,end.z);a.needsUpdate=true;this.rope.geometry.computeBoundingSphere();}
  for(const cloud of [...this.clouds]){cloud.life-=dt;cloud.phase+=dt;cloud.mesh.scale.setScalar(C.CLOUD_RADIUS*(1+C.STATUS_WOBBLE*Math.sin(cloud.phase*C.STATUS_HZ)));if(cloud.life<=0){cloud.mesh.removeFromParent();cloud.mesh.material.dispose();this.clouds.splice(this.clouds.indexOf(cloud),1);continue;}for(const e of this.entities.values())if(e.kind==='person'&&!e.attached&&e.mesh.position.distanceTo(cloud.mesh.position)<C.CLOUD_RADIUS+C.PERSON_HEIGHT&&this.clear(cloud.mesh.position,e.mesh.position.clone().add(new THREE.Vector3(0,C.PERSON_HEIGHT,0)))){if(this.interrupt(e,'repel',{color:C.STINK_COLOR,life:C.REPEL_LIFE})){this.statuses.get(e.id).source=cloud.mesh.position.clone();eventBus.emit(Events.TOOL_CHAOS,{points:C.CHAOS});}}}
  for(const p of [...this.devices]){p.life-=dt;p.bounce=Math.max(0,p.bounce-dt);if(p.life<=0){this.removeDevice(p);continue;}if(p.kind!=='trampoline'||p.attached||p.bounce>0)continue;const top=p.mesh.position.y+p.half[1];if(j.radius<=C.MOTION_RADIUS&&Math.hypot(j.body.position.x-p.mesh.position.x,j.body.position.z-p.mesh.position.z)<p.half[0]&&Math.abs(j.body.position.y-j.radius-top)<C.PAD_CONTACT&&j.vy<=0){this.motion('bounce',new THREE.Vector3(0,1,0),C.PAD_FORCE);p.bounce=C.PAD_COOLDOWN;}for(const e of this.entities.values())if(e!==p&&!e.held&&!e.attached&&e.mesh.position.distanceTo(p.mesh.position)<p.size&&e.mass&&e.mass<=C.TOW_MASS_MAX&&e.mesh.position.y>=p.mesh.position.y){this.force(e,new THREE.Vector3(0,1,0),C.PAD_FORCE);p.bounce=C.PAD_COOLDOWN;break;}}
  for(const p of [...this.projectiles]){p.life-=dt;const old=p.mesh.position.clone();p.velocity.y-=C.PROJECTILE_GRAVITY*dt;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),p.velocity.clone().normalize());const contact=!this.clear(old,p.mesh.position)||this.voxels.solidAtWorld(p.mesh.position.x,p.mesh.position.y,p.mesh.position.z);if(p.life<=0||contact){const hit={...p.mesh.position,radius:C.FIREWORK_RADIUS,digsTerrain:false,source:'firework',instigator:'player'};eventBus.emit(Events.WORLD_BLAST,hit);eventBus.emit(Events.WORLD_IMPACT,hit);eventBus.emit(Events.EXPLOSION_SPAWN,hit);eventBus.emit(Events.TOOL_CHAOS,{points:C.CHAOS});p.mesh.removeFromParent();this.projectiles.splice(this.projectiles.indexOf(p),1);this.blasts++;}else this.burst({color:C.FIREWORK_COLOR,mode:'spark'},p.mesh.position,C.PROJECTILE_TRAIL);}
 }
 clearExtras(){for(const p of [...this.devices])this.removeDevice(p);for(const p of this.clouds){p.mesh.removeFromParent();p.mesh.material.dispose();}for(const p of this.projectiles)p.mesh.removeFromParent();this.clouds=[];this.projectiles=[];this.towing=null;this.anchor=null;this.ropeLife=0;this.rope.visible=false;this.shieldMesh.visible=false;gameState.tools.shield=0;eventBus.emit(Events.PLAYER_TOOL_MOTION,{mode:'clear'});this.blasts=0;this.serial=0;}
 update(dt){if(!this.allowed())this.sound.stop();if(!this.ready||gameState.game.paused)return;this.time+=dt;if(this.time>=this.noticeUntil)this.notice='';
  // Preserve the fractional interval remainder, with at most one use per
  // frame. Clamping to zero made 30 Hz devices consume charge more slowly.
  this.cooldown=Math.max(-dt,this.cooldown-dt);const pickup=this.input.consumeTool(),drop=this.input.consumeDrop();if(this.allowed()){if(drop)this.drop();if(pickup)this.equip(this.nearest());if(this.input.toolUse)this.use(dt);}this.pose();
  for(const [id,s]of this.statuses){s.age+=dt;if(s.age>=s.life||!gameState.game.isPlaying){this.releaseStatus(id);continue;}this.animateStatus(s,dt);}
  this.updateExtras(dt);
  for(const p of [...this.paint]){p.life-=dt;if(p.life<=0||!this.entities.has(p.owner.id))this.removePaint(p);}
  this.particles=this.particles.filter(p=>{p.life-=dt;p.position.addScaledVector(p.velocity,dt);return p.life>0;});this.effects.count=this.particles.length;this.particles.forEach((p,i)=>{this.matrix.position.copy(p.position);this.matrix.scale.setScalar(p.size*p.life/C.EFFECT_LIFE);this.matrix.updateMatrix();this.effects.setMatrixAt(i,this.matrix.matrix);this.effects.setColorAt(i,new THREE.Color(p.color));});this.effects.instanceMatrix.needsUpdate=true;if(this.effects.instanceColor)this.effects.instanceColor.needsUpdate=true;
  for(const p of this.pickups)if(!p.held&&!p.attached)p.mesh.visible=p.mesh.position.distanceTo(this.jimothy.body.position)<C.RENDER_DISTANCE+this.jimothy.radius;
  const near=this.nearest(),d=this.catalog.find(d=>d.id===this.equipped?.type),energy=Math.round(gameState.tools.energy);const base=d?`${d.name} · ${this.equipped.remaining}/${d.supply.capacity} ${d.supply.unit.toUpperCase()}\nFOOD ENERGY ${energy}/${C.ENERGY_MAX} · ${d.description}\nMouse / V / RB use · G / B drop${near?' · T / LB swap: '+this.catalog.find(d=>d.id===near.type).name:''}`:near?`T / LB pick up ${this.catalog.find(d=>d.id===near.type).name}`:'';const text=[this.notice,base].filter(Boolean).join('\n');if(this.panel.textContent!==text)this.panel.textContent=text;this.panel.hidden=!text;
 }
 reset(){this.sound.stop();this.notice='';this.noticeUntil=0;this.discards=0;this.clearStatuses();this.clearExtras();this.equipped=null;for(const p of this.pickups){eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});eventBus.emit(Events.PROP_REMOVE,{id:p.id});p.mesh.removeFromParent();}this.pickups=[];for(const p of [...this.paint])this.removePaint(p);this.particles=[];this.effects.count=0;this.cooldown=0;this.time=0;this.shots=0;this.aimOverride=null;gameState.tools.equipped=null;this.syncSupply();this.panel.textContent='';this.panel.hidden=true;if(this.ready)this.spawn();}
 snapshot(){return {supply:gameState.tools.supply,notice:this.notice,discards:this.discards,audio:this.sound.snapshot(),devices:this.devices.length,clouds:this.clouds.length,projectiles:this.projectiles.length,blasts:this.blasts,towing:this.towing?.entity.id||null,shield:gameState.tools.shield||0,ready:this.ready,catalog:this.catalog.map(d=>d.id),equipped:this.equipped?.type||null,heldVisible:!!this.equipped?.mesh.visible,energy:+gameState.tools.energy.toFixed(2),pickups:this.pickups.map(p=>({id:p.id,type:p.type,x:p.mesh.position.x,y:p.mesh.position.y,z:p.mesh.position.z,held:p.held,attached:p.attached,remaining:p.remaining})),effects:this.particles.length,statuses:this.statuses.size,paint:this.paint.length,shots:this.shots,limit:C.LIMIT};}
}
