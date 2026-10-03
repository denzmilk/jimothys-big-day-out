import * as THREE from 'three';
import {solveTwoBone} from '../core/Grounding.js';
import {PED_ACTIVITIES as C} from '../core/Constants.js';

const P=C.POSE,point=b=>b.getWorldPosition(new THREE.Vector3());
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};

// M51 owns only the additive pose. Restore it before the ordinary mixer/IK
// runs again, otherwise a paused animation accumulates yesterday's arm bend.
export class HumanActivityPose {
 constructor(p){
  this.p=p;this.saved=[];this.applied=false;this.base=p.visual.position.clone();this.rotation=p.visual.quaternion.clone();
  p.mesh.updateWorldMatrix(true,true);this.height=p.height;
  this.arms=['l','r'].map(side=>({side,sign:side==='l'?1:-1,upper:p.visual.getObjectByName(`upperarm_${side}`),lower:p.visual.getObjectByName(`lowerarm_${side}`),hand:p.visual.getObjectByName(`hand_${side}`)}));
  const names=['head','spine_03',...['l','r'].flatMap(s=>['upperarm','lowerarm','hand','thigh','calf','foot'].map(n=>`${n}_${s}`))];
  for(const side of ['l','r'])for(const digit of ['index','middle','ring','pinky','thumb'])for(let n=1;n<=3;n++)names.push(`${digit}_0${n}_${side}`);
  for(const name of names){const bone=p.visual.getObjectByName(name);if(bone)this.saved.push({bone,q:bone.quaternion.clone()});}
 }
 restore(){if(!this.applied)return;for(const {bone,q}of this.saved)bone.quaternion.copy(q);this.p.visual.position.copy(this.base);this.p.visual.quaternion.copy(this.rotation);this.applied=false;}
 local(v){return this.p.mesh.localToWorld(new THREE.Vector3().fromArray(v).multiplyScalar(this.height));}
 hand(side,v,w){
  const arm=this.arms.find(a=>a.side===side),target=point(arm.hand).lerp(this.local(v),w),rotation=this.p.mesh.getWorldQuaternion(new THREE.Quaternion());
  solveTwoBone(arm.upper,arm.lower,arm.hand,target,new THREE.Vector3(arm.sign,0,-1).applyQuaternion(rotation),P.REACH);
  const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,arm.sign),new THREE.Vector3(-arm.sign,0,0),new THREE.Vector3(0,-1,0));
  const q=arm.hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation).multiply(new THREE.Quaternion().setFromRotationMatrix(basis));
  arm.hand.quaternion.slerp(q,w);arm.hand.updateWorldMatrix(false,true);
  for(const digit of ['index','middle','ring','pinky','thumb'])for(let n=1;n<=3;n++){
   const bone=this.p.visual.getObjectByName(`${digit}_0${n}_${side}`);if(bone)bone.rotateX((digit==='thumb'?P.THUMB_CURL:P.FINGER_CURL)*w*this.curl);
  }
 }
 leg(side,v,pole,w){
  const p=this.p,hip=p.visual.getObjectByName(`thigh_${side}`),knee=p.visual.getObjectByName(`calf_${side}`),foot=p.visual.getObjectByName(`foot_${side}`);
  const target=point(foot).lerp(this.local(v),w),hint=new THREE.Vector3().fromArray(pole).applyQuaternion(p.mesh.quaternion);
  solveTwoBone(hip,knee,foot,target,hint,P.REACH);
 }
 apply(a){
  const p=this.p,t=a.time,h=this.height;
  for(const s of this.saved)s.q.copy(s.bone.quaternion);this.base.copy(p.visual.position);this.rotation.copy(p.visual.quaternion);this.applied=true;
  const w=ease(Math.min(t/C.BLEND,(a.duration-t)/C.BLEND));
  p.mesh.updateWorldMatrix(true,true);this.curl=['cartwheel','meditate','float','stretch','robot'].includes(a.kind)?0:1;
  const headLocal=p.mesh.worldToLocal(point(p.visual.getObjectByName('head'))).divideScalar(h);
  if(a.kind==='phone'){
   const target=headLocal.clone().add(new THREE.Vector3().fromArray(P.PHONE_HEAD));target.y-=P.GRIP_OFFSET/h;target.z-=P.HAND_FORWARD/h;this.hand('r',target.toArray(),w);
  }
  if(a.kind==='coffee'){
   const sip=(1-Math.cos(t*P.SIP_HZ))/2;
   const target=headLocal.clone().add(new THREE.Vector3().fromArray(P.MOUTH_HEAD));target.y-=(P.CUP_RIM+P.GRIP_OFFSET)/h;target.z-=P.HAND_FORWARD/h;
   this.hand('r',P.COFFEE_LOW.map((v,i)=>THREE.MathUtils.lerp(v,target.toArray()[i],sip)),w);
  }
  if(a.kind==='selfie'){
   const v=P.SELFIE.slice();v[0]+=Math.sin(t*P.SELFIE_HZ)*P.SELFIE_SWAY;this.hand('r',v,w);this.hand('l',[P.REST_HAND[0],P.PHONE[1],P.PHONE[2]],w);
  }
  if(a.kind==='air-guitar'){
   this.hand('l',P.GUITAR_LEFT,w);const v=P.GUITAR_RIGHT.slice();v[1]+=Math.sin(t*P.STRUM_HZ)*P.STRUM_RANGE;this.hand('r',v,w);
  }
  if(a.kind==='robot')for(const {side,sign}of this.arms){const v=P.ROBOT_HAND.slice();v[0]*=sign;v[1]+=Math.sin(t*P.ROBOT_HZ+sign*Math.PI/2)*P.ROBOT_RANGE;this.hand(side,v,w);}
  if(a.kind==='stretch')for(const {side,sign}of this.arms){const v=P.STRETCH_HAND.slice();v[0]=v[0]*sign+Math.sin(t*P.STRETCH_HZ)*P.STRETCH_SWAY;this.hand(side,v,w);}
  if(a.kind==='bird-chase')for(const {side,sign}of this.arms){const v=P.CHASE_HAND.slice();v[0]*=sign;v[1]+=Math.sin(t*P.CHASE_HZ+sign)*P.CHASE_WAVE;this.hand(side,v,w);}
  if(a.kind==='meditate'||a.kind==='float'){
   const lift=a.kind==='float'?P.FLOAT_RISE+Math.sin(t*P.FLOAT_HZ)*P.FLOAT_BOB:0;
   p.visual.position.y+=h*(lift-P.SEAT_DROP)*w;p.mesh.updateWorldMatrix(true,true);
   for(const {side,sign}of this.arms){
    const foot=P.SEAT_FOOT.slice();foot[0]*=-sign;foot[1]+=lift;const pole=P.SEAT_POLE.slice();pole[0]*=sign;this.leg(side,foot,pole,w);
    const hand=P.SEAT_HAND.slice();hand[0]*=sign;hand[1]+=lift;this.hand(side,hand,w);
   }
  }
  if(a.kind==='cartwheel'){
   for(const {side,sign}of this.arms){const hand=P.CART_HAND.slice();hand[0]*=sign;this.hand(side,hand,w);const foot=P.CART_FOOT.slice();foot[0]*=sign;this.leg(side,foot,[sign,0,1],w);}
   const progress=THREE.MathUtils.clamp((t-C.BLEND)/(a.duration-C.BLEND*2),0,1),angle=-ease(progress)*Math.PI*2,pivot=h*P.CART_PIVOT;
   p.visual.rotation.z=angle;p.visual.position.x=this.base.x+Math.sin(angle)*pivot;p.visual.position.y=this.base.y+pivot*(1-Math.cos(angle));p.mesh.updateWorldMatrix(true,true);
   const supports=[...this.arms.map(arm=>({bone:arm.hand,offset:P.HAND_FLOOR})),...p.grounding.legs.map(leg=>({bone:leg.foot,offset:leg.offset}))];
   const gap=Math.min(...supports.map(({bone,offset})=>{const at=point(bone);return at.y-offset-p.grounding.ground(at.x,at.z);}));p.visual.position.y-=gap*w;
  }
  if(a.kind==='moonwalk'){
   // Deliberate heel-toe skating uses the action's feet; ordinary walking IK
   // would plant a foot and erase the backwards-slide joke.
   for(const {side,sign}of this.arms){const leg=p.grounding.legs.find(l=>l.foot.name===`foot_${side}`),v=leg.rest.clone();v.y+=P.MOON_LIFT*Math.max(0,Math.sin(t*P.MOON_HZ+sign*Math.PI/2));this.leg(side,v.divideScalar(h).toArray(),[0,0,1],w);}
  }
  if(a.kind==='piggyback'&&a.phase!=='approach'){
   for(const {side,sign}of this.arms){
    let hand=P.CARRIER_HAND.slice();hand[0]*=sign;
    if(a.role==='rider'&&a.carrier){const neck=p.mesh.worldToLocal(point(a.carrier.visual.getObjectByName('neck_01'))).divideScalar(h);hand=neck.add(new THREE.Vector3(P.RIDER_GRIP[0]*sign,P.RIDER_GRIP[1],P.RIDER_GRIP[2])).toArray();}
    this.hand(side,hand,w);
    if(a.role==='rider'){const foot=P.RIDER_FOOT.slice();foot[0]*=sign;this.leg(side,foot,[sign,0,1],w);}
   }
  }
  const head=p.visual.getObjectByName('head');if(a.kind==='bird-chase')head.rotateX(P.CHASE_LOOK*w);if(a.mode==='stand')head.rotateY(Math.sin(t*P.HEAD_HZ)*P.HEAD_NOD*w);
  p.mesh.updateWorldMatrix(true,true);
  if(a.prop){
   const hand=this.arms.find(a=>a.side==='r').hand,mesh=a.prop.mesh,rotation=p.mesh.getWorldQuaternion(new THREE.Quaternion());
   const offset=new THREE.Vector3(0,P.GRIP_OFFSET,P.HAND_FORWARD).applyQuaternion(rotation);
   mesh.position.copy(hand.worldToLocal(point(hand).add(offset)));
   const tilt=a.kind==='coffee'?P.CUP_TILT*(1-Math.cos(t*P.SIP_HZ))/2:0;
   mesh.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(rotation).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-tilt,a.kind==='phone'?Math.PI/2:0,0)));
  }
 }
}
