import * as THREE from 'three';
import {GROUNDING as C} from './Constants.js';

const position=b=>b.getWorldPosition(new THREE.Vector3());
function rotateToward(bone,from,to){
  const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const turn=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
  bone.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));bone.updateWorldMatrix(false,true);
}

// Solve in the hip parent's frame: Jimothy's growing belly has non-uniform
// scale, so treating its sheared world transform as a rotation misses the paw.
export function solveTwoBone(hip,knee,foot,target,pole,maxReach=C.MAX_REACH){
  const parent=hip.parent;
  const h=hip.position.clone(),k=parent.worldToLocal(position(knee)),f=parent.worldToLocal(position(foot));
  const t=parent.worldToLocal(target.clone()),l1=h.distanceTo(k),l2=k.distanceTo(f);
  const toward=t.clone().sub(h),distance=THREE.MathUtils.clamp(toward.length(),Math.abs(l1-l2)+C.SOLVE_EPSILON,(l1+l2)*maxReach),axis=toward.normalize();
  const hint=parent.worldToLocal(position(hip).add(pole)).sub(h);
  hint.addScaledVector(axis,-hint.dot(axis)).normalize();
  const a=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-a*a));
  const bend=h.clone().addScaledVector(axis,a).addScaledVector(hint,height);
  hip.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(k.sub(h).normalize(),bend.sub(h).normalize()));
  hip.updateWorldMatrix(false,true);
  const nk=knee.position,nf=hip.worldToLocal(position(foot)),nt=hip.worldToLocal(target.clone());
  knee.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(nf.sub(nk).normalize(),nt.sub(nk).normalize()));
  knee.updateWorldMatrix(false,true);
}

