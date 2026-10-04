import * as THREE from 'three';
import { RIG, LEGS, MOVES, PLAYER_CONFIG, JIMOTHY_IDLE as IDLE } from '../core/Constants.js';
import { solveTwoBone } from '../core/Grounding.js';
import {fatRoundness} from '../core/MathUtils.js';
import {gameState} from '../core/GameState.js';

// M11: the loaded rig uses planted paws and two-bone IK. The old split-model
// swing and placeholder tubes remain fallbacks; drawing both caused eight legs.
const LEG_NAMES = ['leg_FL', 'leg_FR', 'leg_RL', 'leg_RR'];
const SHIN_NAMES = ['shin_FL', 'shin_FR', 'shin_RL', 'shin_RR'];

export class JimothyLegs {
  constructor(scene, controller) {
    this.scene = scene;
    this.controller = controller;
    this.mode = 'tubes';
    this.realLegs = null;
    this.phase = 0;

    this.tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.tubeGeo.translate(0, -0.5, 0);
    this.mat = new THREE.MeshStandardMaterial({ color: 0x4a4148 });
    this.footGeo = new THREE.SphereGeometry(1, 8, 6);
    this._hipWorld = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._up = new THREE.Vector3(0, -1, 0);

    const defs = [[-1, 1], [1, 1], [-1, -1], [1, -1]]; // FL, FR, RL, RR
    this.legs = defs.map(([sx, sz]) => {
      const hip = new THREE.Object3D();
      controller.bodySlot.add(hip);
      const tube = new THREE.Mesh(this.tubeGeo, this.mat);
      const foot = new THREE.Mesh(this.footGeo, this.mat);
      foot.scale.setScalar(LEGS.FOOT_RADIUS);
      scene.add(tube, foot);
      return { sx, sz, hip, tube, foot, planted: null, step: null };
    });
    this.pairOf = (i) => this.legs[[3, 2, 1, 0][i]];
  }

