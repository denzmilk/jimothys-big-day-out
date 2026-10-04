import * as THREE from 'three';
import {solveTwoBone} from '../core/Grounding.js';
import {LOCAL_RESPONSE as C,POLICE} from '../core/Constants.js';
const point=b=>b.getWorldPosition(new THREE.Vector3());
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};

// Like civilian activity poses, this is an additive owner after walk/IK.
// Restore before the next mixer step so idle or paused bones cannot accumulate.
export class HumanResponsePose {
 constructor(p){
  this.p=p;this.saved=[];this.applied=false;this.raised=0;
  this.arms=['l','r'].map(side=>({side,sign:side==='l'?1:-1,upper:p.visual.getObjectByName(`upperarm_${side}`),lower:p.visual.getObjectByName(`lowerarm_${side}`),hand:p.visual.getObjectByName(`hand_${side}`)}));
  for(const side of ['l','r'])for(const name of ['upperarm','lowerarm','hand','thigh','calf','foot',...['index','middle','ring','pinky','thumb'].flatMap(d=>[1,2,3].map(n=>`${d}_0${n}`))]){
   const bone=p.visual.getObjectByName(`${name}_${side}`);if(bone)this.saved.push({bone,q:bone.quaternion.clone()});
  }
 }
 restore(){if(!this.applied)return;for(const {bone,q}of this.saved)bone.quaternion.copy(q);this.applied=false;}
 hand(arm,target){
  const p=this.p,rotation=p.group.getWorldQuaternion(new THREE.Quaternion());
  solveTwoBone(arm.upper,arm.lower,arm.hand,target,new THREE.Vector3(arm.sign,0,-1).applyQuaternion(rotation),C.REACH);
  const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,arm.sign),new THREE.Vector3(-arm.sign,0,0),new THREE.Vector3(0,-1,0));
  arm.hand.quaternion.copy(arm.hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation).multiply(new THREE.Quaternion().setFromRotationMatrix(basis)));arm.hand.updateWorldMatrix(false,true);
  for(const digit of ['index','middle','ring','pinky','thumb'])for(let n=1;n<=3;n++){const bone=p.visual.getObjectByName(`${digit}_0${n}_${arm.side}`);if(bone)bone.rotateX(digit==='thumb'?C.THUMB_CURL:C.FINGER_CURL);}
 }
 apply(dt,subject){
  const p=this.p;if(p.type!=='paparazzo'&&p.type!=='police'&&p.type!=='infantry'&&!p.kick?.busy)return;
  for(const s of this.saved)s.q.copy(s.bone.quaternion);this.applied=true;p.group.updateWorldMatrix(true,true);
  if(p.camera||p.gun){
   const profile=p.gunProfile||POLICE,config=p.gun?{LOW:profile.GUN_LOW,HIGH:profile.GUN_HIGH,RIGHT:profile.GUN_RIGHT,LEFT:profile.GUN_LEFT,RAISE:profile.GUN_RAISE,PITCH:profile.GUN_PITCH}:{LOW:C.CAMERA_LOW,HIGH:C.CAMERA_HIGH,RIGHT:C.CAMERA_RIGHT,LEFT:C.CAMERA_LEFT,RAISE:C.CAMERA_RAISE_RESPONSE,PITCH:C.CAMERA_PITCH},prop=p.gun||p.camera;
   this.raised+=((p.sees?1:0)-this.raised)*(1-Math.exp(-config.RAISE*dt));
   const center=p.group.localToWorld(new THREE.Vector3().fromArray(config.LOW).lerp(new THREE.Vector3().fromArray(config.HIGH),this.raised).multiplyScalar(p.height)),rotation=p.group.getWorldQuaternion(new THREE.Quaternion());
   if(subject&&p.sees){const pitch=THREE.MathUtils.clamp(Math.atan2(center.y-subject.y,Math.hypot(center.x-subject.x,center.z-subject.z)),-config.PITCH,config.PITCH);rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),pitch));}
   const right=this.arms.find(a=>a.side==='r');this.hand(right,center.clone().add(new THREE.Vector3().fromArray(config.RIGHT).applyQuaternion(rotation)));
   const hand=right.hand,at=point(hand).sub(new THREE.Vector3().fromArray(config.RIGHT).applyQuaternion(rotation));
   // The carrying arm may clamp its reach. The supporting hand must follow
   // the resulting prop location, not the unreachable requested location.
   this.hand(this.arms.find(a=>a.side==='l'),at.clone().add(new THREE.Vector3().fromArray(config.LEFT).applyQuaternion(rotation)));
   prop.position.copy(hand.worldToLocal(at));prop.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
  }else if(p.kick?.busy){
   const leg=p.grounding.legs.find(l=>l.foot.name==='foot_r'),rest=p.group.worldToLocal(leg.target.clone()),raised=rest.clone().add(new THREE.Vector3().fromArray(C.KICK_RAISE).multiplyScalar(p.height)),extended=rest.clone().add(new THREE.Vector3().fromArray(C.KICK_EXTEND).multiplyScalar(p.height));
   const k=p.kick,target=k.phase==='windup'?rest.lerp(raised,ease(k.time/C.WINDUP)):k.phase==='strike'?raised.lerp(extended,ease(k.time/C.CONTACT)):extended.lerp(rest,ease(k.time/C.RECOVERY));
   solveTwoBone(leg.hip,leg.knee,leg.foot,p.group.localToWorld(target),new THREE.Vector3(0,0,1).applyQuaternion(p.group.quaternion),C.REACH);
   for(const arm of this.arms){const target=new THREE.Vector3().fromArray(C.HAND_GUARD);target.x*=arm.sign;this.hand(arm,p.group.localToWorld(target.multiplyScalar(p.height)));}
  }
  p.group.updateWorldMatrix(true,true);
 }
}
