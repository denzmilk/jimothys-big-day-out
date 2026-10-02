import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  TRASH_CAN as TC, SNACKS, FOODS, PLAYER_CONFIG, COLORS, WORLD, CITY, STREAM, VOXEL, COLLECTION, FOOD_MODELS as FOOD,
} from '../core/Constants.js';
import {FoodLibrary} from '../core/FoodLibrary.js';
import {InstanceBatches} from '../core/InstanceBatches.js';
import * as Layout from '../level/Layout.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { DevOverrides } from '../core/DevOverrides.js';

/** Containers scattered along the street grid across the whole district.
 *  Deterministic (no Math.random) so restarts and tests are reproducible. */
export function defaultLayout() {
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
  const out = [];
  const b = WORLD.BOUNDS - 6;
  const block = CITY.BLOCK;
  // Overlapping containers get flung apart by the solver and topple on their
  // own — which spills free food and free heat with no player input. Enforce
  // spacing at placement rather than letting physics sort it out.
  const MIN_GAP = 3.5;
  let attempts = 0;
  while (out.length < TC.COUNT && attempts < TC.COUNT * 30) {
    attempts++;
    // Bins live on kerbs, not in the middle of lawns: pin one axis into the
    // road strip and let the other run along it.
    const gx = Math.round((rnd() * 2 - 1) * b / block) * block;
    const gz = Math.round((rnd() * 2 - 1) * b / block) * block;
    const along = (rnd() * 2 - 1) * block * 0.42;
    const horizontal = rnd() > 0.5;
    const kind = Math.floor(rnd() * TC.KINDS.length);
    const x = Math.max(-b, Math.min(b, horizontal ? gx + along : gx + CITY.ROAD * 0.55));
    const z = Math.max(-b, Math.min(b, horizontal ? gz + CITY.ROAD * 0.55 : gz + along));
    if (Math.hypot(x, z) < 6) continue; // keep spawn clear
    if (out.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < MIN_GAP)) continue;
    out.push([+x.toFixed(1), +z.toFixed(1), kind]);
  }
  return out;
}

// Cans are dynamic boxes (visual stays a cylinder): boxes tumble comically and
// are cheaper/stabler in cannon-es than convex cylinders. Snacks are
// non-physics pickups — distance checks beat rigid bodies for food scattered
// on the ground, and keep the spill ring deterministic for tests.
export class TrashCans {
  constructor(scene, physics, jimothy, voxels = null) {
    this.scene = scene;
    this.physics = physics;
    this.jimothy = jimothy;
    this.voxels = voxels;
    this.elapsed = 0;
    this.entitySerial = 0;
    eventBus.on(Events.ENTITY_ATTACH, ({id}) => {
      const can=this.cans.find(c=>c.collectId===id),snack=this.snacks.find(s=>s.collectId===id);
      if(can){can.attached=true;this.physics.remove(can.body,can.mesh);}
      if(snack)snack.attached=true;
    });
    eventBus.on(Events.ENTITY_RELEASE, ({id,position,ground}) => {
      const can=this.cans.find(c=>c.collectId===id),snack=this.snacks.find(s=>s.collectId===id);
      if(can){can.attached=false;can.body.position.set(position.x,ground+can.kind.height/2,position.z);can.mesh.position.copy(can.body.position);can.body.quaternion.copy(can.mesh.quaternion);can.body.velocity.setZero();can.body.angularVelocity.setZero();this.physics.resetSweep(can.body);this.physics.add(can.body,can.mesh);can.body.wakeUp();}
      if(snack){snack.attached=false;snack.baseY=this._restY(position.x,position.z,ground);snack.mesh.position.set(position.x,snack.baseY,position.z);}
    });
    this._up = new CANNON.Vec3();

    this.foodLibrary=new FoodLibrary();this.foodBatches=new InstanceBatches(scene,FOOD.LIMIT);
    this.ready=false;
    this.loading=this.foodLibrary.loading.then(()=>{
      this.ready=true;for(const s of this.snacks)this._dressFood(s);
    }).catch(error=>console.error('Food assets failed',error));
    this.canGeo = new THREE.CylinderGeometry(TC.RADIUS + 0.02, TC.RADIUS - 0.03, TC.HEIGHT, 12);
    this.canMat = new THREE.MeshStandardMaterial({ color: COLORS.PLACEHOLDER_TRASH_CAN });

    this.cans = [];
    this.snacks = [];
    // Bins already emptied. Without this, walking away until a block unloads
    // and coming back would refill every bin on it — infinite food for the
    // cost of a stroll (JIM-32).
    this.emptied = new Set();
    // A hand-authored layout (DevTools export) pins the world; otherwise cans
    // stream from the seed like everything else.
    this.fixedLayout = DevOverrides.getCanLayout();
    if (this.fixedLayout) for (const [x, z, kind] of this.fixedLayout) this.addCan(x, z, kind);
    // Populate immediately rather than on the first update, so frame zero has
    // a furnished world — the same thing installCity does for voxels.
    else this.streamAround(jimothy.body.position.x, jimothy.body.position.z);

    // DevTools level tools — panel emits, we own the entities.
    eventBus.on(Events.DEV_SPAWN_CAN, () => {
      const jp = this.jimothy.body.position;
      const yaw = this.jimothy.yaw;
      this.addCan(jp.x + Math.sin(yaw) * 2.5, jp.z + Math.cos(yaw) * 2.5, 0);
      this._emitLayout();
    });
    eventBus.on(Events.DEV_REMOVE_CAN, () => {
      this.removeNearest();
      this._emitLayout();
    });
    eventBus.on(Events.DEV_RESET_CANS, () => {
      this.resetCans(TC.POSITIONS); // dev reset = back to shipped defaults
      this._emitLayout(null);
    });
    eventBus.on(Events.DEV_TUNING_CHANGED, ({ group, key }) => {
      if (group === 'TRASH_CAN' && key === 'MASS') {
        for (const can of this.cans) {
          can.body.mass = TC.MASS;
          can.body.updateMassProperties();
        }
      }
    });
  }