// JIM-50: feet transfer through a swing arc instead of swapping directly from
// a world anchor to the exported pose. Stride timing follows actual movement.
export class FootGrounding {
  constructor(root,visual,ground){
    this.root=root;this.visual=visual;this.ground=ground;this.baseY=visual.position.y;
    root.updateWorldMatrix(true,true);
    const floor=new THREE.Box3().setFromObject(visual).min.y;
    const rotation=root.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.legs=['l','r'].map(side=>{
      const hip=visual.getObjectByName(`thigh_${side}`),knee=visual.getObjectByName(`calf_${side}`),foot=visual.getObjectByName(`foot_${side}`);
      return {hip,knee,foot,offset:position(foot).y-floor,l1:position(hip).distanceTo(position(knee)),l2:position(knee).distanceTo(position(foot)),
        rest:root.worldToLocal(position(foot)),neutral:rotation.clone().multiply(foot.getWorldQuaternion(new THREE.Quaternion()))};
    });
    this.reset();
  }
  reset(){
    this.previous=null;this.bodyY=null;this.velocity=new THREE.Vector3();this.wait=0;this.contacts=[];
    for(const leg of this.legs){leg.target=null;leg.swing=null;leg.orientation=null;}
  }
  foothold(leg){
    const target=this.root.localToWorld(leg.rest.clone());
    target.y=this.ground(target.x,target.z)+leg.offset+C.FOOT_CLEARANCE;return target;
  }
  update(action,moving,dt){
    this.visual.position.y=this.baseY-C.PELVIS_DROP;this.root.updateWorldMatrix(true,true);this.contacts=[];
    const rootPosition=position(this.root);
    if(this.previous&&rootPosition.distanceTo(this.previous)>C.RESET_DISTANCE)this.reset();
    const fresh=!this.previous;
    const velocity=rootPosition.clone().sub(this.previous||rootPosition);velocity.y=0;
    if(dt>0)velocity.divideScalar(dt);
    if(!moving)velocity.set(0,0,0);
    this.velocity.lerp(velocity, fresh?1:1-Math.exp(-C.VELOCITY_RESPONSE*dt));
    this.previous=rootPosition;
    const speed=this.velocity.length(),stride=action?.getClip().name==='Run'?C.RUN_STRIDE:C.WALK_STRIDE;
    const direction=this.velocity.clone().normalize();
    for(const leg of this.legs)if(!leg.target)leg.target=this.foothold(leg);
    this.wait=Math.max(0,this.wait-dt);
    const lag=leg=>this.foothold(leg).sub(leg.target).dot(direction);
    const recovery=this.legs.every(leg=>lag(leg)>stride*C.FOOT_LEAD);
    if(moving&&speed>C.MIN_SPEED&&!this.legs.some(l=>l.swing)&&(this.wait===0||recovery)){
      // After a reversal the last foot to land may already be the trailing
      // one. Blind alternation would leave it a full extra stride behind.
      const leg=this.legs.reduce((a,b)=>lag(a)>lag(b)?a:b);
      // JIM-55: after a turn both feet can trail the hips. Take a short
      // catch-up step; a full forward stride leaves the support leg behind.
      const duration=recovery?C.SWING_MIN:THREE.MathUtils.clamp(stride/(2*Math.max(speed,velocity.length()))*C.SWING_SHARE,C.SWING_MIN,C.SWING_MAX);
      const end=this.foothold(leg);
      if(!recovery)end.addScaledVector(this.velocity,duration).addScaledVector(direction,stride*C.FOOT_LEAD);
      end.y=this.ground(end.x,end.z)+leg.offset+C.FOOT_CLEARANCE;
      leg.swing={start:leg.target.clone(),end,elapsed:0,duration,gap:duration*(1-C.SWING_SHARE)/C.SWING_SHARE,recovery};
    }
    for(const leg of this.legs){
      const swing=leg.swing;
      if(swing){
        swing.elapsed=Math.min(swing.duration,swing.elapsed+dt);
        // A late navigation turn must not yank a nearly planted foot sideways.
        if(moving&&swing.elapsed/swing.duration<C.LANDING_LOCK){
          const end=this.foothold(leg);
          if(!swing.recovery)end.addScaledVector(this.velocity,swing.duration-swing.elapsed).addScaledVector(direction,stride*C.FOOT_LEAD);
          end.y=this.ground(end.x,end.z)+leg.offset+C.FOOT_CLEARANCE;
          const correction=end.sub(swing.end).multiplyScalar(1-Math.exp(-C.LANDING_RESPONSE*dt));
          correction.clampLength(0,C.LANDING_SPEED*dt);swing.end.add(correction);
        }
        swing.end.y=this.ground(swing.end.x,swing.end.z)+leg.offset+C.FOOT_CLEARANCE;
        const t=swing.elapsed/swing.duration,ease=t*t*(3-2*t);
        const desired=swing.start.clone().lerp(swing.end,ease);
        desired.y=Math.max(desired.y,this.ground(desired.x,desired.z)+leg.offset+C.FOOT_CLEARANCE)+C.STEP_LIFT*Math.sin(Math.PI*t)**2;
        const footSpeed=action?.getClip().name==='Run'?C.RUN_FOOT_SPEED:C.WALK_FOOT_SPEED;
        leg.target.add(desired.sub(leg.target).clampLength(0,footSpeed*dt));
        // Finish a long recovery step before starting the other foot; a timer
        // expiring must never teleport the ankle onto its landing point.
        if(t===1&&leg.target.distanceTo(swing.end)<C.SOLVE_EPSILON){this.wait=swing.gap;leg.swing=null;}
      }else leg.target.y=this.ground(leg.target.x,leg.target.z)+leg.offset+C.FOOT_CLEARANCE;
    }
    let drop=0;
    for(const leg of this.legs){
      const h=position(leg.hip),reach=(leg.l1+leg.l2)*C.MAX_REACH;
      const horizontal=Math.hypot(leg.target.x-h.x,leg.target.z-h.z);
      const available=Math.sqrt(Math.max(0,reach*reach-horizontal*horizontal));
      drop=Math.max(drop,h.y-leg.target.y-available);
    }
    const desiredY=rootPosition.y+this.baseY-C.PELVIS_DROP-Math.min(C.MAX_DROP,drop);
    if(fresh)this.bodyY=desiredY;
    else{
      const change=(desiredY-this.bodyY)*(1-Math.exp(-C.PELVIS_RESPONSE*dt));
      this.bodyY+=THREE.MathUtils.clamp(change,-C.PELVIS_SPEED*dt,C.PELVIS_SPEED*dt);
    }
    this.visual.position.y=this.bodyY-rootPosition.y;this.root.updateWorldMatrix(true,true);
    const rotation=this.root.getWorldQuaternion(new THREE.Quaternion());
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(rotation);
    for(const leg of this.legs){
      const {hip,knee,foot,l1,l2,target}=leg,h=position(hip),k=position(knee);
      const toward=target.clone().sub(h),distance=THREE.MathUtils.clamp(toward.length(),Math.abs(l1-l2)+C.SOLVE_EPSILON,(l1+l2)*C.MAX_REACH),axis=toward.normalize();
      const a=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-a*a));
      const pole=forward.clone().addScaledVector(axis,-forward.dot(axis)).normalize();
      const bend=h.clone().addScaledVector(axis,a).addScaledVector(pole,height);
      rotateToward(hip,k.clone().sub(h),bend.clone().sub(h));
      const nk=position(knee),nf=position(foot);rotateToward(knee,nf.sub(nk),target.clone().sub(nk));
      const px=this.ground(target.x+C.PROBE,target.z)-this.ground(target.x-C.PROBE,target.z);
      const pz=this.ground(target.x,target.z+C.PROBE)-this.ground(target.x,target.z-C.PROBE);
      const normal=new THREE.Vector3(-px,2*C.PROBE,-pz).normalize();
      const world=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal).multiply(rotation).multiply(leg.neutral);
      if(!leg.orientation)leg.orientation=world.clone();
      else leg.orientation.slerp(world,1-Math.exp(-C.NORMAL_RESPONSE*dt));
      foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(leg.orientation));foot.updateWorldMatrix(false,true);
      const end=position(foot),ground=this.ground(end.x,end.z);
      this.contacts.push({stance:!leg.swing,x:end.x,z:end.z,soleY:end.y-leg.offset,ground,error:end.y-leg.offset-ground});
    }
  }
}

