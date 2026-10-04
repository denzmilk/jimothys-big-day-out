import * as THREE from 'three';
import {PLAYER_RAGDOLL as C} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';

// A component of Jimothy's original rig. All bodies/constraints stay owned by
// PhysicsSystem; the existing player sphere is borrowed as the torso (M57).
export class PlayerRagdoll {
 constructor(controller){this.controller=controller;this.phase='idle';this.age=0;}
 get active(){return this.phase!=='idle';}
 get physical(){return this.phase==='physical';}
 get recovering(){return this.phase==='recovering';}
 start(velocity){
  const j=this.controller,r=j.rig;if(this.physical||!r.skinned||j.radius>C.MAX_RADIUS||Math.hypot(...velocity)<C.MIN_SPEED)return;
  if(this.active)this.stop(false);j.group.updateMatrixWorld(true);r.skinned.skeleton.update();
  this.radius=j.radius;this.age=0;this.groupRotation=j.group.quaternion.clone();this.rootPosition=r.root.position.clone();
  this.saved=Object.values(r.bones).map(bone=>({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone()}));
  const center=r.bellyBox().getCenter(new THREE.Vector3()),scale=r.anatomyScale||1;
  this.groupOffset=j.group.position.clone().sub(center);
  const parts=[{position:center,quaternion:new THREE.Quaternion(),parent:-1}];
  const segment=(bone,end,radius,parent)=>{
   const start=bone.getWorldPosition(new THREE.Vector3()),direction=end.clone().sub(start),length=Math.max(C.MIN_LENGTH*scale,direction.length());
   const quaternion=new THREE.Quaternion().setFromUnitVectors(THREE.Object3D.DEFAULT_UP,direction.normalize());
   parts.push({bone,start,length,parent,position:start.clone().addScaledVector(direction,length/2),quaternion,
    half:[radius*scale,length/2,radius*scale],offset:quaternion.clone().invert().multiply(bone.getWorldQuaternion(new THREE.Quaternion()))});
  };
  for(const name of ['head','tail']){
   const bone=r.bones[name],start=bone.getWorldPosition(new THREE.Vector3()),end=r.partCentroid(name).sub(start).multiplyScalar(2).add(start);
   segment(bone,end,name==='head'?C.HEAD_RADIUS:C.TAIL_RADIUS,0);
  }
  for(const paw of j.legs.paws){const parent=parts.length;segment(paw.hip,paw.knee.getWorldPosition(new THREE.Vector3()),C.LIMB_RADIUS,0);segment(paw.knee,paw.end.getWorldPosition(new THREE.Vector3()),C.LIMB_RADIUS,parent);}
  this.parts=parts;
  eventBus.emit(Events.RAGDOLL_CREATE,{id:'jimothy',parts,velocity,rootBody:j.body,tuning:C,receive:physics=>this.physics=physics});
  if(!this.physics)return;this.phase='physical';j.legs.reset();j._prevFeetY=undefined;
 }
 shift(position){
  if(!this.physical)return;const delta=new THREE.Vector3().copy(position).sub(this.controller.body.position);
  eventBus.emit(Events.RAGDOLL_SHIFT,{id:'jimothy',delta});
 }
 recover(){
  if(!this.physical)return;
  const j=this.controller;this.phase='recovering';this.age=0;this.fromRotation=j.group.quaternion.clone();this.fromOffset=j.group.position.clone().sub(j.body.position);this.fromRoot=j.rig.root.position.clone();
  for(const s of this.saved){s.fromPosition=s.bone.position.clone();s.fromQuaternion=s.bone.quaternion.clone();}
  eventBus.emit(Events.RAGDOLL_REMOVE,{id:'jimothy'});this.physics=null;
 }
 stop(restore=true){
  if(!this.active)return;
  eventBus.emit(Events.RAGDOLL_REMOVE,{id:'jimothy'});
  if(restore){for(const s of this.saved){s.bone.position.copy(s.position);s.bone.quaternion.copy(s.quaternion);}this.controller.rig.root.position.copy(this.rootPosition);}
  this.phase='idle';this.physics=null;this.parts=null;this.saved=null;this.age=0;this.controller.legs.reset();
 }
 pose(dt){
  if(!this.active)return;this.age+=dt;const j=this.controller,r=j.rig;
  if(this.physical){
   const body=this.physics.bodies[0],q=new THREE.Quaternion().copy(body.quaternion);
   j.group.quaternion.copy(q).multiply(this.groupRotation);j.group.position.copy(body.position).add(this.groupOffset.clone().applyQuaternion(q));r.root.position.copy(this.rootPosition);
   for(const s of this.saved){s.bone.position.copy(s.position);s.bone.quaternion.copy(s.quaternion);}j.group.updateMatrixWorld(true);
   for(let i=1;i<this.parts.length;i++){
    const p=this.parts[i],b=this.physics.bodies[i],parent=p.bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    p.bone.quaternion.copy(parent).multiply(new THREE.Quaternion().copy(b.quaternion)).multiply(p.offset);p.bone.updateMatrixWorld(true);
   }
  }else{
   const t=THREE.MathUtils.smoothstep(this.age,0,C.RECOVER_SECONDS),target=j.group.position.clone().sub(j.body.position);
   j.group.quaternion.slerpQuaternions(this.fromRotation,j.group.quaternion.clone(),t);j.group.position.copy(j.body.position).add(this.fromOffset.clone().lerp(target,t));
   r.root.position.lerpVectors(this.fromRoot,r.root.position.clone(),t);
   for(const s of this.saved){s.bone.position.lerpVectors(s.fromPosition,s.bone.position.clone(),t);s.bone.quaternion.slerpQuaternions(s.fromQuaternion,s.bone.quaternion.clone(),t);}
   if(t===1){this.stop(false);gameState.player.stunned=j.stunTimer>0;}
  }
  j.group.updateMatrixWorld(true);
 }
 snapshot(){return{phase:this.phase,bodies:this.physics?.bodies.length||0,joints:this.physics?.constraints.length||0,age:+this.age.toFixed(3)};}
}
