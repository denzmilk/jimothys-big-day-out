import * as THREE from 'three';
import {GROUNDING as C} from './Constants.js';

const position=b=>b.getWorldPosition(new THREE.Vector3());
function rotateToward(bone,from,to){
  const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const turn=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
  bone.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));bone.updateWorldMatrix(false,true);
}

// Two-bone analytic IK runs after animation. Exported animation supplies the
// gait; live terrain queries supply the support height and foot normal.
export class FootGrounding {
  constructor(root,visual,ground){
    this.root=root;this.visual=visual;this.ground=ground;this.baseY=visual.position.y;
    root.updateWorldMatrix(true,true);
    const floor=new THREE.Box3().setFromObject(visual).min.y;
    this.legs=['l','r'].map(side=>{
      const hip=visual.getObjectByName(`thigh_${side}`),knee=visual.getObjectByName(`calf_${side}`),foot=visual.getObjectByName(`foot_${side}`);
      return {hip,knee,foot,offset:position(foot).y-floor,l1:position(hip).distanceTo(position(knee)),l2:position(knee).distanceTo(position(foot)),neutral:foot.getWorldQuaternion(new THREE.Quaternion()),stance:false,anchor:null};
    });
    this.contacts=[];
  }
  update(action,moving){
    this.visual.position.y=this.baseY-C.PELVIS_DROP;this.root.updateWorldMatrix(true,true);this.contacts=[];
    const phase=action?((action.time/action.getClip().duration)%1):0;
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(this.root.quaternion);
    let drop=0;
    const targets=this.legs.map((leg,i)=>{
      const stance=!moving||(i===0?phase<.5:phase>=.5),h=position(leg.hip),f=position(leg.foot);
      if(stance&&!leg.stance)leg.anchor=f.clone();
      if(!stance)leg.anchor=null;
      leg.stance=stance;
      let target=(leg.anchor||f).clone();
      const reach=(leg.l1+leg.l2)*C.MAX_REACH;
      if(Math.hypot(target.x-h.x,target.z-h.z)>reach*C.ANCHOR_REACH){target=f.clone();leg.anchor=stance?target.clone():null;}
      let ground=this.ground(target.x,target.z);
      // A planted anchor can become unreachable after a sharp turn, a drop,
      // or a release from Jimothy. Start a new foothold instead of stretching.
      const verticalReach=Math.sqrt(Math.max(0,reach*reach-(target.x-h.x)**2-(target.z-h.z)**2));
      if(stance&&h.y-(ground+leg.offset)-verticalReach>C.MAX_DROP){
        target=f.clone();ground=this.ground(target.x,target.z);leg.anchor=target.clone();
      }
      target.y=stance?ground+leg.offset+C.FOOT_CLEARANCE:Math.max(f.y,ground+leg.offset+C.FOOT_CLEARANCE);
      if(stance){
        const horizontal=Math.hypot(target.x-h.x,target.z-h.z);
        const available=Math.sqrt(Math.max(0,reach*reach-horizontal*horizontal));
        drop=Math.max(drop,h.y-target.y-available);
      }
      return {target,ground,stance};
    });
    this.visual.position.y-=Math.min(C.MAX_DROP,drop);this.root.updateWorldMatrix(true,true);
    for(let i=0;i<this.legs.length;i++){
      const leg=this.legs[i],{hip,knee,foot,l1,l2}=leg,{target,ground,stance}=targets[i];
      const h=position(hip),k=position(knee);
      const toward=target.clone().sub(h),distance=Math.min(toward.length(),(l1+l2)*C.MAX_REACH),axis=toward.normalize();
      const a=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-a*a));
      const pole=forward.clone().addScaledVector(axis,-forward.dot(axis)).normalize();
      const bend=h.clone().addScaledVector(axis,a).addScaledVector(pole,height);
      rotateToward(hip,k.clone().sub(h),bend.clone().sub(h));
      const nk=position(knee),nf=position(foot);rotateToward(knee,nf.sub(nk),target.clone().sub(nk));
      {
        const px=this.ground(target.x+C.PROBE,target.z)-this.ground(target.x-C.PROBE,target.z);
        const pz=this.ground(target.x,target.z+C.PROBE)-this.ground(target.x,target.z-C.PROBE);
        const normal=new THREE.Vector3(-px,2*C.PROBE,-pz).normalize();
        const world=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal)
          .multiply(this.root.getWorldQuaternion(new THREE.Quaternion())).multiply(leg.neutral);
        foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));foot.updateWorldMatrix(false,true);
      }
      const end=position(foot);this.contacts.push({stance,x:end.x,z:end.z,soleY:end.y-leg.offset,ground,error:end.y-leg.offset-ground});
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