  /** Spawn containers near the player and drop the ones far behind him.
   *
   *  Density is per BLOCK, so it no longer dilutes as the map grows, and the
   *  live rigid-body count tracks the streaming radius rather than the world:
   *  holding the old density with a fixed count would have meant ~1120 bodies
   *  at BOUNDS 1000. */
  streamAround(worldX, worldZ) {
    if (this.fixedLayout) return; // authored layouts are absolute, not streamed
    const R = STREAM.LOAD_RADIUS * VOXEL.CHUNK_XZ * VOXEL.SIZE;
    const live = new Set();
    for (const p of Layout.propsIn(worldX - R, worldZ - R, worldX + R, worldZ + R)) {
      live.add(p.id);
      if (this.emptied.has(p.id) || this._byId?.has(p.id)) continue;
      const can = this.addCan(p.x, p.z, p.kind);
      if (!can) continue; // that spot turned out to be inside a building
      can.id = p.id;
      (this._byId ??= new Map()).set(p.id, can);
    }
    // Hysteresis, as with chunks: drop only well outside the load radius, or
    // standing on the boundary thrashes bodies in and out every frame.
    const U = R * (STREAM.UNLOAD_RADIUS / STREAM.LOAD_RADIUS);
    for (const can of [...this.cans]) {
      if (!can.id || can.attached) continue;
      const d = Math.max(
        Math.abs(can.body.position.x - worldX), Math.abs(can.body.position.z - worldZ),
      );
      if (d <= U) continue;
      // A bin that was tipped is spent: remember it rather than restoring it
      // untipped next time he passes.
      if (can.tipped) this.emptied.add(can.id);
      this._byId.delete(can.id);
      this.removeCan(can);
    }
  }

