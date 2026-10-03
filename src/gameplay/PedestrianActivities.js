import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HumanActivityPose} from './HumanActivityPose.js';
import {PED_ACTIVITIES as C,PEDESTRIANS as PED} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import * as Layout from '../level/Layout.js';

// M51 is a component of the civilian owner. It borrows the existing people;
// even a piggyback pair must fit the same streaming and ragdoll limits.
export class PedestrianActivities {
 constructor(owner){
  this.owner=owner;this.catalog=C.CATALOG;this.enabled=true;this.clock=0;this.cursor=0;this.serial=0;this.dropped=[];this.templates=new Map();
  this.bag=this.catalog.flatMap(d=>Array(d.weight).fill(d.id));
  const loader=new GLTFLoader();this.loading=Promise.all(Object.keys(C.PROPS).map(async kind=>{
   const g=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/models/people/activities/${kind}.glb`);
   g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});this.templates.set(kind,g.scene);
  }));
  eventBus.on(Events.HUMAN_INTERRUPT,({id})=>{const p=owner.people.find(p=>p.id===id);if(p)this.stop(p,'impact');});
  eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.dropped.find(p=>p.id===id);if(p){p.attached=true;eventBus.emit(Events.PROP_SUSPEND,{id});}});
  eventBus.on(Events.ENTITY_RELEASE,({id,position})=>{const p=this.dropped.find(p=>p.id===id);if(p){p.attached=false;p.mesh.position.copy(position);p.life=C.DROP_LIFE;eventBus.emit(Events.PROP_RELEASE,{id,position});}});
 }
 init(p){p.activityPose=new HumanActivityPose(p);p.activityWait=C.START_DELAY+(this.owner.people.length%C.START_SPREAD);p.activity=null;}
 ground(x,z){const v=this.owner.voxels;return v.groundHeightAt(x,z,v.terrainHeightAt(x,z)+PED.GROUND_SCAN);}
 safe(p,x=p.x,z=p.z){
  return Layout.isFootpathAtWorld(x,z)&&this.owner._clear(x,z)&&Math.abs(this.ground(x,z)-p.y)<C.GROUND_TOLERANCE&&!this.owner.voxels.solidAtWorld(x,p.y+PED.BODY_PROBE,z);
 }
 path(p,to){
  const length=Math.hypot(to.x-p.x,to.z-p.z),steps=Math.max(1,Math.ceil(length/C.PATH_SAMPLE));
  for(let n=0;n<=steps;n++)if(!this.safe(p,THREE.MathUtils.lerp(p.x,to.x,n/steps),THREE.MathUtils.lerp(p.z,to.z,n/steps)))return false;
  return true;
 }
 direction(p){
  const node=this.owner.graph.get(p.node);if(!node)return null;
  const targets=node.links.map(k=>this.owner.graph.get(k)).filter(Boolean);
  for(const n of targets){const dx=n.x-p.x,dz=n.z-p.z,length=Math.hypot(dx,dz);if(length<PED.ARRIVE_RADIUS)continue;
   const direction={x:dx/length,z:dz/length};if(this.path(p,{x:p.x+direction.x*C.TRAVEL,z:p.z+direction.z*C.TRAVEL}))return direction;
  }return null;
 }
 birds(p){const query={birds:[]};eventBus.emit(Events.WILDLIFE_QUERY,query);return query.birds.filter(b=>Math.hypot(b.x-p.x,b.z-p.z)<C.BIRD_SEARCH).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));}
 // A dismounted pair can begin inside the spacing margin. Permit separation
 // while rejecting a new overlap, or both actors would remain stuck together.
 personClear(p,x,z,{performersOnly=false}={}){
  return !this.owner.people.some(q=>{
   if(q===p||q.id===p.activity?.partner||q.attached||q.ragdoll||(performersOnly&&!q.activity)||Math.abs(q.y-p.y)>=PED.BODY_PROBE)return false;
   const next=Math.hypot(q.x-x,q.z-z),current=Math.hypot(q.x-p.x,q.z-p.z);
   return next<C.PERSON_GAP&&next<=current;
  });
 }
 partner(p){return this.owner.people.find(q=>q!==p&&!q.activity&&!q.attached&&!q.ragdoll&&q.flee<=0&&Math.hypot(q.x-p.x,q.z-p.z)<C.PAIR_SEARCH&&this.path(q,p));}
 canStart(p,kind){
  const def=this.catalog.find(d=>d.id===kind);if(!def||p.activity||p.attached||p.ragdoll||p.flee>0||!this.safe(p))return false;
  if(['cartwheel','backwards','pair'].includes(def.mode)&&!this.direction(p))return false;
  if(def.mode==='pair'&&!this.partner(p))return false;
  if(def.mode==='chase'&&!this.birds(p).length)return false;
  if(def.mode==='stand'||def.mode==='seat'||def.mode==='hover')for(const [dx,dz]of[[C.CLEARANCE,0],[-C.CLEARANCE,0],[0,C.CLEARANCE],[0,-C.CLEARANCE]])if(!this.owner._clear(p.x+dx,p.z+dz)||Math.abs(this.ground(p.x+dx,p.z+dz)-p.y)>C.GROUND_TOLERANCE)return false;
  return true;
 }
 start(p,kind,{partner}={}){
  if(p.activity){console.debug('Pedestrian routine already active',p.id,p.activity.kind,kind);return false;}
  if(!this.canStart(p,kind))return false;
  const def=this.catalog.find(d=>d.id===kind),count=this.owner.people.filter(p=>p.activity).length;
  if(count+(def.mode==='pair'?2:1)>C.MAX_ACTIVE)return false;
  const act={...def,kind,time:0,serial:this.serial++,phase:'perform',origin:{x:p.x,y:p.y,z:p.z},direction:this.direction(p)};
  p.target=null;p.pause=0;p.grounding.reset();p.activity=act;
  if(def.prop){const mesh=this.templates.get(def.prop).clone();p.visual.getObjectByName('hand_r').add(mesh);act.prop={kind:def.prop,mesh};}
  if(def.mode==='chase')act.bird=this.birds(p)[0].id;
  if(def.mode==='pair'){
   const q=partner||this.partner(p);if(!q||q.activity||q.attached||q.ragdoll||!this.path(q,p)){p.activity=null;return false;}
   act.phase='approach';act.role='carrier';act.partner=q.id;
   q.activity={...act,serial:this.serial++,origin:{x:q.x,y:q.y,z:q.z},role:'rider',partner:p.id};q.target=null;q.grounding.reset();
  }
  return true;
 }
 prepare(p){p.activityPose.restore();}
 removeDrop(p){eventBus.emit(Events.PROP_REMOVE,{id:p.id});eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});p.mesh.removeFromParent();this.dropped.splice(this.dropped.indexOf(p),1);}
 drop(prop){
  while(this.dropped.length>=C.DROP_MAX){const old=this.dropped.find(p=>!p.attached);if(!old){prop.mesh.removeFromParent();return;}this.removeDrop(old);}
  this.owner.scene.attach(prop.mesh);const p={...prop,...C.PROPS[prop.kind],id:`activity-prop:${this.serial++}`,mass:C.DROP_MASS,loose:true,life:C.DROP_LIFE,attached:false};
  this.dropped.push(p);eventBus.emit(Events.PROP_CREATE,p);eventBus.emit(Events.ENTITY_REGISTER,{id:p.id,mesh:p.mesh,kind:'prop',size:p.size});
  eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity:[C.DROP_SPEED,C.DROP_LIFT,0],spin:C.DROP_SPIN});
 }
 stop(p,reason='finished'){
  const a=p.activity;if(!a)return;
  if(a.prop){if(['fright','impact','attached','support'].includes(reason))this.drop(a.prop);else a.prop.mesh.removeFromParent();}
  p.activity=null;p.activityPose.restore();p.grounding.reset();p.target=null;p.lastActivity=a.kind;p.activityWait=C.COOLDOWN+(this.serial++%C.COOLDOWN_SPREAD);
  if(a.role==='rider'){
   const at=this.dismount(p,a);p.x=at.x;p.z=at.z;p.y=this.ground(p.x,p.z);p.mesh.position.set(p.x,p.y+PED.FOOT_CLEARANCE,p.z);
  }
  const other=this.owner.people.find(p=>p.id===a.partner);if(other?.activity){this.stop(other,reason);if(['fright','impact','attached'].includes(reason))other.flee=PED.FLEE_SECONDS;}
 }
 dismount(p,a){
  if(a.exit)return a.exit;
  const q=this.owner.people.find(p=>p.id===a.partner),yaw=q?.mesh.rotation.y||p.mesh.rotation.y;
  for(const sign of [1,-1]){const at={x:p.x+Math.cos(yaw)*C.PAIR_MOUNT*sign,z:p.z-Math.sin(yaw)*C.PAIR_MOUNT*sign};if(this.safe({...p,y:this.ground(p.x,p.z)},at.x,at.z))return at;}
  return a.origin;
 }
 before(dt){
  for(const p of [...this.dropped])if(!p.attached){p.life-=dt;if(p.life<=0||p.mesh.position.distanceTo(this.owner.jimothy.position)>PED.RADIUS)this.removeDrop(p);}
  for(const p of this.owner.people)p.activityWait=Math.max(0,p.activityWait-dt);
  this.clock-=dt;if(!this.enabled||this.clock>0)return;this.clock=C.CHECK_INTERVAL;
  const people=this.owner.people,j=this.owner.jimothy.position;
  for(let n=0;n<people.length;n++){
   const p=people[(n+this.cursor)%people.length];if(p.activityWait>0||p.activity||p.flee>0||Math.hypot(p.x-j.x,p.z-j.z)>C.RANGE)continue;
   for(let k=0;k<this.bag.length;k++){
    const kind=this.bag[(this.serial+k)%this.bag.length];if(kind===p.lastActivity)continue;
    if(this.start(p,kind)){this.cursor=(n+this.cursor+1)%people.length;return;}
   }
  }
 }
 move(p,to,speed,dt){
  const dx=to.x-p.x,dz=to.z-p.z,length=Math.hypot(dx,dz);if(length<PED.ARRIVE_RADIUS)return true;
  // Match ordinary walking's turn-before-travel rule. Otherwise a new bird
  // target drags planted feet sideways while the hips still face the old one.
  const forward=p.activity?.mode==='chase'||p.activity?.mode==='pair';
  const alignment=forward?Math.max(0,Math.cos(Math.atan2(dx,dz)-p.mesh.rotation.y)):1;
  const step=Math.min(length,speed*alignment*dt),x=p.x+dx/length*step,z=p.z+dz/length*step;
  if(!this.safe({...p,y:this.ground(p.x,p.z)},x,z)||!this.personClear(p,x,z))return false;
  p.x=x;p.z=z;p.y=this.ground(x,z);return true;
 }
 update(p,dt){
  const a=p.activity;if(!a)return false;
  if(p.flee>0){this.stop(p,'fright');return false;}
  if(a.role!=='rider'&&Math.abs(this.ground(p.x,p.z)-p.y)>C.GROUND_TOLERANCE){this.stop(p,'support');return false;}
  a.time+=dt;let moving=false,yaw=p.mesh.rotation.y,grounded=true;
  if(a.mode==='pair'){
   const q=this.owner.people.find(p=>p.id===a.partner);if(!q?.activity||q.flee>0){this.stop(p,'fright');return false;}
   if(a.phase==='approach'){
    if(a.time>C.PAIR_TIMEOUT){this.stop(p);return false;}
    if(a.role==='rider'){
     const to={x:q.x-Math.sin(q.mesh.rotation.y)*C.RIDER_BACK,z:q.z-Math.cos(q.mesh.rotation.y)*C.RIDER_BACK};
     yaw=Math.atan2(to.x-p.x,to.z-p.z);moving=true;
     if(!this.move(p,to,C.PAIR_APPROACH,dt)){this.stop(p);return false;}
     if(Math.hypot(p.x-to.x,p.z-to.z)<C.PAIR_MOUNT){a.mount={x:p.x,z:p.z};a.phase=q.activity.phase='perform';a.time=q.activity.time=0;}
    }
   }else if(a.role==='carrier'){
    const to={x:a.origin.x+a.direction.x*C.TRAVEL,z:a.origin.z+a.direction.z*C.TRAVEL};yaw=Math.atan2(a.direction.x,a.direction.z);
    // Yield without dropping the rider. Timed recovery still lowers both
    // actors smoothly when another pedestrian blocks the shared route.
    moving=a.time<a.duration-C.BLEND&&this.move(p,to,C.CARRY_SPEED,dt);
   }else{
    a.carrier=q;const fade=THREE.MathUtils.smoothstep(Math.min(a.time/C.BLEND,(a.duration-a.time)/C.BLEND),0,1),height=q.activityPose.height;
    const mount=THREE.MathUtils.smoothstep(a.time/C.BLEND,0,1),dismount=THREE.MathUtils.smoothstep((a.time-a.duration+C.BLEND)/C.BLEND,0,1);
    const back={x:q.x-Math.sin(q.mesh.rotation.y)*C.RIDER_BACK,z:q.z-Math.cos(q.mesh.rotation.y)*C.RIDER_BACK};
    if(dismount>0&&!a.exit)a.exit=this.dismount(p,a);
    p.x=THREE.MathUtils.lerp(a.mount.x,back.x,mount);p.z=THREE.MathUtils.lerp(a.mount.z,back.z,mount);
    if(a.exit){p.x=THREE.MathUtils.lerp(p.x,a.exit.x,dismount);p.z=THREE.MathUtils.lerp(p.z,a.exit.z,dismount);}
    p.y=THREE.MathUtils.lerp(q.y,this.ground(p.x,p.z),dismount)+C.RIDER_LIFT*height*fade;yaw=q.mesh.rotation.y;grounded=false;
   }
  }else if(a.mode==='backwards'||a.mode==='cartwheel'){
   const to={x:a.origin.x+a.direction.x*C.TRAVEL,z:a.origin.z+a.direction.z*C.TRAVEL};
   const speed=a.mode==='backwards'?C.MOON_SPEED:C.TRAVEL/(a.duration-C.BLEND*2);
   moving=a.time>C.BLEND&&a.time<a.duration-C.BLEND;
   if(moving&&!this.move(p,to,speed,dt)){this.stop(p);return false;}
   yaw=Math.atan2(a.direction.x,a.direction.z)+(a.mode==='backwards'?Math.PI:-Math.PI/2);grounded=false;
  }else if(a.mode==='chase'){
   a.refresh=(a.refresh||0)-dt;
   if(a.refresh<=0){a.refresh=C.BIRD_REFRESH;const birds=this.birds(p),bird=birds.find(b=>b.id===a.bird);if(!bird){this.stop(p);return false;}
    const node=this.owner.graph.get(p.node)||[...this.owner.graph.values()].sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
    a.goal=node?.links.map(k=>this.owner.graph.get(k)).filter(n=>n&&this.path(p,n)).sort((a,b)=>Math.hypot(a.x-bird.x,a.z-bird.z)-Math.hypot(b.x-bird.x,b.z-bird.z))[0];
    if(Math.hypot(p.x-bird.x,p.z-bird.z)<C.BIRD_STARTLE)eventBus.emit(Events.WILDLIFE_STARTLE,{id:bird.id,source:p.id,x:p.x,z:p.z,seconds:C.BIRD_FLEE});
   }
   if(a.goal){yaw=Math.atan2(a.goal.x-p.x,a.goal.z-p.z);moving=true;if(!this.move(p,a.goal,C.CHASE_SPEED,dt)){this.stop(p);return false;}if(Math.hypot(p.x-a.goal.x,p.z-a.goal.z)<PED.ARRIVE_RADIUS)p.node=a.goal.key;}
  }else if(a.mode==='seat'||a.mode==='hover')grounded=false;
  if(a.phase!=='approach'&&a.time>=a.duration){this.stop(p);return false;}
  if(a.phase!=='approach')a.phase=a.time>a.duration-C.BLEND?'recover':'perform';
  p.mesh.position.set(p.x,p.y+PED.FOOT_CLEARANCE,p.z);
  const turn=Math.atan2(Math.sin(yaw-p.mesh.rotation.y),Math.cos(yaw-p.mesh.rotation.y));p.mesh.rotation.y+=turn*Math.min(1,dt*PED.TURN_SPEED);
  // These short pavement routines use the walking stride even at a brisk
  // chase. The fleeing Run stride spreads the legs too far at this pace.
  this.owner._animate(p,moving?'Walk':'Idle');p.mixer.update(dt);
  if(grounded)p.grounding.update(p.actions[p.animation],moving,dt,C.STRIDE_SCALE);else{p.visual.position.y=p.grounding.baseY;p.grounding.contacts=[];}
  p.activityPose.apply(a);return true;
 }
 reset(){for(const p of [...this.dropped])this.removeDrop(p);this.clock=0;this.cursor=0;this.serial=0;}
 snapshot(){return {catalog:this.catalog.map(d=>d.id),active:this.owner.people.filter(p=>p.activity).length,dropped:this.dropped.length,limit:C.MAX_ACTIVE};}
}
