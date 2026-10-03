import * as CANNON from 'cannon-es';
import { WORLD, PHYSICS, VOXEL, STREET, RAGDOLL, WATER, TERRAIN, BODY_CONTACT, SUPPORT } from '../core/Constants.js';
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
    eventBus.on(Events.WORLD_DEMOLISHED,({bounds})=>{
      if(!bounds)return;for(const [id,p] of this.props){const q=p.body.position,h=p.entity.half;
        if(p.active&&p.body.type===CANNON.Body.KINEMATIC&&q.x+h[0]>=bounds.min[0]&&q.x-h[0]<=bounds.max[0]&&q.z+h[2]>=bounds.min[2]&&q.z-h[2]<=bounds.max[2])this.unsupported.add(id);
      }
    });
    eventBus.on(Events.PROP_CREATE, p => {
      const body = new CANNON.Body({mass:p.mass,type:p.loose?CANNON.Body.DYNAMIC:CANNON.Body.KINEMATIC,
        shape:new CANNON.Box(new CANNON.Vec3(...p.half)),linearDamping:STREET.DAMPING,angularDamping:STREET.DAMPING});
      body.position.copy(p.mesh.position);body.quaternion.copy(p.mesh.quaternion);
      if(p.collisionFilterMask!==undefined)body.collisionFilterMask=p.collisionFilterMask;
      if(p.collisionFilterGroup!==undefined)body.collisionFilterGroup=p.collisionFilterGroup;
      body.sleepSpeedLimit=STREET.SLEEP_SPEED;body.sleepTimeLimit=STREET.SLEEP_TIME;
      this.props.set(p.id,{body,mesh:p.mesh,active:true,entity:p});this.add(body,p.mesh);
    });
    eventBus.on(Events.PROP_REMOVE, ({id}) => {const p=this.props.get(id);if(p){if(p.active)this.remove(p.body,p.mesh);this.props.delete(id);}});
    eventBus.on(Events.PROP_POSE, ({id,position,quaternion}) => {const p=this.props.get(id);if(p?.active){p.body.position.copy(position);p.body.quaternion.copy(quaternion);p.body.aabbNeedsUpdate=true;this.resetSweep(p.body);}});
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


    eventBus.on(Events.PLAYER_BODY_READY,({body})=>{this.playerBody=body;});
    eventBus.on(Events.PLAYER_CONTACT,m=>{
      for(const {body,entity:p,active} of this.props.values()){
        if(!active||p.kind!=='car'||p.fragment||canPush(m.fatness,p.mass,BODY_CONTACT.CAR_PUSH_RATIO))continue;
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
      const body=this.playerBody;if(!body)return;body.type=CANNON.Body.KINEMATIC;body.mass=0;body.updateMassProperties();body.angularVelocity.setZero();body.quaternion.set(0,0,0,1);this.resetSweep(body);
    });

    this.ragdolls=new Map();
    eventBus.on(Events.RAGDOLL_CREATE,({id,parts,velocity,receive})=>{
      const C=RAGDOLL,bodies=parts.map(p=>{
        const b=new CANNON.Body({mass:C.MASS,shape:new CANNON.Box(new CANNON.Vec3(...p.half)),
          linearDamping:C.DAMPING,angularDamping:C.DAMPING,collisionFilterGroup:C.GROUP,collisionFilterMask:C.MASK});
        b.position.copy(p.position);b.quaternion.copy(p.quaternion);b.velocity.set(...velocity);
        b.angularVelocity.set(C.SPIN,0,-C.SPIN);this.add(b);return b;
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
    const d = this.dynamic.indexOf(body);
    if (d !== -1) this.dynamic.splice(d, 1);
    if (mesh) {
      const i = this.pairs.findIndex((p) => p.body === body);
      if (i !== -1) this.pairs.splice(i, 1);
    }
  }

  update(delta) {
    this.checkSupport();
    this.accumulator += delta;
    while (this.accumulator >= this.fixedStep - 1e-9) {
      this._floatBodies(this.fixedStep);
      this.world.step(this.fixedStep);
      // Inside the loop, not once per frame: a chunk at blast speed crosses a
      // 0.55 m voxel in about one step, so clamping per FRAME would let it
      // through the floor on any frame that ran two.
      this._groundBodies();
      this.accumulator -= this.fixedStep;
    }
    for (const { body, mesh } of this.pairs) {
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
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
      body.wakeUp();const s=body.shapes[0],h=s?.halfExtents;
      const volume=h?8*h.x*h.y*h.z:4/3*Math.PI*(s?.radius||sup.r)**3;
      const lift=Math.min(body.mass*C.MAX_BUOYANCY,C.DENSITY*volume)*WORLD.GRAVITY*fraction;
      body.force.y+=lift-body.velocity.y*body.mass*C.BUOYANCY_DAMPING*fraction;
      const drag=Math.exp(-C.DRAG*fraction*dt);body.velocity.x*=drag;body.velocity.z*=drag;
      body.angularVelocity.scale(Math.exp(-C.ANGULAR_DRAG*fraction*dt),body.angularVelocity);
    }
  }

  /** Half-height and half-width of a body, cached on it. Everything dynamic in
   *  this game is a box or a sphere; anything else gets the sphere treatment,
   *  which is wrong but bounded rather than crashing. */
  _support(body) {
    const s=body.shapes[0];
    if(!s?.halfExtents){const r=s?.radius??VOXEL.SIZE/2;return {x:r,y:r,z:r,r};}
    // A knocked pole lies on its side. Keeping its upright half-height made
    // it float several metres above the ground after the physics rotation.
    const h=s.halfExtents,q=body.quaternion;
    const axes=[new CANNON.Vec3(h.x,0,0),new CANNON.Vec3(0,h.y,0),new CANNON.Vec3(0,0,h.z)];
    for(const v of axes)q.vmult(v,v);
    const x=axes.reduce((n,v)=>n+Math.abs(v.x),0),z=axes.reduce((n,v)=>n+Math.abs(v.z),0);
    return {x,z,y:axes.reduce((n,v)=>n+Math.abs(v.y),0),r:Math.max(x,z)};
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
        // Never move a sleeping body — only notice that its floor has gone.
        // Also what keeps the debris pool's parked slots parked: they sleep at
        // y = -1000, where the scan reports a floor just beneath them.
        if (p.y - rest > PHYSICS.WAKE_GAP) body.wakeUp();
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