  // kindIndex selects from TRASH_CAN.KINDS — wheelie bins, dumpsters and
  // recycling tubs differ in size, mass and payout, so the street reads as a
  // city rather than a row of identical props.
  addCan(x, z, kindIndex = 0) {
    const kind = TC.KINDS[kindIndex] ?? TC.KINDS[0];
    const geo = this._geoFor(kind);
    const mesh = new THREE.Mesh(geo, this._matFor(kind));
    mesh.castShadow = true;mesh.receiveShadow = true;
    this.scene.add(mesh);
    // On the ground it is actually standing on. `kind.height / 2` alone meant
    // "resting on grade", which is only true on a flat world — on a 45 m hill
    // it spawned the bin 45 m underground, where it stayed (milestone 17).
    //
    // …and the TERRAIN height is not the same as the surface you can stand on:
    // roads, pavements and foundations sit on top of it. A bin whose centre
    // landed inside one of those was embedded in solid from birth, which is
    // survivable only while nothing checks — with the ground clamp (milestone
    // 22) an embedded body is entombed, and one bin per run was spawning that
    // way and freezing inside a kerb. Scan down from clear air above.
    const ground = this.voxels
      ? this.voxels.groundHeightAt(x, z, this.voxels.terrainHeightAt(x, z) + 3)
      : 0;
    // …and if the spot is inside a building anyway, do not put a bin there.
    // `Layout.propsIn` occasionally hands back a position under a footprint,
    // which used to be survivable-ish because the bin simply fell through the
    // world. With the ground clamp (milestone 22) an embedded body is entombed,
    // so it would sit frozen inside a wall forever — measured at one bin per
    // run, 4.5 m up inside a house. No bin is better than a bin in a wall.
    if (this.voxels?.solidAtWorld(x, ground + kind.height / 2 + 0.05, z)) {
      this.scene.remove(mesh);
      return null;
    }
    const body = new CANNON.Body({
      mass: kind.mass,
      shape: new CANNON.Box(new CANNON.Vec3(kind.radius, kind.height / 2, kind.radius)),
      position: new CANNON.Vec3(x, ground + kind.height / 2 + 0.05, z),
      linearDamping: 0.25,
      angularDamping: 0.25,
    });
    body.sleepSpeedLimit = 0.3;
    body.sleepTimeLimit = 0.6;
    this.physics.add(body, mesh);
    mesh.position.copy(body.position);
    const can = { mesh, body, tipped: false, bonkCooldown: 0, kind, attached:false, collectId:`bin-${this.entitySerial++}` };
    eventBus.emit(Events.ENTITY_REGISTER,{id:can.collectId,mesh,kind:'bin',size:Math.max(kind.radius*2,kind.height)});
    this.cans.push(can);
    return can;
  }

  _geoFor(kind) {
    this._geoCache ??= new Map();
    if (!this._geoCache.has(kind.name)) {
      this._geoCache.set(kind.name, kind.name === 'dumpster'
        ? new THREE.BoxGeometry(kind.radius * 2, kind.height, kind.radius * 1.4)
        : new THREE.CylinderGeometry(kind.radius + 0.02, kind.radius - 0.03, kind.height, 12));
    }
    return this._geoCache.get(kind.name);
  }

  _matFor(kind) {
    this._matCache ??= new Map();
    if (!this._matCache.has(kind.name)) {
      this._matCache.set(kind.name, new THREE.MeshStandardMaterial({ color: kind.color }));
    }
    return this._matCache.get(kind.name);
  }

  removeCan(can) {
    eventBus.emit(Events.ENTITY_UNREGISTER,{id:can.collectId});
    this.physics.remove(can.body, can.mesh);
    can.mesh.removeFromParent(); // geometry/material shared — no dispose
    this.cans.splice(this.cans.indexOf(can), 1);
    if (can.id) this._byId?.delete(can.id);
  }

  removeNearest() {
    const jp = this.jimothy.body.position;
    let best = null;
    let bd = Infinity;
    for (const can of this.cans) {
      const d = Math.hypot(can.body.position.x - jp.x, can.body.position.z - jp.z);
      if (d < bd) { bd = d; best = can; }
    }
    if (best) this.removeCan(best);
  }

  // Default layout honours a dev-tools layout override; the dev "reset"
  // button passes TC.POSITIONS explicitly to get back to shipped defaults.
  resetCans(layout = this.fixedLayout) {
    while (this.cans.length) this.removeCan(this.cans[0]);
    this._byId?.clear();
    // A new run gets full bins everywhere — emptied is per-run, like voxel
    // damage.
    this.emptied.clear();
    // Streamed cans are re-spawned by the next streamAround, so an empty
    // layout here is correct rather than a missing step.
    if (layout) for (const [x, z, kind] of layout) this.addCan(x, z, kind);
  }

  clearSnacks() {
    for (const s of this.snacks) {eventBus.emit(Events.ENTITY_UNREGISTER,{id:s.collectId});s.mesh.removeFromParent();}
    this.snacks = [];this.foodBatches.clear();
  }

