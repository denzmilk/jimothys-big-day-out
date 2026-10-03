import * as THREE from 'three';
import {RAGDOLL as C,BODY_CONTACT} from '../core/Constants.js';
import {canPush,restrictMotion} from '../core/BodyContact.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';

// Pose the existing MPFB skeleton from a bounded set of articulated bodies.
// PhysicsSystem retains body/constraint ownership (ADR-0002).
export class HumanRagdolls {
  constructor(jimothy,voxels){
    this.jimothy=jimothy;this.voxels=voxels;this.people=new Map();this.active=new Map();this.time=0;
    eventBus.on(Events.HUMAN_IMPACT,({id,...hit})=>{const p=this.people.get(id);if(p)this.knock(p,hit);});
    eventBus.on(Events.HUMAN_REGISTER,p=>this.people.set(p.id,p));
    eventBus.on(Events.HUMAN_UNREGISTER,({id})=>{this.stop(id);this.people.delete(id);});
    eventBus.on(Events.PLAYER_CONTACT,m=>{
      if(canPush(m.fatness,BODY_CONTACT.HUMAN_MASS,BODY_CONTACT.HUMAN_PUSH_RATIO))return;
      for(const p of this.people.values())if(!p.attached&&!this.active.has(p.id))restrictMotion(m,{
        id:p.id,position:p.group.position,radius:BODY_CONTACT.HUMAN_RADIUS,
        bottom:p.group.position.y,top:p.group.position.y+BODY_CONTACT.HUMAN_HEIGHT});
    });
    eventBus.on(Events.ENTITY_ATTACH,({id})=>{this.stop(id);const p=this.people.get(id);if(p)p.attached=true;});
    eventBus.on(Events.ENTITY_RELEASE,({id})=>{const p=this.people.get(id);if(p){p.attached=false;p.immune=this.time+C.IMMUNITY;}});
    eventBus.on(Events.WORLD_IMPACT,hit=>{
      for(const p of this.people.values()){
        const center=p.group.position.clone();center.y+=C.HIT_HEIGHT;
        if(center.distanceTo(new THREE.Vector3(hit.x,hit.y,hit.z))<hit.radius+C.HIT_PADDING)this.knock(p,hit);
      }
    });
  }
  knock(p,hit){
    if(p.attached||this.active.has(p.id)||p.immune>this.time)return;
    if(hit.source==='roll'&&!canPush(gameState.player.fatness,BODY_CONTACT.HUMAN_MASS,BODY_CONTACT.HUMAN_PUSH_RATIO))return;
    if(this.active.size>=C.CAPACITY)return;
    p.group.updateMatrixWorld(true);
    const saved=[];p.visual.traverse(b=>{if(b.isBone)saved.push({bone:b,position:b.position.clone(),quaternion:b.quaternion.clone()});});
    const parts=[];
    for(const [name,endName] of C.BONES){
      const bone=p.visual.getObjectByName(name),end=p.visual.getObjectByName(endName);if(!bone||!end)continue;
      const a=bone.getWorldPosition(new THREE.Vector3()),b=end.getWorldPosition(new THREE.Vector3());
      const length=a.distanceTo(b),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
      const radius=name==='pelvis'||name==='spine_03'?C.TORSO_RADIUS:name==='neck_01'?C.HEAD_RADIUS:C.RADIUS;
      parts.push({name,bone,length,position:a.clone().add(b).multiplyScalar(.5),quaternion:q,
        half:[radius,Math.max(length/2,radius),radius],start:a,
        offset:q.clone().invert().multiply(bone.getWorldQuaternion(new THREE.Quaternion()))});
    }
    if(parts.length!==C.BONES.length)return;
    for(const part of parts){let parent=part.bone.parent;while(parent&&!parts.some(p=>p.bone===parent))parent=parent.parent;part.parent=parts.findIndex(p=>p.bone===parent);}
    const d=p.group.position.clone().sub(new THREE.Vector3(hit.x,p.group.position.y,hit.z));
    if(d.lengthSq()===0)d.set(Math.sin(this.jimothy.yaw),0,Math.cos(this.jimothy.yaw));d.normalize();
    const strength=hit.source?THREE.MathUtils.lerp(BODY_CONTACT.LEAN_HIT_SCALE,1,Math.min(1,gameState.player.fatness/BODY_CONTACT.FULL_HIT_FATNESS)):1;
    const speed=Math.min(C.MAX_SPEED,C.IMPULSE+hit.radius*C.POWER_GAIN)*strength;
    const rag={...p,parts,saved,age:0,rootOffset:parts[0].start.clone().sub(p.group.position),recovery:0};
    eventBus.emit(Events.RAGDOLL_CREATE,{id:p.id,parts,velocity:[d.x*speed,C.LIFT*strength,d.z*speed],receive:physics=>rag.physics=physics});
    if(!rag.physics)return;
    this.active.set(p.id,rag);eventBus.emit(Events.HUMAN_DOWN,{id:p.id,active:true});
    if(hit.source==='headbutt'&&strength<1)eventBus.emit(Events.PLAYER_RECOIL,{strength});
  }
  stop(id){
    const r=this.active.get(id);if(!r)return;
    eventBus.emit(Events.RAGDOLL_REMOVE,{id});
    for(const s of r.saved){s.bone.position.copy(s.position);s.bone.quaternion.copy(s.quaternion);}
    this.active.delete(id);const p=this.people.get(id);if(p)p.immune=this.time+C.IMMUNITY;
    eventBus.emit(Events.HUMAN_DOWN,{id,active:false,position:r.group.position.clone()});
  }
  update(dt){
    if(!gameState.game.isPlaying)return;this.time+=dt;
    const j=this.jimothy;
    if(j.move?.kind==='roll')for(const p of this.people.values()){
      const center=p.group.position.clone();center.y+=C.HIT_HEIGHT;
      if(center.distanceTo(j.body.position)<j.radius+C.CONTACT_PADDING)this.knock(p,{x:j.body.position.x,z:j.body.position.z,radius:j.radius,source:'roll'});
    }
    for(const r of this.active.values()){
      r.age+=dt;
      if(r.recovering){
        r.recovery+=dt;const t=Math.min(1,r.recovery/C.RECOVER_SECONDS),ease=t*t*(3-2*t);
        r.group.position.y=THREE.MathUtils.lerp(r.recoverY,r.ground,ease);
        for(const s of r.saved){s.bone.position.lerpVectors(s.fromPosition,s.position,ease);s.bone.quaternion.slerpQuaternions(s.fromQuaternion,s.quaternion,ease);}
        if(t===1)this.stop(r.id);continue;
      }
      const root=r.physics.bodies[0],start=new THREE.Vector3(0,-r.parts[0].length/2,0).applyQuaternion(root.quaternion).add(root.position);
      r.group.position.copy(start).sub(r.rootOffset);r.group.updateMatrixWorld(true);
      for(let i=0;i<r.parts.length;i++){
        const part=r.parts[i],body=r.physics.bodies[i],bone=part.bone;
        if(i===0)bone.position.copy(bone.parent.worldToLocal(start.clone()));
        const parentQ=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        bone.quaternion.copy(parentQ).multiply(new THREE.Quaternion().copy(body.quaternion)).multiply(part.offset);
        bone.updateMatrixWorld(true);
      }
      if(r.age>=C.MAX_SECONDS||(r.age>=C.DOWN_SECONDS&&root.velocity.length()<C.REST_SPEED)){
        r.recovering=true;r.recoverY=r.group.position.y;
        r.ground=this.voxels.groundHeightAt(r.group.position.x,r.group.position.z,start.y+C.HIT_HEIGHT);
        for(const s of r.saved){s.fromPosition=s.bone.position.clone();s.fromQuaternion=s.bone.quaternion.clone();}
        eventBus.emit(Events.RAGDOLL_REMOVE,{id:r.id});
      }
    }
  }
  reset(){for(const id of [...this.active.keys()])this.stop(id);this.time=0;}
  snapshot(){const a=[...this.active.values()];return {count:a.length,bodies:a.filter(r=>!r.recovering).reduce((n,r)=>n+r.parts.length,0),constraints:a.filter(r=>!r.recovering).reduce((n,r)=>n+r.parts.length-1,0),items:a.map(r=>({id:r.id,recovering:!!r.recovering,speed:+r.physics.bodies[0].velocity.length().toFixed(2),x:r.group.position.x,y:r.group.position.y,z:r.group.position.z}))};}
}
