import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MILITARY as C} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';
import {groundVehicle} from '../core/Grounding.js';
import {segmentSphere} from '../core/ProjectileContact.js';
import {TrafficFlow} from '../core/TrafficFlow.js';
import {buildTrafficRoutes} from '../level/TrafficRoutes.js';
import * as Layout from '../level/Layout.js';

export class Military {
 constructor(scene,jimothy,voxels){
  this.scene=scene;this.jimothy=jimothy;this.voxels=voxels;this.units=[];this.wreckage=[];this.projectiles=[];this.templates={};this.serial=0;this.time=0;this.cooldown={tank:0,jet:0};this.shots=0;this.impacts=0;this.launches=0;this.launchCooldown=0;this.ready=false;
  this.routes=buildTrafficRoutes();this.flow=new TrafficFlow(this.routes,(x,z)=>Layout.roadAtWorld(x,z));
  this.markerGeometry=new THREE.RingGeometry(C.WARNING_INNER,1,C.WARNING_SEGMENTS);this.markerMaterial=new THREE.MeshBasicMaterial({color:C.WARNING_COLOR,side:THREE.DoubleSide,transparent:true,opacity:C.WARNING_OPACITY,depthWrite:false,toneMapped:false});
  this.shellGeometry=new THREE.SphereGeometry(C.SHELL_SIZE,C.SHELL_SEGMENTS,C.SHELL_SEGMENTS);this.shellMaterial=new THREE.MeshBasicMaterial({color:C.SHELL_COLOR,toneMapped:false});
  Promise.all(['tank','jet'].map(async kind=>{
   const asset=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/military/${kind}.glb`),root=new THREE.Group();asset.scene.updateMatrixWorld(true);
   asset.scene.traverse(o=>{if(o.isMesh){const m=new THREE.Mesh(o.geometry.clone().applyMatrix4(o.matrixWorld),o.material);m.name=o.name;m.castShadow=m.receiveShadow=true;m.userData.farDetail=kind==='jet';root.add(m);}});
   const box=new THREE.Box3().setFromObject(root),centre=box.getCenter(new THREE.Vector3()),half=box.getSize(new THREE.Vector3()).multiplyScalar(.5);
   root.children.forEach(m=>m.geometry.translate(-centre.x,-centre.y,-centre.z));root.userData.half=half.toArray();this.templates[kind]=root;
  })).then(()=>{this.ready=true;}).catch(e=>console.error('Military assets failed',e));
  eventBus.on(Events.WORLD_IMPACT,e=>{for(const u of [...this.units])if(!u.attached&&e.radius>=C.BREAK_RADIUS&&u.mesh.position.distanceTo(new THREE.Vector3(e.x,e.y,e.z))<e.radius+u.half[2])this.breakUnit(u);});
  eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.find(id);if(p){p.attached=true;p.phase='carried';p.warning?.removeFromParent();eventBus.emit(Events.PROP_SUSPEND,{id});}});
  eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{const p=this.find(id);if(p){p.attached=false;p.phase='wreck';p.life=C.WRECK_LIFE;p.mesh.position.set(position.x,ground+p.half[1],position.z);eventBus.emit(Events.PROP_RELEASE,{id,position:p.mesh.position});}});
  eventBus.on(Events.TRAFFIC_OBSTACLES,({obstacles})=>{for(const u of this.units)if(u.kind==='tank'&&!u.attached)obstacles.push({id:u.id,x:u.mesh.position.x,y:u.mesh.position.y,z:u.mesh.position.z,radius:u.half[2]});});
 }
 find(id){return this.units.find(u=>u.id===id)||this.wreckage.find(u=>u.id===id);}
 ground(x,z){return this.voxels.groundHeightAt(x,z,this.voxels.terrainHeightAt(x,z)+C.GROUND_SCAN);}
 register(p,loose=false){this.scene.add(p.mesh);eventBus.emit(Events.PROP_CREATE,{...p,mass:C.MASS,loose});eventBus.emit(Events.ENTITY_REGISTER,{id:p.id,mesh:p.mesh,kind:p.kind,size:Math.max(...p.half)*2});}
 spawn(kind){
  const j=this.jimothy,mesh=this.templates[kind].clone(),half=[...mesh.userData.half],u={id:`army-${this.serial++}`,kind,mesh,half,phase:'approach',clock:0,life:C.WRECK_LIFE,seed:this.serial,attached:false};
  if(kind==='tank'){
   const candidates=this.routes.roads.map(road=>{const d=road.length/2,point={x:road.start.x+road.dir.x*d,z:road.start.z+road.dir.z*d};return{road,d,point,distance:Math.hypot(point.x-j.position.x,point.z-j.position.z)};}).filter(p=>p.distance>j.radius+C.TANK_MIN_SPAWN&&p.distance<j.radius+C.TANK_MAX_SPAWN&&!this.units.some(u=>u.mesh.position.distanceTo(new THREE.Vector3(p.point.x,u.mesh.position.y,p.point.z))<C.TANK_SEPARATION));
   candidates.sort((a,b)=>Math.abs(a.distance-(j.radius+C.TANK_SPAWN))-Math.abs(b.distance-(j.radius+C.TANK_SPAWN)));if(!candidates.length)return null;
   this.flow.assign(u,candidates[0].road,candidates[0].d);this.aimRoute(u);groundVehicle(mesh,half,(x,z)=>this.ground(x,z));
   const turret=new THREE.Group(),parts=mesh.children.filter(m=>/turret|barrel/.test(m.name)),box=new THREE.Box3();parts.forEach(m=>{m.geometry.computeBoundingBox();box.union(m.geometry.boundingBox);});turret.position.copy(box.getCenter(new THREE.Vector3()));turret.position.z=0;mesh.add(turret);mesh.updateMatrixWorld(true);parts.forEach(m=>turret.attach(m));u.turret=turret;
  }else{
   const angle=(this.serial*C.JET_HEADING)% (Math.PI*2);u.direction=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle));u.target=new THREE.Vector3(j.position.x,this.ground(j.position.x,j.position.z),j.position.z);u.altitude=Math.max(j.body.position.y,...Array.from({length:C.JET_GROUND_SAMPLES},(_,i)=>{const d=(i/(C.JET_GROUND_SAMPLES-1)*2-1)*C.JET_APPROACH;return this.voxels.terrainHeightAt(u.target.x+u.direction.x*d,u.target.z+u.direction.z*d); }))+C.JET_ALTITUDE;u.travel=-C.JET_APPROACH;
   u.passAltitude=j.body.position.y+Math.max(C.JET_PASS_MIN,j.radius*C.JET_PASS_BODY);
   mesh.position.copy(u.target).addScaledVector(u.direction,u.travel);mesh.position.y=u.altitude;mesh.rotation.y=angle;u.warning=this.warning(u.target,C.JET_BLAST);u.phase='approach';
  }
  this.units.push(u);this.register(u);return u;
 }
 aimRoute(u){
  const r=u.route,options=r.road.to.outgoing.filter(next=>this.flow.path(r.road,next).valid),j=this.jimothy.position;
  const onward=options.filter(next=>next.to!==r.road.from);const choices=onward.length?onward:options;choices.sort((a,b)=>Math.hypot(a.end.x-j.x,a.end.z-j.z)-Math.hypot(b.end.x-j.x,b.end.z-j.z));r.next=choices[0]||null;
 }
 drive(u,dt){
  const r=u.route;r.distance+=C.TANK_SPEED*dt;
  if(!r.connector&&r.distance>=r.road.length){if(!r.next){r.distance=r.road.length;return;}r.distance-=r.road.length;r.connector=this.flow.path(r.road,r.next);}
  if(r.connector&&r.distance>=r.connector.length){r.distance-=r.connector.length;r.road=r.next;r.connector=null;this.aimRoute(u);}
  this.flow.pose(u);groundVehicle(u.mesh,u.half,(x,z)=>this.ground(x,z));
 }
 warning(target,radius){const m=new THREE.Mesh(this.markerGeometry,this.markerMaterial);m.rotation.x=-Math.PI/2;m.position.copy(target);m.position.y+=C.WARNING_LIFT;m.userData.radius=radius+this.jimothy.radius*C.WARNING_BODY_RADIUS;m.scale.setScalar(m.userData.radius);this.scene.add(m);return m;}
 fire(u,target,radius){
  if(this.projectiles.length>=C.MAX_PROJECTILES){u.warning?.removeFromParent();u.warning=null;return;}
  const from=u.mesh.position.clone();if(u.kind==='tank')from.y+=u.half[1]*C.MUZZLE_HEIGHT;
  const mesh=new THREE.Mesh(this.shellGeometry,this.shellMaterial);mesh.position.copy(from);this.scene.add(mesh);
  this.projectiles.push({mesh,from,target:target.clone(),radius,age:0,duration:u.kind==='tank'?C.SHELL_SECONDS:C.BOMB_SECONDS,warning:u.warning});u.warning=null;this.shots++;
 }
 explode(target,radius){
  this.impacts++;eventBus.emit(Events.EXPLOSION_SPAWN,{...target,radius});eventBus.emit(Events.WORLD_BLAST,{...target,radius,digsTerrain:false});eventBus.emit(Events.WORLD_IMPACT,{...target,radius});
  const j=this.jimothy,distance=j.body.position.distanceTo(target);
  if(distance<radius+j.radius&&this.launchCooldown<=0){this.launchCooldown=C.HIT_IMMUNITY;const direction=new THREE.Vector3().subVectors(j.body.position,target);direction.y=0;if(!direction.lengthSq())direction.z=1;direction.normalize();const speed=C.LAUNCH_SPEED/(1+j.radius*C.SIZE_RESISTANCE);
   eventBus.emit(Events.PLAYER_LAUNCHED,{velocity:[direction.x*speed,C.LAUNCH_UP/(1+j.radius*C.SIZE_RESISTANCE),direction.z*speed],seconds:C.LAUNCH_SECONDS,mass:C.PLAYER_MASS*(1+j.radius)});this.launches++;
  }
 }
 breakUnit(u){
  if(!this.units.includes(u)||u.attached)return;u.mesh.updateMatrixWorld(true);const fragments=[];u.mesh.traverse(m=>{if(m.isMesh)fragments.push(m);});
  for(const source of fragments){
   while(this.wreckage.length>=C.MAX_WRECKAGE){const old=this.wreckage.find(p=>!p.attached);if(!old)break;this.remove(old);}
   if(this.wreckage.length>=C.MAX_WRECKAGE)break;
   const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld),box=new THREE.Box3().setFromBufferAttribute(geometry.attributes.position),centre=box.getCenter(new THREE.Vector3()),half=box.getSize(new THREE.Vector3()).multiplyScalar(.5);geometry.translate(-centre.x,-centre.y,-centre.z);
   const mesh=new THREE.Mesh(geometry,source.material);mesh.position.copy(centre);mesh.castShadow=mesh.receiveShadow=true;const p={id:`army-part-${this.serial++}`,kind:'military-part',mesh,half:half.toArray().map(v=>Math.max(C.PART_MIN,v)),phase:'wreck',life:C.WRECK_LIFE,ownedGeometry:true};this.wreckage.push(p);this.register(p,true);
   const angle=this.serial*C.PART_ANGLE;eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity:[Math.sin(angle)*C.PART_SPEED,C.PART_LIFT,Math.cos(angle)*C.PART_SPEED],spin:C.PART_SPIN});
  }
  eventBus.emit(Events.EXPLOSION_SPAWN,{...u.mesh.position,radius:C.TANK_BLAST});this.remove(u);
 }
 remove(p){p.warning?.removeFromParent();p.mesh.removeFromParent();if(p.ownedGeometry)p.mesh.geometry.dispose();eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});eventBus.emit(Events.PROP_REMOVE,{id:p.id});for(const list of [this.units,this.wreckage]){const i=list.indexOf(p);if(i>=0)list.splice(i,1);}}
 update(dt){
  if(!this.ready||!gameState.game.isPlaying)return;this.time+=dt;this.launchCooldown=Math.max(0,this.launchCooldown-dt);const j=this.jimothy,tier=gameState.heat.tier;
  for(const kind of ['tank','jet']){this.cooldown[kind]=Math.max(0,this.cooldown[kind]-dt);const allowed=kind==='tank'?tier>=C.TANK_TIER||tier>=C.GIANT_TIER&&j.radius>=C.GIANT_RADIUS:tier>=C.JET_TIER&&j.radius>=C.GIANT_RADIUS;
   if(allowed&&!this.cooldown[kind]&&this.units.filter(u=>u.kind===kind).length<(kind==='tank'?C.MAX_TANKS:C.MAX_JETS)){this.spawn(kind);this.cooldown[kind]=kind==='tank'?C.TANK_INTERVAL:C.JET_INTERVAL;}
  }
  for(const u of [...this.units]){
   if(u.attached)continue;
   if(u.phase==='wreck'){u.life-=dt;if(u.life<=0)this.remove(u);continue;}
   if(u.mesh.position.distanceTo(j.body.position)>C.DESPAWN_DISTANCE+j.radius){this.remove(u);continue;}
   u.clock+=dt;
   if(u.kind==='tank'){
    const distance=u.mesh.position.distanceTo(j.body.position),targetYaw=Math.atan2(j.position.x-u.mesh.position.x,j.position.z-u.mesh.position.z)-u.mesh.rotation.y;
    u.turret.rotation.y=targetYaw;
    if(u.phase==='approach'){
     this.drive(u,dt);
     if(distance<C.TANK_RANGE+j.radius&&u.clock>=C.TANK_APPROACH_SECONDS){u.target=new THREE.Vector3(j.position.x,this.ground(j.position.x,j.position.z),j.position.z);u.warning=this.warning(u.target,C.TANK_BLAST);u.phase='aim';u.clock=0;}
    }else if(u.phase==='aim'&&u.clock>=C.TANK_WARNING){this.fire(u,u.target,C.TANK_BLAST);u.phase='cooldown';u.clock=0;}
    else if(u.phase==='cooldown'&&u.clock>=C.TANK_COOLDOWN){u.phase='approach';u.clock=0;}
   }else{
    u.travel+=C.JET_SPEED*dt;u.mesh.position.copy(u.target).addScaledVector(u.direction,u.travel);
    const dive=1-THREE.MathUtils.smoothstep(Math.abs(u.travel),0,C.JET_DIVE_DISTANCE);
    u.mesh.position.y=Math.max(this.voxels.terrainHeightAt(u.mesh.position.x,u.mesh.position.z)+C.JET_TERRAIN_CLEARANCE,
      THREE.MathUtils.lerp(u.altitude,u.passAltitude,dive)+Math.max(0,u.travel)*C.JET_CLIMB);
    if(u.phase==='approach'&&u.travel>=-C.JET_RELEASE){this.fire(u,u.target,C.JET_BLAST);u.phase='exit';}
    if(u.travel>C.JET_EXIT){this.remove(u);continue;}
   }
   if(u.warning)u.warning.scale.setScalar(u.warning.userData.radius*(1+C.WARNING_PULSE*Math.sin(this.time*C.WARNING_HZ)));
   eventBus.emit(Events.PROP_POSE,{id:u.id,position:u.mesh.position,quaternion:u.mesh.quaternion});
  }
  for(const p of [...this.projectiles]){
   const previous=p.mesh.position.clone();p.age+=dt;const t=Math.min(1,p.age/p.duration);p.mesh.position.lerpVectors(p.from,p.target,t);p.mesh.position.y+=Math.sin(t*Math.PI)*C.SHELL_ARC;
   const segment=p.mesh.position.clone().sub(previous),length=segment.length();
   const wall=this.voxels.raycast(previous.x,previous.y,previous.z,segment.x,segment.y,segment.z,length);
   const body=segmentSphere(previous,p.mesh.position,j.body.position,j.radius+C.SHELL_SIZE);
   const hit=body!==null&&(!wall||body*length<wall.t)?previous.clone().addScaledVector(segment,body):wall;
   if(hit||t>=1){this.explode(hit?{x:hit.x,y:hit.y,z:hit.z}:p.target,p.radius);p.mesh.removeFromParent();p.warning?.removeFromParent();this.projectiles.splice(this.projectiles.indexOf(p),1);}
  }
  for(const p of [...this.wreckage])if(!p.attached){p.life-=dt;if(p.life<=0||p.mesh.position.distanceTo(j.body.position)>C.DESPAWN_DISTANCE)this.remove(p);}
  const warning=this.units.some(u=>u.kind==='jet'&&u.phase==='approach')?'JET PASS — LEAVE THE MARKED AREA':this.units.some(u=>u.phase==='aim')?'TANK AIMING — KEEP MOVING':this.projectiles.length?'INCOMING!':'';
  if(warning!==gameState.world.military?.warning)eventBus.emit(Events.MILITARY_WARNING,{warning});gameState.world.military={warning};
 }
 reset(){for(const p of [...this.units,...this.wreckage])this.remove(p);for(const p of this.projectiles){p.mesh.removeFromParent();p.warning?.removeFromParent();}this.projectiles=[];this.cooldown={tank:0,jet:0};this.time=0;this.shots=this.impacts=this.launches=0;this.flow.reset();this.launchCooldown=0;gameState.world.military={warning:''};eventBus.emit(Events.MILITARY_WARNING,{warning:''});}
 snapshot(){return{ready:this.ready,warning:gameState.world.military?.warning||'',units:this.units.map(u=>({id:u.id,kind:u.kind,phase:u.phase,x:u.mesh.position.x,y:u.mesh.position.y,z:u.mesh.position.z,clock:u.clock,attached:!!u.attached})),projectiles:this.projectiles.length,wreckage:this.wreckage.length,shots:this.shots,impacts:this.impacts,launches:this.launches};}
}