  /** Switch to grounding the skinned rig's leg BONES and retire the tubes.
   *  Separate from useRealLegs because the skinned model has leg bones, not
   *  leg objects — leaving the tubes up is the "eight legs" bug (2026-07-23). */
  useBones(rig) {
    this.rig = rig;
    this.mode = 'bones';
    for (const leg of this.legs) {
      leg.tube.visible = false;
      leg.foot.visible = false;
    }
    this.controller.group.updateMatrixWorld(true);
    const mesh=rig.skinned,{position,skinIndex,skinWeight}=mesh.geometry.attributes;
    // Loading can finish mid-roll. World-up would then select the side of a
    // paw as its sole and preserve that wrong contact after he lands.
    const modelInverse=this.controller.group.matrixWorld.clone().invert();
    this.paws=LEG_NAMES.map((name,i)=>{
      const hip=rig.bones[name],knee=rig.bones[SHIN_NAMES[i]],boneIndex=mesh.skeleton.bones.indexOf(knee),vertices=[];
      // The exported armature has no ankle bones. A marker fitted to the
      // actual paw sole supplies the missing end joint without re-rigging it.
      for(let v=0;v<position.count;v++){
        let dominant=0;for(let n=1;n<4;n++)if(skinWeight.getComponent(v,n)>skinWeight.getComponent(v,dominant))dominant=n;
        if(skinIndex.getComponent(v,dominant)===boneIndex){
          const p=mesh.getVertexPosition(v,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
          vertices.push({v,p,height:p.clone().applyMatrix4(modelInverse).y});
        }
      }
      const low=Math.min(...vertices.map(v=>v.height)),sole=vertices.filter(v=>v.height<=low+LEGS.PAW_BAND);
      const samples=sole.filter((_,n)=>n%Math.max(1,Math.floor(sole.length/LEGS.PAW_SAMPLES))===0).slice(0,LEGS.PAW_SAMPLES).map(v=>v.v);
      const end=new THREE.Object3D();end.position.copy(knee.worldToLocal(sole.reduce((p,v)=>p.add(v.p),new THREE.Vector3()).divideScalar(sole.length)));
      knee.add(end);knee.updateWorldMatrix(false,true);
      return {hip,knee,end,samples,side:i%2?1:-1,front:i<2?1:-1,pair:i===0||i===3?0:1,target:null,swing:null};
    });
    this.reset();
  }

  /** Switch to the model's real legs and retire the tubes. */
  useRealLegs(legMap) {
    if (!legMap || !Object.keys(legMap).length) return;
    this.realLegs = LEG_NAMES.map((n) => legMap[n]).filter(Boolean);
    if (!this.realLegs.length) return;
    this.mode = 'real';
    // Remember slim hip positions so fatness can splay them outward.
    for (const leg of this.realLegs) leg.home = leg.pivot.position.clone();
    for (const leg of this.legs) {
      leg.tube.visible = false;
      leg.foot.visible = false;
    }
  }

  /** Hips ride outward as he fattens so the legs stay on the body's edge
   *  instead of being swallowed by the belly. `bodyBase` is the pivot the
   *  belly itself scales about — scaling the hips about anything else (the
   *  group origin, i.e. his feet) walks them off the body as he grows. Same
   *  root cause as the head/tail drift; see JimothyController.postUpdate. */
  applyFatness(widthScale, heightScale, bodyBase) {
    if (this.mode !== 'real' || !this.realLegs) return;
    for (const leg of this.realLegs) {
      if (!leg.home) continue;
      leg.pivot.position.set(
        bodyBase.x + (leg.home.x - bodyBase.x) * widthScale,
        bodyBase.y + (leg.home.y - bodyBase.y) * heightScale,
        bodyBase.z + (leg.home.z - bodyBase.z) * widthScale,
      );
    }
  }

  /** World positions of the four hip anchors, for the attachment check in
   *  render_game_to_text — "do the legs still meet the belly?" is otherwise
   *  only answerable by eye (milestone 08). */
  hipAnchors(out = new THREE.Vector3()) {
    const source = this.mode === 'real' && this.realLegs
      ? this.realLegs.map((l) => l.pivot)
      : this.legs.map((l) => l.hip);
    return source.map((o) => o.getWorldPosition(out.clone()));
  }

  reset() {
    this.phase = 0;this.nextPair=null;
    this.previous=null;this.bodyY=null;this.previousRootY=null;this.velocity=new THREE.Vector3();this.contacts=[];
    for(const paw of this.paws||[]){paw.target=null;paw.swing=null;paw.scratch=false;}
    for (const leg of this.legs) {
      leg.planted = null;
      leg.step = null;
    }
  }

  update(delta) {
    if (this.mode === 'bones') this._updateBones(delta);
    else if (this.mode === 'real') this._updateReal(delta);
    else this._updateTubes(delta);
  }

  // JIM-76: preserve the model's natural paw locations and knee bend plane.
  // Ground correction must not turn the original slink into a sideways squat.
  _updateBones(delta) {
    const c=this.controller,rig=this.rig,root=c.group;
    // A changed body shape moves the hips even at zero simulated time. Old
    // support history otherwise drags the new giant mesh back to lean height.
    if(this.previousRadius!==c.radius){this.reset();this.previousRadius=c.radius;}
    root.updateMatrixWorld(true);
    for(const paw of this.paws)paw.supportOffset=Math.max(0,paw.end.getWorldPosition(new THREE.Vector3()).y-this.sole(paw).y);
    for(let i=0;i<4;i++){rig.pose(LEG_NAMES[i]);rig.pose(SHIN_NAMES[i]);}
    rig.root.position.y=rig.baseY;
    if(!c.grounded||c.swimming||c.move?.kind==='roll'){
      this.reset();
      // JIM-69: giant sockets share the gentle head/tail tuck. A full lean
      // curl folds the expanded belly through the upper legs.
      const tuckScale=THREE.MathUtils.lerp(1,RIG.GIANT_TUCK,fatRoundness(gameState.player.fatness));
      LEG_NAMES.forEach((name,i)=>rig.pose(name,MOVES.ROLL.TUCK_LEG*(i<2?1:-1)*(this.tuck||0)*tuckScale));
      return;
    }
    root.updateMatrixWorld(true);
    const pos=new THREE.Vector3(c.body.position.x,0,c.body.position.z);
    if(this.previous&&pos.distanceTo(this.previous)>LEGS.RESET_DISTANCE)this.reset();
    const fresh=!this.previous,velocity=pos.clone().sub(this.previous||pos);
    if(delta>0)velocity.divideScalar(delta);
    this.velocity.lerp(velocity,fresh?1:1-Math.exp(-LEGS.VELOCITY_RESPONSE*delta));this.previous=pos;
    const speed=this.velocity.length(),direction=velocity.clone().normalize(),anatomy=rig.anatomyScale||1,stride=LEGS.STRIDE*anatomy;
    const home=paw=>{
      const h=paw.hip.getWorldPosition(new THREE.Vector3()),k=paw.knee.getWorldPosition(new THREE.Vector3());
      const p=paw.end.getWorldPosition(new THREE.Vector3());
      paw.pole=k.sub(h).projectOnPlane(p.clone().sub(h).normalize()).normalize();
      paw.pole.applyQuaternion(root.quaternion.clone().invert());paw.pole.x*=LEGS.KNEE_SPLAY;
      paw.pole.applyQuaternion(root.quaternion).normalize();
      p.add(new THREE.Vector3(paw.side*LEGS.SPRAWL,0,0).applyQuaternion(root.quaternion));
      p.y=this.ground(p.x,p.z)+LEGS.PAW_CLEARANCE;return p;
    };
    for(const paw of this.paws){paw.home=home(paw);if(!paw.target)paw.target=paw.home.clone();}
    const scratching=c.idleAction==='scratch';
    const scratchPaw=this.paws[1];
    if(!scratching&&scratchPaw.scratch){
      scratchPaw.swing={start:scratchPaw.target.clone(),end:scratchPaw.home.clone(),t:0,duration:LEGS.RECOVER_SECONDS};
    }
    scratchPaw.scratch=scratching;
    const endpoint=(paw,remaining,duration)=>{
      const h=paw.hip.getWorldPosition(new THREE.Vector3()),k=paw.knee.getWorldPosition(new THREE.Vector3()),f=paw.end.getWorldPosition(new THREE.Vector3());
      const reach=(h.distanceTo(k)+k.distanceTo(f))*LEGS.MAX_REACH,offset=paw.home.clone().sub(h);offset.y=0;
      const height=Math.max(0,h.y-LEGS.CROUCH-paw.home.y),along=offset.dot(direction);
      // The exported toes already sit ahead of each hip; use only the
      // remaining reach for foot lead instead of adding half a full stride.
      const available=Math.max(0,Math.sqrt(Math.max(0,along*along+reach*reach-height*height-offset.lengthSq()))-along);
      const lead=Math.min(stride/2,available*LEGS.PAW_REACH_MARGIN);
      const end=paw.home.clone().addScaledVector(velocity,duration-remaining).addScaledVector(direction,lead);
      end.y=this.ground(end.x,end.z)+LEGS.PAW_CLEARANCE;return end;
    };
    const advance=(paw,dt)=>{
      const s=paw.swing;if(!s)return;
      s.t=Math.min(1,s.t+dt/s.duration);
      s.end.y=this.ground(s.end.x,s.end.z)+LEGS.PAW_CLEARANCE;
      const ease=s.t*s.t*(3-2*s.t);paw.target.copy(s.start).lerp(s.end,ease);
      paw.target.y=Math.max(paw.target.y,this.ground(paw.target.x,paw.target.z)+LEGS.PAW_CLEARANCE)+Math.sin(Math.PI*s.t)**2*LEGS.STEP_LIFT;
      if(s.t>=1-LEGS.TIME_EPSILON){paw.target.copy(s.end);paw.swing=null;}
    };
    let remaining=delta;
    // Exactly one diagonal transfers at a time, preserving a support pair.
    const active=this.paws.find(p=>p.swing);
    if(active){
      const time=Math.min(delta,active.swing.duration*(1-active.swing.t));
      for(const paw of this.paws)if(paw.swing){
        if(delta>0&&paw.swing.walking&&paw.swing.t<LEGS.LANDING_LOCK)paw.swing.end.copy(endpoint(paw,delta,paw.swing.duration*(1-paw.swing.t)));
        advance(paw,time);
      }
      remaining-=time;
    }
    const planted=this.paws.filter(p=>!p.swing);
    if(delta>0&&!scratching&&planted.length===this.paws.length){
      const worst=planted.reduce((a,b)=>a.home.distanceTo(a.target)>b.home.distanceTo(b.target)?a:b);
      if((this.nextPair===null&&velocity.length()>LEGS.MIN_SPEED)||worst.home.distanceTo(worst.target)>LEGS.PLANT_TRIGGER*anatomy){
        const duration=THREE.MathUtils.clamp(stride/(2*Math.max(speed,velocity.length(),LEGS.MIN_SPEED)),LEGS.MIN_SWING*Math.sqrt(anatomy),LEGS.MAX_SWING*Math.sqrt(anatomy));
        const pair=velocity.length()>LEGS.MIN_SPEED&&this.nextPair!==null?this.nextPair:worst.pair;this.nextPair=1-pair;
        // Carry the unused part of the frame across a landing. Waiting a whole
        // render frame stretches the support stride on low-refresh displays.
        for(const paw of planted.filter(p=>p.pair===pair)){
          paw.swing={start:paw.target.clone(),end:endpoint(paw,remaining,duration),t:0,duration,walking:true};advance(paw,remaining);
        }
      }
    }
    for(const paw of this.paws){
      paw.transferring=!!paw.swing;
      if(paw.scratch){
        const point=rig.partCentroid('head');
        point.add(new THREE.Vector3(IDLE.SCRATCH_SIDE,-IDLE.SCRATCH_DROP,-IDLE.SCRATCH_BACK).applyQuaternion(root.quaternion));
        point.y+=Math.sin(c.idleTime*IDLE.SCRATCH_HZ*Math.PI*2)*IDLE.SCRATCH_TRAVEL;
        paw.target.copy(paw.home).lerp(point,c.idleBlend);
      }else if(!paw.swing)paw.target.y=this.ground(paw.target.x,paw.target.z)+LEGS.PAW_CLEARANCE;
    }
    let drop=LEGS.CROUCH,maxDrop=Infinity;
    for(const paw of this.paws){
      if(paw.scratch||paw.swing||paw.transferring)continue;
      const h=paw.hip.getWorldPosition(new THREE.Vector3()),k=paw.knee.getWorldPosition(new THREE.Vector3()),f=paw.end.getWorldPosition(new THREE.Vector3());
      const reach=(h.distanceTo(k)+k.distanceTo(f))*LEGS.MAX_REACH,horizontal=Math.hypot(h.x-paw.target.x,h.z-paw.target.z);
      drop=Math.max(drop,h.y-paw.target.y-Math.sqrt(Math.max(0,reach*reach-horizontal*horizontal)));
      // Grown legs also have a minimum reach. Lowering the body onto an
      // uphill paw can fold it past that limit and leave the sole underground.
      const minimum=Math.abs(h.distanceTo(k)-k.distanceTo(f))/LEGS.MAX_REACH+paw.supportOffset;
      if(horizontal<minimum)maxDrop=Math.min(maxDrop,h.y-paw.target.y-Math.sqrt(minimum*minimum-horizontal*horizontal));
    }
    const desired=root.position.y-Math.min(LEGS.MAX_DROP,drop,maxDrop)+c.idleBreath;
    if(fresh)this.bodyY=desired;
    else{
      // Follow a continuous grade without the persistent height lag that
      // overextends the downhill paws. Abrupt kerb changes stay speed-limited.
      const carried=this.bodyY+THREE.MathUtils.clamp(root.position.y-this.previousRootY,-LEGS.BODY_SPEED*delta,LEGS.BODY_SPEED*delta);
      const response=velocity.length()>LEGS.MIN_SPEED?LEGS.BODY_RESPONSE:LEGS.REST_RESPONSE;
      const next=carried+(desired-carried)*(1-Math.exp(-response*delta));
      this.bodyY+=THREE.MathUtils.clamp(next-this.bodyY,-LEGS.BODY_SPEED*delta,LEGS.BODY_SPEED*delta);
    }
    this.previousRootY=root.position.y;
    rig.root.position.y=rig.baseY+this.bodyY-root.position.y;root.updateMatrixWorld(true);
    this.contacts=[];
    for(const paw of this.paws){
      const pole=paw.pole;
      const solveTarget=paw.target.clone();
      // Blended skin weights mean the sole is not owned 100% by the shin.
      // Correct against sampled rendered vertices, not just the bone marker.
      for(let pass=0;pass<LEGS.SOLE_PASSES;pass++){
        solveTwoBone(paw.hip,paw.knee,paw.end,solveTarget,pole,LEGS.MAX_REACH);
        solveTarget.add(paw.target.clone().sub(this.sole(paw)));
      }
      const p=this.sole(paw),ground=this.ground(p.x,p.z);
      this.contacts.push({x:p.x,y:p.y,z:p.z,ground,stance:!paw.swing&&!paw.transferring&&!paw.scratch,error:p.y-ground});
    }
  }

  ground(x,z){
    const c=this.controller;
    return c.voxels?c.voxels.physicalGroundHeightAt(x,z,c.body.position.y-c.radius+LEGS.GROUND_SCAN):0;
  }

  sole(paw){
    const mesh=this.rig.skinned,p=new THREE.Vector3(),centre=new THREE.Vector3();let low=Infinity;
    for(const v of paw.samples){mesh.getVertexPosition(v,p).applyMatrix4(mesh.matrixWorld);centre.add(p);low=Math.min(low,p.y);}
    centre.divideScalar(paw.samples.length);centre.y=low;return centre;
  }

  /** 0 = normal gait, 1 = fully tucked under him for the roll. Blended rather
   *  than switched so the legs gather up and sprawl back out. */
  setTuck(t) {
    this.tuck = t;
  }

  // Diagonal-pair trot: FL+RR swing together, opposed to FR+RL. Stride
  // amplitude and cadence both scale with speed, so a standing Jimothy's legs
  // settle and a scurrying one flails.
  _updateReal(delta) {
    const speedNorm = Math.min(1, this.controller.speed / PLAYER_CONFIG.SPEED);
    this.phase += delta * LEGS.SWING_HZ * (0.4 + speedNorm * 1.6) * Math.PI * 2;
    const amp = LEGS.SWING_MIN + speedNorm * LEGS.SWING_AMPLITUDE;
    const tuck = this.tuck || 0;
    this.realLegs.forEach((leg, i) => {
      const diagonal = (i === 0 || i === 3) ? 1 : -1;
      const swing = Math.sin(this.phase) * amp * diagonal;
      // Front and rear legs fold toward each other, which is what makes the
      // silhouette read as a ball rather than a spinning table.
      const front = i < 2 ? 1 : -1;
      leg.pivot.rotation.x = swing * (1 - tuck) + MOVES.ROLL.TUCK_LEG * front * tuck;
      // A touch of splay so he waddles rather than marching.
      leg.pivot.rotation.z = Math.cos(this.phase) * amp * 0.25 * diagonal * (1 - tuck);
    });
  }

  _updateTubes(delta) {
    const c = this.controller;
    const speedNorm = Math.min(1, c.speed / PLAYER_CONFIG.SPEED);
    const threshold = LEGS.STEP_THRESHOLD * (1 - 0.4 * speedNorm);
    const stepSeconds = LEGS.STEP_SECONDS * (1 - 0.45 * speedNorm);

    this.legs.forEach((leg, i) => {
      leg.hip.position.set(leg.sx * LEGS.HIP_X, LEGS.HIP_Y, leg.sz * LEGS.HIP_Z);
      leg.hip.getWorldPosition(this._hipWorld);
      const home = {
        x: this._hipWorld.x + c.vel.x * LEGS.STRIDE_LEAD,
        z: this._hipWorld.z + c.vel.z * LEGS.STRIDE_LEAD,
      };
      if (!leg.planted) leg.planted = { x: home.x, y: 0, z: home.z };

      if (!leg.step) {
        const drift = Math.hypot(home.x - leg.planted.x, home.z - leg.planted.z);
        if (drift > threshold && !this.pairOf(i).step) {
          leg.step = { fx: leg.planted.x, fz: leg.planted.z, t: 0 };
        }
      }
      if (leg.step) {
        leg.step.t += delta / stepSeconds;
        const t = Math.min(1, leg.step.t);
        leg.planted.x = leg.step.fx + (home.x - leg.step.fx) * t;
        leg.planted.z = leg.step.fz + (home.z - leg.step.fz) * t;
        leg.planted.y = Math.sin(Math.PI * t) * LEGS.STEP_LIFT;
        if (t >= 1) { leg.step = null; leg.planted.y = 0; }
      }

      this._dir.set(
        leg.planted.x - this._hipWorld.x,
        leg.planted.y - this._hipWorld.y,
        leg.planted.z - this._hipWorld.z,
      );
      const len = Math.max(0.05, this._dir.length());
      leg.tube.position.copy(this._hipWorld);
      leg.tube.quaternion.setFromUnitVectors(this._up, this._dir.normalize());
      leg.tube.scale.set(LEGS.TUBE_RADIUS, len, LEGS.TUBE_RADIUS);
      leg.foot.position.set(leg.planted.x, leg.planted.y + LEGS.FOOT_RADIUS * 0.6, leg.planted.z);
    });
  }

  snapshot() {
    // Report sampled skin positions; reporting IK targets alone would conceal
    // a solver that claims contact while the visible paw is above the ground.
    if (this.mode === 'bones') {
      if(this.contacts?.length)return this.contacts.map(p=>({...p}));
      return SHIN_NAMES.map((n) => {
        const p = this.rig.partCentroid(n);
        return { x:p.x,y:p.y,z:p.z,stance:false };
      });
    }
    if (this.mode === 'real') {
      const p = this.controller.group.position;
      return this.realLegs.map(() => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2) }));
    }
    return this.legs.map((l) => ({
      x: +(l.planted?.x ?? 0).toFixed(2),
      z: +(l.planted?.z ?? 0).toFixed(2),
    }));
  }
}
