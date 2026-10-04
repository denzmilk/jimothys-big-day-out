import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import {RubbleSurfaces} from '../core/RubbleSurfaces.js';
import { WORLD, PHYSICS, VOXEL, STREET, RAGDOLL, WATER, TERRAIN, BODY_CONTACT, SUPPORT, RUBBLE as R } from '../core/Constants.js';
import {canPush,restrictMotion} from '../core/BodyContact.js';
import { eventBus, Events } from '../core/EventBus.js';

// Owns the cannon-es world (ADR-0002). Fixed-step accumulator keeps
// advanceTime(1/60 steps) exactly one world.step per update — deterministic
// for the test harness regardless of render frame rate.
//
// The world it steps contains almost no static geometry, and that is on
// purpose: the voxel city has NO colliders (ADR-0003). Dynamic bodies are
// clamped against the grid after each step instead — see `_groundBodies`, and
// JIM-42 for what happened during the eleven months nothing did that.
export class PhysicsSystem {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -WORLD.GRAVITY, 0) });
    this.world.allowSleep = true;
    this.world.broadphase=new CANNON.SAPBroadphase(this.world);
    this.world.broadphase.axisIndex=0;this.world.broadphase.useBoundingBoxes=true;
    this.surfaces=new RubbleSurfaces();this.actors=new Map();this.grace=new Map();this.time=0;
    const broadphase=this.world.broadphase,need=broadphase.needBroadphaseCollision.bind(broadphase);
    broadphase.needBroadphaseCollision=(a,b)=>{const pair=this.grace.get(this.contactKey(a,b));return need(a,b)&&!(pair&&(pair.permanent||this.time<pair.until));};
    const narrowphase=this.world.narrowphase,contacts=narrowphase.getContacts.bind(narrowphase);
    narrowphase.getContacts=(...args)=>{
      contacts(...args);
      // M52: birth overlaps need gentle positional correction, not an abrupt
      // second blast when grace expires. Impact velocity and friction still solve.
      for(const c of args[3])if(this.grace.has(this.contactKey(c.bi,c.bj))){
        const a=c.bi.position,b=c.bj.position,n=c.ni;
        const gap=n.x*(b.x+c.rj.x-a.x-c.ri.x)+n.y*(b.y+c.rj.y-a.y-c.ri.y)+n.z*(b.z+c.rj.z-a.z-c.ri.z);
        if(gap<-R.EPSILON)c.a=Math.min(c.a,R.SPAWN_SEPARATION/-gap);
      }
    };
    eventBus.on(Events.PHYSICAL_GROUND,q=>q.receive(this.surfaces.height(q.x,q.z,q.fromY,q.stepUp)));
    eventBus.on(Events.PHYSICAL_OBSTACLE,q=>q.receive(this.surfaces.solid(q.x,q.y,q.z)));
    eventBus.on(Events.ENTITY_REGISTER,p=>this.registerActor(p));
    eventBus.on(Events.PHYSICAL_ACTOR_CREATE,p=>this.registerActor(p));
    eventBus.on(Events.PHYSICAL_ACTOR_REMOVE,({id})=>{this.setActorActive(id,false);this.actors.delete(id);});
    eventBus.on(Events.ENTITY_UNREGISTER,({id})=>{this.setActorActive(id,false);this.actors.delete(id);});
    eventBus.on(Events.ENTITY_ATTACH,({id})=>{const a=this.actors.get(id);if(a){a.attached=true;this.setActorActive(id,false);}});
    eventBus.on(Events.ENTITY_RELEASE,({id})=>{const a=this.actors.get(id);if(a){a.attached=false;this.placeActor(a);this.setActorActive(id,!a.down);}});
    eventBus.on(Events.HUMAN_DOWN,({id,active})=>{const a=this.actors.get(id);if(a){a.down=active;this.placeActor(a);this.setActorActive(id,!active&&!a.attached);}});
    this.fixedStep = 1 / 60;
    this.accumulator = 0;
    this.pairs = [];
    this.wallBodies = [];
    // Everything that has to be told where the ground is. Populated by `add`,
    // so anything given a mass gets this for free — including the vehicles and
    // props in the entity-registry backlog, which must not each re-derive it.
    this.dynamic = [];
    this.waterContacts = new WeakMap();
    this.voxels = null;

    // ADR-0005: keep the safety plane below the seabed so it cannot turn
    // water into a solid floor or suppress buoyancy and sinking.
    const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    ground.position.y=-TERRAIN.SEABED_DEPTH-TERRAIN.DEPTH;
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);

    this.buildWalls();
    eventBus.on(Events.TOOL_FORCE,({mesh,velocity,spin})=>{const pair=this.pairs.find(p=>p.mesh===mesh);if(!pair)return;const b=pair.body;b.type=CANNON.Body.DYNAMIC;b.updateMassProperties();if(!this.dynamic.includes(b))this.dynamic.push(b);b.velocity.set(...velocity);if(spin)b.angularVelocity.set(...spin);b.wakeUp();});
    this.props = new Map();
    this.unsupported=new Set();
    eventBus.on(Events.TRAFFIC_OBSTACLES,({obstacles})=>{
      for(const [id,p]of this.props)if(p.active&&p.body.type===CANNON.Body.DYNAMIC&&p.body.mass>=STREET.CAR.MASS*R.PUSH_RATIO){const q=p.body.position,h=this._support(p.body);obstacles.push({id,x:q.x,y:q.y,z:q.z,width:h.x,length:h.z});}
    });
    eventBus.on(Events.WORLD_DEMOLISHED,({bounds})=>{
      if(!bounds)return;for(const [id,p] of this.props){const q=p.body.position,h=p.entity.half;
        if(p.active&&p.body.type===CANNON.Body.KINEMATIC&&q.x+h[0]>=bounds.min[0]&&q.x-h[0]<=bounds.max[0]&&q.z+h[2]>=bounds.min[2]&&q.z-h[2]<=bounds.max[2])this.unsupported.add(id);
      }
    });
    eventBus.on(Events.PROP_CREATE, p => {
      const body = new CANNON.Body({mass:p.mass,type:p.loose?CANNON.Body.DYNAMIC:CANNON.Body.KINEMATIC,
        linearDamping:STREET.DAMPING,angularDamping:STREET.DAMPING});
      for(const shape of p.shapes||[{half:p.half,offset:[0,0,0]}])body.addShape(new CANNON.Box(new CANNON.Vec3(...shape.half)),new CANNON.Vec3(...shape.offset));
      body.position.copy(p.mesh.position);body.quaternion.copy(p.mesh.quaternion);
      if(p.collisionFilterMask!==undefined)body.collisionFilterMask=p.collisionFilterMask;
      if(p.collisionFilterGroup!==undefined)body.collisionFilterGroup=p.collisionFilterGroup;
      body.sleepSpeedLimit=STREET.SLEEP_SPEED;body.sleepTimeLimit=STREET.SLEEP_TIME;
      this.props.set(p.id,{body,mesh:p.mesh,active:true,entity:p});this.add(body,p.mesh);if(p.spawnSafe)this.protectSpawn(body);
    });
    eventBus.on(Events.PROP_REMOVE, ({id}) => {const p=this.props.get(id);if(p){if(p.active)this.remove(p.body,p.mesh);this.props.delete(id);}});
    eventBus.on(Events.PROP_CONTROL,({id})=>{
      const p=this.props.get(id);if(!p)return;p.body.type=CANNON.Body.KINEMATIC;p.body.updateMassProperties();p.body.velocity.setZero();p.body.angularVelocity.setZero();this.dynamic=this.dynamic.filter(b=>b!==p.body);this.resetSweep(p.body);p.body.wakeUp();
    });
    eventBus.on(Events.PLAYER_RIDE,({active,keepLaunch})=>{
      const b=this.playerBody;if(!b)return;
      if(active){this.playerRideMask??=b.collisionFilterMask;b.collisionFilterMask=0;}
      else if(this.playerRideMask!==undefined){b.collisionFilterMask=this.playerRideMask;this.playerRideMask=undefined;}
      if(!keepLaunch)b.velocity.setZero();this.resetSweep(b);
    });
    eventBus.on(Events.VEHICLE_CONTACTS,({receive})=>receive([...this.props.values()].filter(p=>p.active).map(p=>({id:p.entity.id,mesh:p.mesh,half:p.entity.half,mass:p.body.mass,kind:p.entity.kind}))));
    eventBus.on(Events.PROP_POSE, ({id,position,quaternion}) => {const p=this.props.get(id);if(p?.active){p.targetPosition=new CANNON.Vec3(position.x,position.y,position.z);p.targetQuaternion=new CANNON.Quaternion(quaternion.x,quaternion.y,quaternion.z,quaternion.w);}});
    eventBus.on(Events.PROP_SUSPEND, ({id}) => {const p=this.props.get(id);if(p?.active){this.remove(p.body,p.mesh);p.active=false;}});
    eventBus.on(Events.PROP_RELEASE, ({id,position}) => {
      const p=this.props.get(id);if(!p)return;
      p.body.type=CANNON.Body.DYNAMIC;p.body.updateMassProperties();p.body.position.copy(position);p.body.quaternion.copy(p.mesh.quaternion);
      p.body.velocity.setZero();p.body.angularVelocity.setZero();this.resetSweep(p.body);
      if(!p.active){this.add(p.body,p.mesh);p.active=true;}else if(!this.dynamic.includes(p.body))this.dynamic.push(p.body);
      p.body.wakeUp();
    });
    eventBus.on(Events.PROP_IMPULSE, ({id,velocity,spin}) => {
      const p=this.props.get(id);if(!p?.active)return;
      p.body.type=CANNON.Body.DYNAMIC;p.body.updateMassProperties();if(!this.dynamic.includes(p.body))this.dynamic.push(p.body);
      p.body.velocity.set(...velocity);p.body.angularVelocity.set(spin,0,-spin);p.body.wakeUp();
    });


    eventBus.on(Events.PLAYER_BODY_READY,({body})=>{this.playerBody=body;body._player=true;body.collisionFilterMask &= ~R.ACTOR_GROUP;});
    eventBus.on(Events.PLAYER_CONTACT,m=>{
      for(const {body,entity:p,active} of this.props.values()){
        if(!active||canPush(m.fatness,p.mass,p.kind==='car'?BODY_CONTACT.CAR_PUSH_RATIO:R.PUSH_RATIO)||!(p.kind==='car'||body.type===CANNON.Body.DYNAMIC))continue;
        if(Math.hypot(m.position.x-body.position.x,m.position.z-body.position.z)>
          m.radius+Math.hypot(p.half[0],p.half[1],p.half[2])+Math.hypot(m.velocity.x,m.velocity.z)*m.dt+BODY_CONTACT.SKIN)continue;
        const support=this._support(body),forward=body.quaternion.vmult(new CANNON.Vec3(0,0,1));
        restrictMotion(m,{id:p.id,position:body.position,half:p.half,yaw:Math.atan2(forward.x,forward.z),
          bottom:body.position.y-support.y,top:body.position.y+support.y});
      }
    });
    eventBus.on(Events.PLAYER_LAUNCHED,({velocity,mass})=>{
      const body=this.playerBody;if(!body)return;
      // Jimothy keeps his swept voxel contact solver while Cannon owns flight.
      body.type=CANNON.Body.DYNAMIC;body.mass=mass;body.updateMassProperties();body.velocity.set(...velocity);body.wakeUp();
    });
    eventBus.on(Events.PLAYER_CONTROLLED,()=>{
      const body=this.playerBody;if(!body)return;body.type=CANNON.Body.KINEMATIC;body.mass=0;body.updateMassProperties();body.angularVelocity.setZero();body.quaternion.set(0,0,0,1);this.resetSweep(body);this.dynamic=this.dynamic.filter(b=>b!==body);
    });

    this.ragdolls=new Map();
    eventBus.on(Events.RAGDOLL_CREATE,({id,parts,velocity,receive})=>{
      const C=RAGDOLL,bodies=parts.map(p=>{
        const b=new CANNON.Body({mass:C.MASS,shape:new CANNON.Box(new CANNON.Vec3(...p.half)),
          linearDamping:C.DAMPING,angularDamping:C.DAMPING,collisionFilterGroup:C.GROUP,collisionFilterMask:C.MASK});
        b.position.copy(p.position);b.quaternion.copy(p.quaternion);b.velocity.set(...velocity);
        b._ragdoll=true;b.angularVelocity.set(C.SPIN,0,-C.SPIN);this.add(b);return b;
      });
      const constraints=[];
      parts.forEach((p,i)=>{
        if(p.parent<0)return;
        const a=bodies[p.parent],b=bodies[i],point=new CANNON.Vec3(p.start.x,p.start.y,p.start.z);
        const axis=b.quaternion.vmult(new CANNON.Vec3(0,1,0));
        const c=new CANNON.ConeTwistConstraint(a,b,{pivotA:a.pointToLocalFrame(point),pivotB:b.pointToLocalFrame(point),
          axisA:a.vectorToLocalFrame(axis),axisB:new CANNON.Vec3(0,1,0),angle:C.ANGLE,twistAngle:C.TWIST,maxForce:C.FORCE,collideConnected:false});
        constraints.push(c);this.world.addConstraint(c);
      });
      // Limbs within one ragdoll keep their joint spacing; other ragdolls and wreckage collide.
      for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)this.grace.set(this.contactKey(bodies[i],bodies[j]),{a:bodies[i],b:bodies[j],permanent:true});
      const r={bodies,constraints};this.ragdolls.set(id,r);receive(r);
    });
    eventBus.on(Events.RAGDOLL_REMOVE,({id})=>{
      const r=this.ragdolls.get(id);if(!r)return;
      for(const c of r.constraints)this.world.removeConstraint(c);
      for(const b of r.bodies)this.remove(b);this.ragdolls.delete(id);
    });

    eventBus.on(Events.DEV_TUNING_CHANGED, ({ group, key }) => {
      if (group === 'WORLD' && key === 'GRAVITY') this.world.gravity.y = -WORLD.GRAVITY;
      if (group === 'WORLD' && key === 'BOUNDS') this.buildWalls();
    });
  }

  // Perimeter walls just outside WORLD.BOUNDS so bonked cans stay on the
  // block. Rebuilt live when the DevTools bounds slider moves.
  buildWalls() {
    for (const wall of this.wallBodies) this.world.removeBody(wall);
    this.wallBodies = [];
    const B = WORLD.BOUNDS;
    const t = 1;
    const h = 2;
    for (const [x, z, sx, sz] of [
      [0, -B - t, B + t * 2, t], [0, B + t, B + t * 2, t],
      [-B - t, 0, t, B + t * 2], [B + t, 0, t, B + t * 2],
    ]) {
      const wall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(sx, h, sz)),
        position: new CANNON.Vec3(x, h, z),
      });
      this.world.addBody(wall);
      this.wallBodies.push(wall);
    }
  }

  /** The voxel world to clamp against. Injected rather than constructed here,
   *  because `VoxelWorld` is built after this and the dependency only points
   *  one way: physics asks the world where the ground is, and never writes. */
  attachWorld(voxels) {
    this.voxels = voxels;
  }

  /** Forget where a body was last step. Anything that TELEPORTS a body must
   *  call this, because the clamp reverts into that remembered position when a
   *  move ends inside solid — so a stale one does not just fail to help, it
   *  fires the body back to wherever it used to be.
   *
   *  The debris pool is the reason this exists: 150 bodies recycled by index,
   *  so slot 7's "previous position" is a spot on the other side of the map
   *  from the blast three seconds ago. Same discipline as `teleportJimothy`
   *  clearing `_prevX` / `_prevFeetY`. */
  resetSweep(body) {
    this.waterContacts.delete(body);
    body._prevX = undefined;
    body._prevY = undefined;
    body._prevZ = undefined;
  }

  add(body, mesh = null) {
    this.world.addBody(body);
    if (mesh) this.pairs.push({ body, mesh });
    // DYNAMIC only. Jimothy is KINEMATIC and clamps himself against this same
    // grid, with an auto-step and a hop that a second clamp would fight — a
    // considerably worse bug than the one this fixes.
    if (body.type === CANNON.Body.DYNAMIC) this.dynamic.push(body);
  }

  remove(body, mesh = null) {
    this.waterContacts.delete(body);
    this.world.removeBody(body);
    for(const [key,pair]of this.grace)if(pair.a===body||pair.b===body)this.grace.delete(key);
    const d = this.dynamic.indexOf(body);
    if (d !== -1) this.dynamic.splice(d, 1);
    if (mesh) {
      const i = this.pairs.findIndex((p) => p.body === body);
      if (i !== -1) this.pairs.splice(i, 1);
    }
  }

  update(delta) {
    this.time+=delta;this.checkSupport();this.moveActors(delta);this.moveProps(delta);this.updateGrace();
    this.accumulator += delta;
    while (this.accumulator >= this.fixedStep - 1e-9) {
      this._floatBodies(this.fixedStep);
      for(const body of [...this.dynamic,...[...this.actors.values()].filter(a=>a.active).map(a=>a.body)]){body._contactVelocity??=new CANNON.Vec3();body._contactVelocity.copy(body.velocity);}
      this.world.step(this.fixedStep);
      // Inside the loop, not once per frame: a chunk at blast speed crosses a
      // 0.55 m voxel in about one step, so clamping per FRAME would let it
      // through the floor on any frame that ran two.
      this._groundBodies();
      this.accumulator -= this.fixedStep;
    }
    for(const p of this.props.values())if(p.active&&p.body.type===CANNON.Body.KINEMATIC&&p.targetPosition){p.body.position.copy(p.targetPosition);p.body.quaternion.copy(p.targetQuaternion);p.targetPosition=null;p.body.aabbNeedsUpdate=true;}
    // JIM-85: at 120 Hz, alternate updates contain no 60-Hz physics step.
    // Carrying an overshot pose into the next velocity estimate makes a route
    // placement oscillate forever. Match the authored pose after integration,
    // as driven props do, while retaining velocity for contact reporting.
    for(const a of this.actors.values())if(a.active)this.placeActor(a,false);
    this.surfaces.rebuild(this.dynamic);this.actorImpacts();
    for (const { body, mesh } of this.pairs) {
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
  }

  contactKey(a,b){return a.id<b.id?`${a.id}:${b.id}`:`${b.id}:${a.id}`;}
  protectSpawn(body){
    body.updateAABB();
    for(const b of this.world.bodies){if(b===body||b.type===CANNON.Body.STATIC)continue;b.updateAABB();if(body.aabb.overlaps(b.aabb))this.grace.set(this.contactKey(body,b),{a:body,b,until:this.time+R.SPAWN_GRACE});}
  }
  updateGrace(){
    for(const [key,p]of this.grace){
      if(p.permanent)continue;p.a.updateAABB();p.b.updateAABB();
      if(!p.a.aabb.overlaps(p.b.aabb))this.grace.delete(key);
    }
  }
  registerActor(p){
    if(!['person','animal','crab-person','fish'].includes(p.kind)||this.actors.has(p.id)||this.actors.size>=R.ACTOR_LIMIT)return;
    let half=R.HUMAN_HALF,offset=R.HUMAN_OFFSET;
    if(p.kind!=='person'){
      p.mesh.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(p.mesh),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      half=[size.x/2,size.y/2,size.z/2].map(v=>Math.max(R.ANIMAL_MIN,Math.min(R.ANIMAL_MAX,v)));
      offset=[0,Math.max(half[1],center.y-p.mesh.position.y),0];
    }
    half=p.collisionHalf||half;offset=p.collisionOffset||offset;
    const body=new CANNON.Body({type:CANNON.Body.KINEMATIC,shape:new CANNON.Box(new CANNON.Vec3(...half)),collisionFilterGroup:R.ACTOR_GROUP,collisionFilterMask:R.ACTOR_MASK});
    const a={...p,body,offset,active:false,down:false,attached:false,hitAfter:0};body._actor=a;this.actors.set(p.id,a);this.placeActor(a);this.setActorActive(p.id,true);
  }
  placeActor(a,resetVelocity=true){const p=a.mesh.position;a.body.position.set(p.x+a.offset[0],p.y+a.offset[1],p.z+a.offset[2]);a.body.quaternion.copy(a.mesh.quaternion);if(resetVelocity)a.body.velocity.setZero();a.body.aabbNeedsUpdate=true;}
  setActorActive(id,active){const a=this.actors.get(id);if(!a||a.active===active)return;a.active=active;if(active)this.add(a.body);else this.remove(a.body);}
  moveActors(dt){
    for(const a of this.actors.values()){
      const near=!this.playerBody||a.mesh.position.distanceTo(this.playerBody.position)<R.ACTOR_RANGE;
      const active=near&&!a.down&&!a.attached;this.setActorActive(a.id,active);if(!active)continue;
      const p=a.mesh.position,b=a.body,target=new CANNON.Vec3(p.x+a.offset[0],p.y+a.offset[1],p.z+a.offset[2]),distance=b.position.distanceTo(target);
      if(distance>R.ACTOR_TELEPORT||dt<=0)this.placeActor(a);
      else{target.vsub(b.position,b.velocity);b.velocity.scale(1/dt,b.velocity);b.quaternion.copy(a.mesh.quaternion);b.aabbNeedsUpdate=true;}
    }
  }
  moveProps(dt){
    for(const p of this.props.values())if(p.active&&p.body.type===CANNON.Body.KINEMATIC){
      const b=p.body,target=p.targetPosition;
      if(!target){b.velocity.setZero();continue;}
      if(dt>0&&b.position.distanceTo(target)<R.ACTOR_TELEPORT){target.vsub(b.position,b.velocity);b.velocity.scale(1/dt,b.velocity);}
      else{b.position.copy(target);b.velocity.setZero();this.resetSweep(b);}
      b.quaternion.copy(p.targetQuaternion);b.aabbNeedsUpdate=true;
    }
  }
  actorImpacts(){
    const hits=[];
    for(const c of this.world.contacts){
      const body=c.bi._actor?c.bi:c.bj._actor?c.bj:null;if(!body)continue;
      const a=body._actor,b=c.bi===body?c.bj:c.bi;if(a.kind!=='person'||a.hitAfter>this.time||b.type!==CANNON.Body.DYNAMIC||b.mass<R.HIT_MASS)continue;
      const incoming=b._contactVelocity||b.velocity,actorVelocity=body._contactVelocity||body.velocity;
      const speed=Math.abs(c.ni.x*(incoming.x-actorVelocity.x)+c.ni.y*(incoming.y-actorVelocity.y)+c.ni.z*(incoming.z-actorVelocity.z));if(speed<R.HIT_SPEED||b.mass*speed<R.HIT_MOMENTUM)continue;
      a.hitAfter=this.time+R.HIT_COOLDOWN;hits.push({id:a.id,x:b.position.x,y:b.position.y,z:b.position.z,radius:this._support(b).r,power:R.HIT_POWER,source:'rubble'});
    }
    for(const hit of hits)eventBus.emit(Events.HUMAN_IMPACT,hit);
  }

  checkSupport(){
    let work=0;
    for(const id of this.unsupported){
      if(work++>=SUPPORT.PROP_WORK)break;this.unsupported.delete(id);const p=this.props.get(id);
      if(!p?.active||p.body.type!==CANNON.Body.KINEMATIC)continue;
      const q=p.body.position,s=this._support(p.body),feet=q.y-s.y;
      const held=[[0,0],[s.x*SUPPORT.FOOTPRINT,0],[-s.x*SUPPORT.FOOTPRINT,0],[0,s.z*SUPPORT.FOOTPRINT],[0,-s.z*SUPPORT.FOOTPRINT]].some(([x,z])=>this.voxels.groundHeightAt(q.x+x,q.z+z,feet,0)>=feet-SUPPORT.GAP);
      if(held)continue;
      p.entity.loose=true;eventBus.emit(Events.PROP_UNSUPPORTED,{id});eventBus.emit(Events.PROP_RELEASE,{id,position:p.mesh.position});
    }
  }

  _floatBodies(dt){
    const C=WATER;
    for(const body of this.dynamic){
      const p=body.position,sup=this._support(body);
      const previous=this.waterContacts.get(body);this.waterContacts.set(body,0);
      if(p.y>TERRAIN.SEA_LEVEL+sup.y+C.RIPPLE_MAX||p.y<TERRAIN.SEA_LEVEL-C.MAX_DEPTH)continue;
      let water;eventBus.emit(Events.WATER_SAMPLE,{x:p.x,z:p.z,id:body.id,receive:w=>water=w});if(!water)continue;
      const fraction=Math.max(0,Math.min(1,(water.height-p.y+sup.y)/(sup.y*2)));
      // A body's own depression must not re-arm its entry splash. Only a
      // genuine exit above the underlying wave surface releases this contact.
      const held=previous>0&&p.y-sup.y<=water.baseHeight+C.CONTACT_RESET_MARGIN;
      this.waterContacts.set(body,fraction||(held?previous:0));if(!fraction)continue;
      const entering=previous===0||(previous===undefined&&fraction<1&&body.velocity.y<-C.SPLASH_MIN_FALL);
      // Body support follows its rotation, so fallen poles, car panels and
      // ragdoll limbs displace their actual footprint through the same path.
      if(body!==this.playerBody)eventBus.emit(Events.WATER_DISTURB,{id:body.id,x:p.x,z:p.z,radius:sup.r,halfHeight:sup.y,
        fraction,entering,speed:Math.hypot(body.velocity.x,body.velocity.z),verticalSpeed:body.velocity.y,vx:body.velocity.x,vz:body.velocity.z});
      body.wakeUp();
      const volume=body.shapes.reduce((n,shape)=>n+shape.volume(),0);
      const lift=Math.min(body.mass*C.MAX_BUOYANCY,C.DENSITY*volume)*WORLD.GRAVITY*fraction;
      body.force.y+=lift-body.velocity.y*body.mass*C.BUOYANCY_DAMPING*fraction;
      const drag=Math.exp(-C.DRAG*fraction*dt);body.velocity.x*=drag;body.velocity.z*=drag;
      body.angularVelocity.scale(Math.exp(-C.ANGULAR_DRAG*fraction*dt),body.angularVelocity);
    }
  }

  // Compound wall pieces and fallen poles need their rotated full extent.
  // Shape zero alone would leave the rest of the section below the floor.
  _support(body) {
    body.updateAABB();const a=body.aabb,p=body.position;
    const x=Math.max(p.x-a.lowerBound.x,a.upperBound.x-p.x),y=Math.max(p.y-a.lowerBound.y,a.upperBound.y-p.y),z=Math.max(p.z-a.lowerBound.z,a.upperBound.z-p.z);
    return {x,y,z,r:Math.max(x,z)};
  }

  /** Land every dynamic body on the voxel world, and stop it at walls.
   *
   *  This is the whole of JIM-42. The only floor in the game was a plane at
   *  y = 0, so with the island's ground at y ≈ 35–75 every can and every chunk
   *  of rubble fell through the terrain and slept at sea level: cans measured
   *  26–46 m under their own spawn point after four seconds, blast debris still
   *  falling past 9 m two seconds after a swing. Underground it is what made
   *  digging read as "blocks disappearing" — the rubble left through the floor
   *  the instant it appeared.
   *
   *  By grid lookup, not by colliders, for the reason in ADR-0003. */
  _groundBodies() {
    if (!this.voxels) return;
    for (const body of this.dynamic) {
      const p = body.position;
      const sup = this._support(body);
      const sleeping = body.sleepState === CANNON.Body.SLEEPING;

      const hadPrev = body._prevX !== undefined;
      const prevX = body._prevX;
      const prevY = body._prevY;
      const prevZ = body._prevZ;
      const park = () => { body._prevX = p.x; body._prevY = p.y; body._prevZ = p.z; };

      // Far above anything it could land on: it is still falling, and the scan
      // is O(height) — so this both skips pointless work and caps what a body
      // that has somehow got a long way up can cost. Generous on purpose; it is
      // a runaway guard, not a gameplay rule, and it must clear the tallest
      // tower downtown.
      if (p.y - this.voxels.terrainHeightAt(p.x, p.z) > PHYSICS.MAX_LAND_HEIGHT) {
        park();
        continue;
      }

      // --- walls, per axis ---
      // Same shape as JimothyController._clampAxis, minus the auto-step: he
      // climbs kerbs on purpose, and rubble that climbed things would crawl out
      // of the crater it was just blasted into. Per-axis first, because that is
      // what lets a chunk SLIDE along a wall instead of stopping dead on it.
      if (hadPrev) {
        for (const axis of ['x', 'z']) {
          const prev = axis === 'x' ? prevX : prevZ;
          const probe = (s) => this.voxels.solidAtWorld(
            p.x + (axis === 'x' ? s : 0), p.y, p.z + (axis === 'z' ? s : 0),
          );
          if (!probe(sup.r) && !probe(-sup.r)) continue;
          p[axis] = prev;
          body.velocity[axis] *= -PHYSICS.GROUND_RESTITUTION;
        }
      }

      // --- inside solid ---
      //
      // It never gets LIFTED out, and that is the whole point. `groundHeightAt`
      // returns the top of the first solid at or below where you ask — for a
      // buried body that is the top of the voxel it is sitting IN, so lifting it
      // there puts its centre in the next voxel up, which lifts it again. One
      // voxel per step, 33 m/s, forever. Measured while building this: the
      // parked debris pool had ratcheted **13 km** into the sky through bedrock,
      // and since the scan is O(height) each of those 144 bodies was then
      // walking 24,000 voxels per step — 157 ms per clamp, which turned a 5 s
      // test into a three-minute hang. A bounded lift is no better: any rule
      // that raises a buried body a fixed amount and re-tests next step is the
      // same ratchet, slower. (Same shape as the levitation loop in
      // JimothyController, playtest 2026-08-06 — a rule that moves a body toward
      // clear space must be able to REACH it in one move, or it is a ratchet.)
      //
      // So it goes BACK where it came from instead. The per-axis pass above
      // handles a wall taken square on; this catches the diagonal that slips
      // between two axis probes, which was leaving one chunk of every
      // underground blast set into the rock like a fossil.
      if (this.voxels.solidAtWorld(p.x, p.y, p.z)) {
        // Only if that is somewhere to go: a body that SPAWNED inside solid has
        // no clear previous position, and sending it to one it never occupied
        // is how you teleport rubble across a wall.
        if (hadPrev && !this.voxels.solidAtWorld(prevX, prevY, prevZ)) {
          p.set(prevX, prevY, prevZ);
        }
        // Stopped either way. Merely declining to steer it means "this one
        // accelerates through the planet unopposed" — which is how a single can
        // that spawned inside a kerb still reached the waterline 46 m down
        // while every other can rested correctly.
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        park();
        continue;
      }

      // Scanned from wherever it WAS if that is higher — the same swept trick
      // Jimothy's ground scan uses. Reading only the current position lets a
      // fast fall report the floor it has already passed through as being above
      // it, which is indistinguishable from having landed.
      const scanFrom = Math.max(hadPrev ? prevY : p.y, p.y);
      // stepUp 0: a body is not a walker and has no kerb allowance. The default
      // would quietly let rubble rest most of a voxel inside the floor.
      const rest = this.voxels.groundHeightAt(p.x, p.z, scanFrom, 0) + sup.y;

      if (sleeping) {
        // A supported stack may sleep above the voxel floor. Wake only when
        // both terrain and the supporting piece are gone.
        const stack=this.surfaces.height(p.x,p.z,p.y-sup.y+R.STACK_GAP,0,body);
        if(p.y-Math.max(rest,stack+sup.y)>PHYSICS.WAKE_GAP)body.wakeUp();
        continue;
      }

      // --- the ceiling ---
      // A tunnel has one, and the debris burst fires upward by design
      // (`DEBRIS.IMPULSE * 0.9` on y). With only a floor clamp a chunk sails
      // through a 2.9 m sewer roof into the rock above, where the buried rule
      // then freezes it — a piece of gravel embedded in the ceiling, which is
      // what one survivor of every underground blast was doing.
      const head = p.y + sup.y;
      if (body.velocity.y > 0 && this.voxels.solidAtWorld(p.x, head, p.z)) {
        const [, vy] = this.voxels.worldToVoxel(p.x, head, p.z);
        p.y = vy * VOXEL.SIZE - sup.y - 1e-3; // head just under the voxel it hit
        body.velocity.y *= -PHYSICS.GROUND_RESTITUTION;
      }

      // --- the floor ---
      if (p.y < rest) {
        p.y = rest;
        if (body.velocity.y < 0) {
          const bounce = -body.velocity.y * PHYSICS.GROUND_RESTITUTION;
          body.velocity.y = bounce < PHYSICS.SETTLE_SPEED ? 0 : bounce;
        }
        // Friction on CONTACT, not only while descending. A grid clamp has no
        // friction of its own, so this is the only thing bleeding the slide and
        // the spin — and gating it on "moving down" leaves a resting chunk with
        // whatever the solver hands it. The solver is still live down here:
        // debris boxes collide with EACH OTHER, so a pile in a crater pushes
        // itself apart against a position this clamp is pinning. Measured
        // before this: five chunks travelling 0.000 m with 0.7 m/s of velocity,
        // permanently awake because nothing ever damped it.
        body.velocity.x *= PHYSICS.GROUND_FRICTION;
        body.velocity.z *= PHYSICS.GROUND_FRICTION;
        body.angularVelocity.x *= PHYSICS.GROUND_FRICTION;
        body.angularVelocity.y *= PHYSICS.GROUND_FRICTION;
        body.angularVelocity.z *= PHYSICS.GROUND_FRICTION;
      }

      park();
    }
  }
}