  reset() {
    this.resetCans();
    this.clearSnacks();
    // A restart must leave the world as complete as a boot does. Without this
    // the city is briefly binless — streaming would refill it a frame later,
    // which is invisible to a player and a race to anything checking state.
    if (!this.fixedLayout) {
      const jp = this.jimothy.body.position;
      this.streamAround(jp.x, jp.z);
    }
  }

  layout() {
    return this.cans.map((c) => [
      +c.body.position.x.toFixed(1),
      +c.body.position.z.toFixed(1),
    ]);
  }

  _emitLayout(layout = this.layout()) {
    eventBus.emit(Events.DEV_CANS_CHANGED, { layout });
  }

  update(delta) {
    if (!gameState.game.isPlaying) return;
    this.elapsed += delta;
    const jp = this.jimothy.body.position;
    const jspeed = this.jimothy.speed;

    for (const can of this.cans) {
      if (can.attached) continue;
      if (can.bonkCooldown > 0) can.bonkCooldown -= delta;
      if (can.tipped) continue;
      const cp = can.body.position;
      const d = Math.hypot(cp.x - jp.x, cp.z - jp.z);
      // Reach and impulse both scale with the container: a dumpster is wider
      // than a kerbside can and needs a real shove to go over, while a fixed
      // impulse would send a light recycling tub into orbit.
      const kr = can.kind?.radius ?? TC.RADIUS;
      const kh = can.kind?.height ?? TC.HEIGHT;
      const massScale = (can.kind?.mass ?? TC.MASS) / TC.MASS;
      if (
        can.bonkCooldown <= 0 &&
        jspeed > PLAYER_CONFIG.BONK_MIN_SPEED &&
        d < kr + PLAYER_CONFIG.RADIUS + 0.35
      ) {
        const nx = (cp.x - jp.x) / (d || 1);
        const nz = (cp.z - jp.z) / (d || 1);
        can.body.wakeUp();
        // Impulse lands above the centre of mass so the can topples instead of sliding.
        const push = TC.BONK_IMPULSE * massScale;
        // The second argument is RELATIVE to the body's centre of mass, not a
        // world position. Passing world coords made the lever arm equal to the
        // distance from the origin — harmless when the block was 20 m wide,
        // but across a 220 m city it flung containers into orbit instead of
        // tipping them. Offset upward so it topples rather than slides.
        can.body.applyImpulse(
          new CANNON.Vec3(nx * push, TC.BONK_LIFT * massScale, nz * push),
          new CANNON.Vec3(0, kh * 0.4, 0),
        );
        can.bonkCooldown = TC.BONK_COOLDOWN_SECONDS;
      }
      can.body.quaternion.vmult(CANNON.Vec3.UNIT_Y, this._up);
      if (this._up.y < TC.TIP_UP_DOT) {
        can.tipped = true;
        this.spillFrom(can);
        eventBus.emit(Events.CAN_TIPPED, { x: cp.x, z: cp.z });
      }
    }

    for (let i = this.snacks.length - 1; i >= 0; i--) {
      const s = this.snacks[i];
      if(s.attached||(this.jimothy.move?.kind==='roll'&&this.jimothy.radius>=COLLECTION.MIN_RADIUS))continue;
      s.supportTimer=(s.supportTimer||0)-delta;
      if(s.supportTimer<=0){s.supportTimer=FOOD.SUPPORT_INTERVAL;s.baseY=this._restY(s.mesh.position.x,s.mesh.position.z,s.baseY);}
      s.mesh.position.y = s.baseY + Math.sin(this.elapsed * SNACKS.BOB_HZ + s.phase) * FOOD.BOB_HEIGHT;
      const d = Math.hypot(s.mesh.position.x - jp.x, s.mesh.position.z - jp.z);
      const reachable=Math.abs(s.baseY-(jp.y-this.jimothy.radius))<FOOD.REACH_HEIGHT;
      if (s.type === 'feast') {
        // Feasts are a commitment: stand within reach, nearly still, and chomp
        // through the channel. Wander off (or get stunned into a stagger) and
        // the progress is gone.
        const eating =
          reachable && d < FOODS.FEAST.REACH &&
          this.jimothy.speed < FOODS.FEAST.EAT_MAX_SPEED &&
          !gameState.player.stunned;
        if (eating) {
          if (s.progress === 0) eventBus.emit(Events.PLAYER_EATING, {});
          s.progress += delta;
          s.mesh.rotation.y += delta * FOOD.SPIN_RATE;
          if (s.progress >= FOODS.FEAST.CHANNEL_SECONDS) {
            eventBus.emit(Events.ENTITY_UNREGISTER,{id:s.collectId});
            this.scene.remove(s.mesh);
            this.snacks.splice(i, 1);
            const name = s.name;
            eventBus.emit(Events.PLAYER_PICKUP, {
              name, points: FOODS.FEAST.POINTS, fat: FOODS.FEAST.FAT,
            });
          }
        } else if (s.progress > 0) {
          s.progress = 0;
        }
      } else if (reachable && d < PLAYER_CONFIG.PICKUP_RADIUS) {
        // Geometry/material are shared across all snacks — remove, don't dispose.
        eventBus.emit(Events.ENTITY_UNREGISTER,{id:s.collectId});
        this.scene.remove(s.mesh);
        this.snacks.splice(i, 1);
        const name = s.name;
        eventBus.emit(Events.PLAYER_PICKUP, {
          name, points: FOODS.SCRAP.POINTS, fat: FOODS.SCRAP.FAT,
        });
      }
    }
  }

