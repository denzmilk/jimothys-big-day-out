import * as THREE from 'three';
import {HUMAN_SWIM as C} from './Constants.js';
import {solveTwoBone} from './Grounding.js';
import {eventBus,Events} from './EventBus.js';

const turn=a=>Math.atan2(Math.sin(a),Math.cos(a));

export function humanWaterLevel(x,z,ground,from=Infinity){
 let water;eventBus.emit(Events.WATER_SAMPLE,{x,z,receive:w=>water=w});
 // Recovery may lower someone toward the surface, but ascending out of a
 // submerged wreck must go through the swimmer's collision sweep.
 return water&&water.height-ground>C.ENTER_DEPTH?Math.max(ground,Math.min(from,water.height-C.RECOVERY_DRAFT)):ground;
}

// M62: this helper runs only when the character's owner has yielded land
// movement. Seats, attachment and live ragdolls never call it.
export class HumanSwimming {
 constructor(person,voxels){
  this.person=person;this.voxels=voxels;this.group=person.group||person.mesh;this.visual=person.visual;this.active=false;this.time=0;this.routeClock=0;this.fallSpeed=0;
  this.basePosition=this.visual.position.clone();this.basePosition.y=person.grounding.baseY;this.baseRotation=this.visual.quaternion.clone();
  this.head=this.visual.getObjectByName('head');this.pelvis=this.visual.getObjectByName('pelvis');this.point=new THREE.Vector3();this.axis=new THREE.Vector3(1,0,0);this.tilt=new THREE.Quaternion();
  this.arms=['l','r'].map((side,i)=>({sign:i? -1:1,upper:this.visual.getObjectByName(`upperarm_${side}`),lower:this.visual.getObjectByName(`lowerarm_${side}`),hand:this.visual.getObjectByName(`hand_${side}`)}));
  this.saved=[];this.visual.traverse(bone=>{if(bone.isBone)this.saved.push({bone,q:bone.quaternion.clone()});});this.applied=false;
 }
 restore(){if(this.applied){for(const s of this.saved)s.bone.quaternion.copy(s.q);this.applied=false;}this.visual.position.copy(this.basePosition);this.visual.quaternion.copy(this.baseRotation);}
 stop(){
  if(!this.active)return;
  if(this.person.animation!=='Walk'){this.restore();this.person.mixer.stopAllAction();this.person.animation=null;this.person.grounding.reset();}
  this.person.swimming=false;this.active=false;this.fallSpeed=0;this.wading=null;this.routeSearch=null;this.person.target=null;this.person.node=null;if(this.person.route)this.person.route=[];
 }
 water(x,z,surfaceOnly=false){let value;eventBus.emit(Events.WATER_SAMPLE,{x,z,surfaceOnly,receive:w=>value=w});return value;}
 ground(x,z,y){return this.voxels.physicalGroundHeightAt(x,z,y+C.MAX_STEP,0);}
 clear(x,z){
  const pos=this.group.position,ground=this.ground(x,z,pos.y),foot=Math.max(ground,pos.y);
  if(ground-pos.y>C.MAX_STEP)return false;
  // Checking only the destination makes a thin wall look traversable to
  // the longer route probe, even though each short movement step is blocked.
  const steps=Math.max(1,Math.ceil(Math.hypot(x-pos.x,z-pos.z)/C.ROUTE_STEP));
  for(let i=1;i<=steps;i++){
   const t=i/steps,px=THREE.MathUtils.lerp(pos.x,x,t),pz=THREE.MathUtils.lerp(pos.z,z,t),py=THREE.MathUtils.lerp(pos.y,foot,t);
   for(const [dx,dz] of [[0,0],[C.BODY_RADIUS,0],[-C.BODY_RADIUS,0],[0,C.BODY_RADIUS],[0,-C.BODY_RADIUS]])for(const h of C.BODY_HEIGHTS)if(this.voxels.physicalSolidAtWorld(px+dx,py+h,pz+dz))return false;
  }
  let blocked=false;const from={x:pos.x,y:pos.y+C.BODY_POINT,z:pos.z},to={x,y:foot+C.BODY_POINT,z};
  eventBus.emit(Events.SWIM_CONTACT,{from,to,radius:C.BODY_RADIUS,receive:()=>blocked=true});return !blocked;
 }
 vertical(from,to){
  const delta=to.clone().sub(from),distance=delta.length(),steps=Math.max(1,Math.ceil(distance/C.SWEEP_STEP));let fraction=1;
  const r=C.HEAD_RADIUS,probes=[[0,0,0],[r,0,0],[-r,0,0],[0,r,0],[0,-r,0],[0,0,r],[0,0,-r]];
  for(let i=1;i<=steps;i++){
   const at=from.clone().addScaledVector(delta,i/steps);
   if(probes.some(([x,y,z])=>this.voxels.physicalSolidAtWorld(at.x+x,at.y+y,at.z+z))){fraction=(i-1)/steps;break;}
  }
  eventBus.emit(Events.SWIM_CONTACT,{from,to,radius:r,receive:at=>{fraction=Math.min(fraction,from.distanceTo(new THREE.Vector3(at.x,at.y,at.z))/(distance||1));}});
  if(fraction<1)fraction=Math.max(0,fraction-C.CONTACT_MARGIN/(distance||1));
  return from.clone().addScaledVector(delta,fraction);
 }
 route(){
  const pos=this.group.position,shore=this.voxels.terrain?.shoreDistance;if(!shore)return;
  // A crowd entering water together must not do every collision sweep on
  // the same frame. Movement still checks its complete short step each tick.
  const search=this.routeSearch??={index:0,best:-Infinity,heading:this.group.rotation.y};
  const end=Math.min(C.DIRECTIONS,search.index+C.ROUTE_WORK);
  for(;search.index<end;search.index++){
   const i=search.index;
   const yaw=i*Math.PI*2/C.DIRECTIONS,dx=Math.sin(yaw),dz=Math.cos(yaw);if(!this.clear(pos.x+dx*C.LOOKAHEAD,pos.z+dz*C.LOOKAHEAD))continue;
   const score=shore(pos.x+dx*C.COAST_PROBE,pos.z+dz*C.COAST_PROBE)-Math.abs(turn(yaw-this.group.rotation.y))*C.TURN_BIAS;
   if(score>search.best){search.best=score;search.heading=yaw;}
  }
  if(search.index===C.DIRECTIONS){this.heading=search.heading;this.routeSearch=null;this.routeClock=C.ROUTE_INTERVAL;}
 }
 pose(blend){
  const p=this.person,g=this.group,v=this.visual;
  for(const s of this.saved)s.q.copy(s.bone.quaternion);this.applied=true;g.updateMatrixWorld(true);const pivot=v.worldToLocal(this.pelvis.getWorldPosition(this.point)).clone();
  this.tilt.setFromAxisAngle(this.axis,C.PITCH*blend);v.quaternion.copy(this.baseRotation).multiply(this.tilt);v.position.copy(this.basePosition).add(pivot).sub(pivot.clone().applyQuaternion(this.tilt));g.updateMatrixWorld(true);
  const phase=this.time*C.STROKE_HZ*Math.PI*2,height=p.height||this.head.getWorldPosition(this.point).y-g.position.y,rotation=g.quaternion;
  for(const arm of this.arms){
   const shoulder=g.worldToLocal(arm.upper.getWorldPosition(new THREE.Vector3())),sweep=(1-Math.cos(phase))/2;
   const target=shoulder.add(new THREE.Vector3(arm.sign*(C.ARM_OUT+C.ARM_SWEEP*sweep),-C.ARM_DOWN,C.ARM_FORWARD+C.ARM_REACH*Math.sin(phase)).multiplyScalar(height*blend));
   solveTwoBone(arm.upper,arm.lower,arm.hand,g.localToWorld(target),new THREE.Vector3(arm.sign,C.ELBOW_DOWN,C.ELBOW_BACK).applyQuaternion(rotation),C.LIMB_REACH);
  }
  for(const [i,side] of ['l','r'].entries()){
   const kick=Math.sin(phase+i*Math.PI);this.visual.getObjectByName(`thigh_${side}`).rotateX(kick*C.LEG_KICK*blend);this.visual.getObjectByName(`calf_${side}`).rotateX(Math.max(0,-kick)*C.KNEE_KICK*blend);
  }g.updateMatrixWorld(true);
 }
 update(dt){
  const p=this.person,g=this.group,pos=g.position,water=this.water(pos.x,pos.z),ground=this.ground(pos.x,pos.z,pos.y),depth=water?water.height-ground:0;
  if(water)this.surfaceHeight=water.height;
  else if(this.active)this.surfaceHeight=this.water(pos.x,pos.z,true)?.height??this.surfaceHeight;
  if(!this.active&&(!water||depth<C.WADE_DEPTH))return false;
  if(this.active&&depth<=0&&ground>=this.surfaceHeight+C.DRY_CLEARANCE){this.stop();return false;}
  if(!this.active){eventBus.emit(Events.HUMAN_INTERRUPT,{id:typeof p.id==='number'?`pursuer-${p.id}`:p.id});this.active=true;this.time=0;this.routeClock=0;this.heading=g.rotation.y;p.grounding.reset();p.mixer.stopAllAction();p.actions.Idle?.reset().play();p.animation='Swim';}
  g.updateMatrixWorld(true);const previousHead=this.head.getWorldPosition(new THREE.Vector3());
  const swimming=depth>(p.swimming?C.EXIT_DEPTH:C.ENTER_DEPTH);
  if(!swimming&&p.animation==='Swim')this.wading={time:0,position:this.visual.position.clone(),bones:this.saved.map(s=>s.bone.quaternion.clone())};
  this.time+=dt;this.restore();p.mixer.update(dt);p.grounding.contacts=[];
  if(water&&pos.y>water.height+C.ENTRY_GAP&&depth>C.EXIT_DEPTH){
   p.swimming=false;this.fallSpeed+=C.FALL_GRAVITY*dt;pos.y=Math.max(water.height,pos.y-this.fallSpeed*dt);
  }else{
   p.swimming=swimming;this.fallSpeed=0;this.routeClock-=dt;if(this.routeClock<=0)this.route();
   const angle=turn(this.heading-g.rotation.y);g.rotation.y+=THREE.MathUtils.clamp(angle,-C.TURN*dt,C.TURN*dt);
   const speed=C.SPEED*Math.max(0,Math.cos(angle)),x=pos.x+Math.sin(g.rotation.y)*speed*dt,z=pos.z+Math.cos(g.rotation.y)*speed*dt;
   const moving=this.clear(x,z);if(moving){pos.x=x;pos.z=z;}
   if(!p.swimming){
    if(p.animation!=='Walk'){p.mixer.stopAllAction();p.actions.Walk?.reset().play();p.animation='Walk';p.grounding.reset();}
    pos.y=this.ground(pos.x,pos.z,pos.y);if('y' in p)p.y=pos.y;p.grounding.update(p.actions.Walk,moving&&speed>0,dt);
    if(this.wading){const w=this.wading,t=Math.min(1,(w.time+=dt)/C.WADE_BLEND),ease=t*t*(3-2*t);this.visual.position.lerpVectors(w.position,this.visual.position.clone(),ease);for(let i=0;i<this.saved.length;i++){const bone=this.saved[i].bone;bone.quaternion.slerpQuaternions(w.bones[i],bone.quaternion.clone(),ease);}if(t===1)this.wading=null;}
   }else{
   if(p.animation!=='Swim'){p.mixer.stopAllAction();p.actions.Idle?.reset().play();p.animation='Swim';p.grounding.reset();}
   const blend=THREE.MathUtils.clamp((depth-C.EXIT_DEPTH)/(C.ENTER_DEPTH-C.EXIT_DEPTH),0,1);this.pose(blend);
   const headY=this.head.getWorldPosition(this.point).y-pos.y,surface=this.water(pos.x,pos.z)?.height??water.height,target=Math.max(this.ground(pos.x,pos.z,pos.y),surface+C.HEAD_CLEARANCE+Math.sin(this.time*C.STROKE_HZ*Math.PI*2)*C.BOB-headY);
   const change=(target-pos.y)*(1-Math.exp(-C.SURFACE_RESPONSE*dt)),dy=THREE.MathUtils.clamp(change,-C.VERTICAL_SPEED*dt,C.VERTICAL_SPEED*dt);
   // Float toward daylight only as far as the head can travel. Wreck decks
   // and remaining voxel ceilings must remain cover during recovery (M62).
   const nextHead=this.head.getWorldPosition(new THREE.Vector3());nextHead.y+=dy;
   const allowed=this.vertical(previousHead,nextHead);pos.add(allowed.sub(nextHead));pos.y+=dy;
   }
  }
  if('x' in p){p.x=pos.x;p.y=pos.y;p.z=pos.z;p.yaw=g.rotation.y;}p.vy=0;g.updateMatrixWorld(true);return true;
 }
}