export function groundVehicle(mesh,half,ground){
  const yaw=mesh.rotation.y,s=Math.sin(yaw),c=Math.cos(yaw);
  const at=(x,z)=>ground(mesh.position.x+c*x+s*z,mesh.position.z-s*x+c*z);
  const w=half[0]*C.WHEEL_INSET,l=half[2]*C.WHEEL_INSET;
  const fl=at(-w,l),fr=at(w,l),bl=at(-w,-l),br=at(w,-l);
  const pitch=THREE.MathUtils.clamp(Math.atan2((fl+fr-bl-br)/2,2*l),-C.MAX_TILT,C.MAX_TILT);
  const bank=THREE.MathUtils.clamp(Math.atan2((fr+br-fl-bl)/2,2*w),-C.MAX_TILT,C.MAX_TILT);
  mesh.quaternion.setFromEuler(new THREE.Euler(-pitch,yaw,bank,'YXZ'));
  mesh.position.y=(fl+fr+bl+br)/4+half[1];
  const wheels=mesh.children.filter(o=>o.isMesh&&/wheel-(front|back)-(left|right)$/.test(o.name));
  const point=new THREE.Vector3(),heightCache=new Map();
  const cachedGround=(x,z)=>{const key=`${x.toFixed(4)},${z.toFixed(4)}`;if(!heightCache.has(key))heightCache.set(key,ground(x,z));return heightCache.get(key);};
  for(const wheel of wheels){
    wheel.userData.restY??=wheel.position.y;wheel.position.y=wheel.userData.restY;
    if(!wheel.userData.groundSamples){
      const a=wheel.geometry.attributes.position,seen=new Set(),samples=[];
      for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i),key=v.toArray().map(n=>n.toFixed(4)).join(',');if(!seen.has(key)){seen.add(key);samples.push(v);}}
      const low=Math.min(...samples.map(v=>v.y)),high=Math.max(...samples.map(v=>v.y));
      wheel.userData.groundSamples=samples.filter(v=>v.y<=low+(high-low)*C.WHEEL_CONTACT_BAND);
    }
  }
  const gap=wheel=>{let minimum=Infinity;for(const v of wheel.userData.groundSamples){point.copy(v).applyMatrix4(wheel.matrixWorld);minimum=Math.min(minimum,point.y-cachedGround(point.x,point.z));}return minimum;};
  mesh.updateMatrixWorld(true);
  if(wheels.length){
    mesh.position.y-=wheels.reduce((sum,w)=>sum+gap(w),0)/wheels.length;mesh.updateMatrixWorld(true);
    // Suspension follows the tilted local up axis. That also shifts a tyre
    // sideways on a bank, so resample the new contact instead of stopping at
    // the old terrain height. Total travel stays bounded across all passes.
    for(const wheel of wheels)for(let pass=0;pass<C.WHEEL_SOLVE_STEPS;pass++){
      wheel.position.y=THREE.MathUtils.clamp(wheel.position.y-gap(wheel)/mesh.matrixWorld.elements[5],wheel.userData.restY-C.SUSPENSION,wheel.userData.restY+C.SUSPENSION);
      wheel.updateMatrixWorld(true);
    }
  }
  return {heights:[fl,fr,bl,br],pitch,bank,wheelGaps:wheels.map(gap)};
}