  _restY(x,z,from=null) {
    const surface=this.voxels?.terrainHeightAt(x,z)||0;
    return (this.voxels?this.voxels.groundHeightAt(x,z,(from??surface)+FOOD.SUPPORT_SCAN):surface)+FOOD.CLEARANCE;
  }

  _dressFood(s){
    const model=this.foodLibrary.clone(s.foodId);if(model)s.mesh.add(model);
  }

  _addSnack(s) {
    s.collectId=`food-${this.entitySerial++}`;s.attached=false;this.snacks.push(s);
    eventBus.emit(Events.ENTITY_REGISTER,{id:s.collectId,mesh:s.mesh,kind:'food',size:COLLECTION.FOOD_SIZE});
  }

  spawnFood(foodId,x,z,y=null,owner=null){
    const food=this.foodLibrary.get(foodId);if(!food)return null;
    if(this.snacks.length>=FOOD.LIMIT){
      const old=this.snacks.find(s=>!s.attached);if(!old)return null;
      this.removeSnack(old);
    }
    const mesh=new THREE.Group(),baseY=y??this._restY(x,z);
    mesh.position.set(x,baseY,z);mesh.rotation.y=this.entitySerial;this.scene.add(mesh);
    const s={mesh,foodId,name:food.name,type:food.type,phase:this.entitySerial,progress:0,baseY,owner};
    this._dressFood(s);this._addSnack(s);return s;
  }

  removeSnack(s){eventBus.emit(Events.ENTITY_UNREGISTER,{id:s.collectId});s.mesh.removeFromParent();this.snacks.splice(this.snacks.indexOf(s),1);}
  syncVisuals(){this.foodBatches.update(this.snacks.map(s=>({key:s.foodId,root:s.mesh})));}

  spillFrom(can) {
    const cp=can.body.position,scraps=can.kind?.scraps??SNACKS.SCRAPS_PER_CAN,feasts=can.kind?.feasts??SNACKS.FEASTS_PER_CAN;
    const seed=Math.abs(Math.imul(Math.round(cp.x),73856093)^Math.imul(Math.round(cp.z),19349663));
    const catalog=this.foodLibrary.catalog;
    for(let k=0;k<scraps;k++){
      const a=k/scraps*Math.PI*2,x=cp.x+Math.cos(a)*SNACKS.SCATTER_RADIUS,z=cp.z+Math.sin(a)*SNACKS.SCATTER_RADIUS;
      this.spawnFood(catalog[(seed+k)%SNACKS.NAMES.length].id,x,z);
    }
    for(let k=0;k<feasts;k++)this.spawnFood(catalog[SNACKS.NAMES.length+(seed+k)%FOODS.FEAST.NAMES.length].id,cp.x+SNACKS.FEAST_OFFSET[0]*(k+1),cp.z+SNACKS.FEAST_OFFSET[1]*(k+1));
  }
}
