import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CRABS as C,SEWER} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';
import {solveTwoBone} from '../core/Grounding.js';
import * as Plan from '../level/CityPlanner.js';
import {profile} from '../level/SewerLayout.js';

// M48: articulated, shared Blender meshes replace the anonymous shell blobs.
// Crabs remain an underground ecology; they add neither heat nor run endings.
export class CrabPeople {
 constructor(scene,jimothy,voxels){
  Object.assign(this,{scene,jimothy,voxels,crabs:[],elapsed:0,alarmed:0,ready:false,serial:0});
  const loader=new GLTFLoader();this.loading=Promise.all(C.MODELS.map(kind=>loader.loadAsync(`${import.meta.env.BASE_URL}assets/models/sewer/${kind}.glb`))).then(models=>{this.models=models;this.ready=true;}).catch(e=>console.error('Crab assets failed',e));
  eventBus.on(Events.ENTITY_ATTACH,({id})=>{const c=this.crabs.find(c=>c.id===id);if(c){c.attached=true;c.displaced=true;}});
  eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{const c=this.crabs.find(c=>c.id===id);if(c){c.attached=false;c.x=position.x;c.z=position.z;c.y=ground;c.vy=0;c.mesh.quaternion.identity();c.alarm=C.SCUTTLE_SECONDS;c.legs.forEach(l=>l.target=null);}});
  eventBus.on(Events.WORLD_IMPACT,h=>{for(const c of this.crabs)if(!c.attached&&Math.hypot(c.x-h.x,c.y-h.y,c.z-h.z)<h.radius+C.SIZE){const d=Math.hypot(c.x-h.x,c.z-h.z)||1;c.kick={x:(c.x-h.x)/d*C.KNOCK_SPEED,z:(c.z-h.z)/d*C.KNOCK_SPEED,t:C.KNOCK_SECONDS};c.alarm=C.SCUTTLE_SECONDS;}});
 }
 remove(c){eventBus.emit(Events.ENTITY_UNREGISTER,{id:c.id});c.mesh.removeFromParent();this.crabs.splice(this.crabs.indexOf(c),1);}
 populate(){
  const j=this.jimothy.position,nodes=Plan.sewerNodesIn(j.x-C.RADIUS,j.z-C.RADIUS,j.x+C.RADIUS,j.z+C.RADIUS).sort((a,b)=>Math.hypot(a.x-j.x,a.z-j.z)-Math.hypot(b.x-j.x,b.z-j.z));
  for(const spot of nodes){
   if(this.crabs.length>=C.COUNT)break;
   if(Math.hypot(spot.x-j.x,spot.z-j.z)<C.SPAWN_GAP||this.crabs.some(c=>Math.hypot(c.x-spot.x,c.z-spot.z)<C.SPAWN_GAP))continue;
   const p=profile(spot.x,spot.z),y=this.voxels.groundHeightAt(spot.x,spot.z,p.floor+C.GROUND_SCAN);
   if(Math.abs(y-p.floor)>C.GROUND_SCAN||this.voxels.solidAtWorld(spot.x,y+C.WALL_SCAN,spot.z))continue;
   const index=this.serial%C.MODELS.length,mesh=new THREE.Group(),visual=this.models[index].scene.clone(true);mesh.add(visual);mesh.position.set(spot.x,y,spot.z);this.scene.add(mesh);mesh.updateMatrixWorld(true);
   const legs=Array.from({length:4},(_,i)=>{const hip=mesh.getObjectByName(`leg_${i}`),knee=mesh.getObjectByName(`knee_${i}`),foot=mesh.getObjectByName(`foot_${i}`);return {hip,knee,foot,rest:mesh.worldToLocal(foot.getWorldPosition(new THREE.Vector3())),hipQ:hip.quaternion.clone(),kneeQ:knee.quaternion.clone(),target:null};});
   const c={id:`crab:${this.serial++}`,kind:C.MODELS[index],x:spot.x,z:spot.z,y,vy:0,yaw:0,mesh,visual,legs,alarm:0,phase:0,wait:0,tx:spot.x,tz:spot.z,attached:false};
   this.crabs.push(c);eventBus.emit(Events.ENTITY_REGISTER,{id:c.id,mesh,kind:'crab-person',size:new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).length()});
  }
 }
 walkable(c,x,z){
  const y=this.voxels.groundHeightAt(x,z,c.y+C.GROUND_SCAN);
  return Math.abs(y-c.y)<=C.FLOOR_STEP&&!this.voxels.solidAtWorld(x,y+C.WALL_SCAN,z)&&!this.voxels.solidAtWorld(x,y+C.WALL_SCAN*2,z);
 }
 animate(c,dt,speed){
  const root=c.mesh;root.position.set(c.x,c.y,c.z);root.rotation.y=c.yaw+Math.PI/2;root.updateMatrixWorld(true);
  c.phase+=dt*C.STEP_HZ*(speed/C.SPEED);
  for(let i=0;i<c.legs.length;i++){
   const l=c.legs[i];l.hip.quaternion.copy(l.hipQ);l.knee.quaternion.copy(l.kneeQ);root.updateMatrixWorld(true);
   const phase=c.phase*Math.PI*2+(i===0||i===3?0:Math.PI),wave=Math.sin(phase);
   const home=root.localToWorld(l.rest.clone());home.y=this.voxels.groundHeightAt(home.x,home.z,c.y+C.GROUND_SCAN)+C.FOOT_CLEARANCE;
   // Alternate diagonal supports. The world target stays still during stance;
   // terrain only adjusts height, so lateral motion cannot skate the feet.
   if(!l.target||wave>0||home.distanceTo(l.target)>C.FOOT_STRIDE*2){l.target=home; l.target.addScaledVector(new THREE.Vector3(Math.sin(c.yaw),0,Math.cos(c.yaw)),wave*C.FOOT_STRIDE);}
   l.target.y=this.voxels.groundHeightAt(l.target.x,l.target.z,c.y+C.GROUND_SCAN)+C.FOOT_CLEARANCE+Math.max(0,wave)*C.FOOT_LIFT;
   solveTwoBone(l.hip,l.knee,l.foot,l.target,new THREE.Vector3(i<2?-1:1,0,0).applyQuaternion(root.quaternion));
  }
  for(const [i,side] of ['L','R'].entries()){
   const claw=root.getObjectByName(`claw_${side}`),pincer=root.getObjectByName(`pincer_${side}`);
   claw.rotation.z=Math.sin(this.elapsed*C.STEP_HZ+i)*C.CLAW_WAVE*(c.alarm>0?1:.3);
   pincer.rotation.z=Math.sin(this.elapsed*C.STEP_HZ+i)*C.PINCER_WAVE;
  }
 }
 update(dt){
  if(!this.ready||!gameState.game.isPlaying)return;this.elapsed+=dt;
  const j=this.jimothy.position,below=this.voxels.terrainHeightAt(j.x,j.z)-j.y>SEWER.BELOW;
  for(const c of [...this.crabs])if(!c.attached&&((!below&&!c.displaced)||Math.hypot(c.x-j.x,c.z-j.z)>C.RADIUS))this.remove(c);
  if(below&&this.crabs.length<C.COUNT)this.populate();this.alarmed=0;
  for(const c of this.crabs){
   if(c.attached)continue;
   const d=Math.hypot(c.x-j.x,c.z-j.z);if(d<C.ALARM_RADIUS&&Math.abs(c.y-j.y)<SEWER.HEIGHT){if(c.alarm<=0)eventBus.emit(Events.CRAB_ALARMED,{x:c.x,z:c.z});c.alarm=C.SCUTTLE_SECONDS;}
   c.alarm=Math.max(0,c.alarm-dt);if(c.alarm>0)this.alarmed++;
   c.wait-=dt;
   if(c.wait<=0||Math.hypot(c.tx-c.x,c.tz-c.z)<C.SPAWN_GAP/2){
    const nodes=Plan.sewerNodesIn(c.x-C.WANDER_DISTANCE,c.z-C.WANDER_DISTANCE,c.x+C.WANDER_DISTANCE,c.z+C.WANDER_DISTANCE).filter(n=>Math.hypot(n.x-c.x,n.z-c.z)>C.SPAWN_GAP);
    if(nodes.length){const target=c.alarm>0?nodes.reduce((a,b)=>Math.hypot(a.x-j.x,a.z-j.z)>Math.hypot(b.x-j.x,b.z-j.z)?a:b):nodes[(this.serial+Math.floor(this.elapsed/C.REPATH)+this.crabs.indexOf(c))%nodes.length];c.tx=target.x;c.tz=target.z;}c.wait=C.REPATH;
   }
   const dx=c.tx-c.x,dz=c.tz-c.z,dist=Math.hypot(dx,dz)||1,speed=c.alarm>0?C.SCUTTLE_SPEED:C.SPEED,step=Math.min(dist,speed*dt);
   const vx=c.kick?.x??dx/dist*speed,vz=c.kick?.z??dz/dist*speed;
   let moved=false;const nx=c.x+(c.kick?vx*dt:dx/dist*step),nz=c.z+(c.kick?vz*dt:dz/dist*step);
   if(this.walkable(c,nx,nz)){c.x=nx;c.z=nz;moved=true;}else if(this.walkable(c,nx,c.z)){c.x=nx;moved=true;}else if(this.walkable(c,c.x,nz)){c.z=nz;moved=true;}else c.wait=0;
   if(c.kick){c.kick.t-=dt;if(c.kick.t<=0)c.kick=null;}
   const floor=this.voxels.groundHeightAt(c.x,c.z,c.y+C.GROUND_SCAN);if(Math.abs(c.y-floor)<=C.FLOOR_STEP){c.y=floor;c.vy=0;}else {c.vy-=C.FALL_GRAVITY*dt;c.y=Math.max(floor,c.y+c.vy*dt);if(c.y===floor)c.vy=0;}
   const target=Math.atan2(vx,vz),angle=Math.atan2(Math.sin(target-c.yaw),Math.cos(target-c.yaw));c.yaw+=angle*(1-Math.exp(-C.TURN_RESPONSE*dt));
   this.animate(c,dt,moved?speed:0);
  }
 }
 reset(){for(const c of [...this.crabs])this.remove(c);this.alarmed=0;this.elapsed=0;this.serial=0;}
 snapshot(){return {ready:this.ready,count:this.crabs.length,alarmed:this.alarmed,kinds:[...new Set(this.crabs.map(c=>c.kind))],attached:this.crabs.filter(c=>c.attached).length};}
}
