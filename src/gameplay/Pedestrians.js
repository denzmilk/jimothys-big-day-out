import * as THREE from 'three';
import {PedestrianActivities} from './PedestrianActivities.js';
import { FootGrounding } from '../core/Grounding.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { DRIVING, PEDESTRIANS as PED, COLLECTION, TRAFFIC, GRAPHICS } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import * as Layout from '../level/Layout.js';

const hash = (x,z) => Math.abs(Math.imul(x,73856093)^Math.imul(z,19349663)) >>> 0;

export class Pedestrians {
  constructor(scene, jimothy, voxels) {
    this.scene=scene;this.jimothy=jimothy;this.voxels=voxels;
    this.people=[];this.models=[];this.ready=false;this.elapsed=0;this.serial=0;this.center=null;
    this.graph=new Map();this.obstacles=new Map();this.activities=new PedestrianActivities(this);
    eventBus.on(Events.DRIVER_REQUEST,({car,receive})=>{
      const p=this.people.toReversed().find(p=>!p.attached&&!p.ragdoll&&!p.vehicleSeat&&!p.wasDriver&&!p.activity);
      if(!p)return;p.vehicleSeat=car.id;p.wasDriver=true;eventBus.emit(Events.ENTITY_ATTACH,{id:p.id});receive(p);
    });
    eventBus.on(Events.DRIVER_REMOVE,({id})=>{const p=this.people.find(p=>p.id===id);if(p){this._remove(p);this.populationPending=true;}});
    eventBus.on(Events.TRAFFIC_OBSTACLES,({obstacles})=>{for(const p of this.people)if(!p.attached)obstacles.push({id:p.id,x:p.mesh.position.x,z:p.mesh.position.z,y:p.mesh.position.y,radius:TRAFFIC.PERSON_RADIUS});});
    const remember=e=>{if(e.kind!=='person'&&e.kind!=='food')this.obstacles.set(e.id,e);};
    eventBus.on(Events.ENTITY_REGISTER,remember);
    eventBus.on(Events.ENTITY_UNREGISTER,({id})=>this.obstacles.delete(id));
    eventBus.emit(Events.ENTITY_LIST,{receive:entities=>{for(const e of entities)remember(e);}});
    eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.people.find(p=>p.id===id);if(p){this.activities.stop(p,'attached');p.attached=true;this._animate(p,'Idle');}});
    eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{const p=this.people.find(p=>p.id===id);if(p){p.attached=false;p.x=position.x;p.z=position.z;p.y=ground;p.mesh.position.set(p.x,p.y,p.z);p.grounding.reset();p.target=null;p.node=null;p.flee=PED.FLEE_SECONDS;}});
    eventBus.on(Events.HUMAN_DOWN,({id,active,position})=>{const p=this.people.find(p=>p.id===id);if(!p)return;if(active)this.activities.stop(p,'impact');p.ragdoll=active;
      if(!active){p.x=position.x;p.z=position.z;p.y=position.y;p.target=null;p.node=null;p.grounding.reset();p.flee=PED.FLEE_SECONDS;}});
    const loader=new GLTFLoader();
    this.loading=Promise.all([Promise.all(PED.MODELS.map(id=>loader.loadAsync(`${import.meta.env.BASE_URL}assets/models/people/${id}.glb`))),this.activities.loading])
      .then(([models])=>{
        // MakeSkin exports opaque clothes as BLEND too. Alpha testing retains
        // hair cutouts without transparent sorting cutting holes through skirts.
        for(const model of models)model.scene.traverse(o=>{
          if(!o.isMesh)return;
          for(const mat of (Array.isArray(o.material)?o.material:[o.material])){
            mat.transparent=false;mat.depthWrite=true;mat.alphaTest=PED.ALPHA_CUTOFF;mat.needsUpdate=true;
          }
        });
        this.models=models;this.ready=true;this.reset();eventBus.emit(Events.HUMAN_MODELS_READY,{models});
      })
      .catch(error=>{this.loadError=String(error);console.error('Pedestrian assets failed',error);});
  }

  _clear(x,z,buildings=this.buildings) {
    const C=Layout.Masterplan.CLASS;
    const cls=Layout.Masterplan.classAt(x,z);
    if(cls===C.WATER) return false;
    if(buildings.some(b=>x>b.x-PED.WALL_MARGIN&&x<b.x+b.w+PED.WALL_MARGIN&&z>b.z-PED.WALL_MARGIN&&z<b.z+b.d+PED.WALL_MARGIN)) return false;
    for(const e of this.obstacles.values())if(!e.attached&&e.mesh.parent===this.scene&&Math.hypot(x-e.mesh.position.x,z-e.mesh.position.z)<Math.min(PED.OBSTACLE_RADIUS_MAX,e.size/2)+PED.OBSTACLE_MARGIN)return false;
    // Terrace banks can rise a storey between two navigation nodes. Reject
    // the whole foot span before IK is asked to reach across that cliff.
    const r=PED.SLOPE_PROBE,h=this.voxels.terrainHeightAt(x,z);
    return [[r,0],[-r,0],[0,r],[0,-r]].every(([dx,dz])=>Math.abs(this.voxels.terrainHeightAt(x+dx,z+dz)-h)<=r*PED.MAX_GRADE);
  }

  _graphAround(x,z) {
    const work=this._graphTask(x,z);let result;do{result=work.next();}while(!result.done);
    this._acceptGraph(result.value);
  }

  *_graphTask(x,z) {
    const R=PED.RADIUS,S=PED.NAV_STEP;
    const graph=new Map(),buildings=Layout.Masterplan.buildingsIn(x-R-S,z-R-S,x+R+S,z+R+S);
    for(let iz=Math.floor((z-R)/S);iz<=Math.ceil((z+R)/S);iz++) for(let ix=Math.floor((x-R)/S);ix<=Math.ceil((x+R)/S);ix++) {
      yield;
      const point=Layout.footpathCentreAtWorld((ix+.5)*S,(iz+.5)*S);if(!point)continue;
      const {x:px,z:pz}=point;
      if(Math.hypot(px-x,pz-z)>R)continue;
      // JIM-86: grid nodes can sit directly on a diagonal kerb. Centre them
      // on the path so a planted foot does not hang over its raised edge.
      if(!Layout.isFootpathAtWorld(px,pz)||!this._clear(px,pz,buildings))continue;
      graph.set(`${ix},${iz}`,{key:`${ix},${iz}`,ix,iz,x:px,z:pz,links:[]});
    }
    for(const n of graph.values()) for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
      yield;const other=graph.get(`${n.ix+dx},${n.iz+dz}`);
      if(other&&Layout.isFootpathAtWorld((n.x+other.x)/2,(n.z+other.z)/2)&&this._clear((n.x+other.x)/2,(n.z+other.z)/2,buildings)) n.links.push(other.key);
    }
    for(const [key,n] of graph)if(!n.links.length)graph.delete(key);
    return {graph,buildings,center:{x,z}};
  }

  _acceptGraph(result){
    Object.assign(this,result);this.graphWork=null;this.populationPending=true;
    const jp=this.jimothy.position;
    for(const p of [...this.people])if(!p.attached&&Math.hypot(p.x-jp.x,p.z-jp.z)>PED.RADIUS)this._remove(p);
  }

  _spawn(node,index) {
    const modelIndex=index%this.models.length, source=this.models[modelIndex];
    const visual=clone(source.scene);
    const box=new THREE.Box3().setFromObject(visual);
    visual.position.y-=box.min.y;
    const mesh=new THREE.Group();mesh.add(visual);this.scene.add(mesh);
    mesh.name=`pedestrian-${this.serial}`;
    visual.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
    const mixer=new THREE.AnimationMixer(visual),actions={};
    for(const clip of source.animations) actions[clip.name]=mixer.clipAction(clip);
    const p={height:box.max.y-box.min.y,id:`ped-${this.serial++}`,x:node.x,z:node.z,y:0,yaw:0,node:node.key,previous:null,target:null,mesh,visual,mixer,actions,animation:null,model:PED.MODELS[modelIndex],flee:0,scaredRecently:false,steps:index,pause:0,attached:false};
    p.grounding=new FootGrounding(mesh,visual,(x,z)=>this.voxels.physicalGroundHeightAt(x,z,p.y+PED.MAX_STEP,0));
    this.activities.init(p);eventBus.emit(Events.HUMAN_REGISTER,{id:p.id,group:mesh,visual});
    this.people.push(p);this._animate(p,'Idle');eventBus.emit(Events.ENTITY_REGISTER,{id:p.id,mesh:p.mesh,kind:'person',size:COLLECTION.PERSON_SIZE});return p;
  }

  _animate(p,name) {
    if(p.animation===name)return;
    p.actions[p.animation]?.fadeOut(PED.FADE_TIME);
    p.actions[name]?.reset().fadeIn(PED.FADE_TIME).play();p.animation=name;
  }

  _remove(p) {
    this.activities.stop(p,'removed');
    eventBus.emit(Events.HUMAN_UNREGISTER,{id:p.id});
    eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});
    p.mixer.stopAllAction();p.mixer.uncacheRoot(p.visual);
    p.mesh.removeFromParent();
    p.visual.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});
    // Geometry/materials belong to the shared GLB cache, not to a clone.
    this.people.splice(this.people.indexOf(p),1);
  }

  _populate(limit=Infinity) {
    const jp=this.jimothy.position;
    let count=this.people.filter(p=>!p.attached||p.vehicleSeat).length,spawned=0;
    if(count>=PED.COUNT){this.populationPending=false;return;}
    const candidates=[...this.graph.values()].filter(n=>Math.hypot(n.x-jp.x,n.z-jp.z)>PED.SPAWN_MIN)
      .sort((a,b)=>hash(a.ix,a.iz)-hash(b.ix,b.iz));
    for(const n of candidates) {
      if(count>=PED.COUNT)break;
      if(spawned>=limit)return;
      if(this.people.some(p=>Math.hypot(p.x-n.x,p.z-n.z)<PED.SPAWN_GAP))continue;
      this._spawn(n,this.people.length);count++;spawned++;
    }
    this.populationPending=false;
  }

  update(frameDelta,isVisible=()=>true) {
    if(!this.ready||!gameState.game.isPlaying)return;
    this.elapsed+=frameDelta;
    const jp=this.jimothy.position;
    if(!this.graphWork&&(!this.center||Math.hypot(jp.x-this.center.x,jp.z-this.center.z)>PED.REFRESH_DISTANCE))this.graphWork=this._graphTask(jp.x,jp.z);
    // JIM-48: keep the usable routes until the replacement is complete. A
    // giant crosses the old refresh distance several times each second.
    for(let i=0;this.graphWork&&i<PED.NAV_WORK;i++){
      const result=this.graphWork.next();if(result.done)this._acceptGraph(result.value);
    }
    if(this.populationPending)this._populate(PED.SPAWN_PER_FRAME);
    this.activities.before(frameDelta);
    for(const p of this.people) {
      if(p.attached||p.ragdoll)continue;
      const dj=Math.hypot(p.x-jp.x,p.z-jp.z),quality=gameState.world.graphics;
      p.pendingDelta=(p.pendingDelta||0)+frameDelta;
      const distant=quality&&dj>Math.max(quality.aiDistance,this.jimothy.radius+GRAPHICS.CONTACT_MARGIN)&&!isVisible(p.mesh.position);
      if(distant&&p.pendingDelta<quality.aiInterval){p.throttled=true;continue;}
      const delta=p.pendingDelta;p.pendingDelta=0;p.throttled=false;this.activities.prepare(p);
      if(dj<PED.SCARE_RADIUS&&!gameState.player.hidden) {
        if(!p.scaredRecently){p.scaredRecently=true;eventBus.emit(Events.LOCAL_SCARED,{id:p.id,x:p.x,z:p.z});}
        p.flee=PED.FLEE_SECONDS;
      } else if(dj>PED.SCARE_RADIUS*2)p.scaredRecently=false;
      p.flee=Math.max(0,p.flee-delta);p.pause=Math.max(0,p.pause-delta);
      if(this.activities.update(p,delta))continue;
      if(!p.target||Math.hypot(p.x-p.target.x,p.z-p.target.z)<PED.ARRIVE_RADIUS) {
        if(p.target){p.previous=p.node;p.node=p.target.key;}
        let node=this.graph.get(p.node);
        if(!node)node=[...this.graph.values()].sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
        if(node) {
          let next=node.links.map(k=>this.graph.get(k)).filter(Boolean);
          if(next.length>1)next=next.filter(n=>n.key!==p.previous);
          if(p.flee>0)next.sort((a,b)=>Math.hypot(b.x-jp.x,b.z-jp.z)-Math.hypot(a.x-jp.x,a.z-jp.z));
          else next.sort((a,b)=>hash(a.ix+p.steps,a.iz)-hash(b.ix+p.steps,b.iz));
          p.target=next[0]||node;p.steps++;
          if(p.flee<=0&&p.steps%PED.PAUSE_EVERY===0)p.pause=PED.PAUSE_SECONDS;
        }
      }
      let moving=false;
      if(p.target&&p.pause<=0) {
        const dx=p.target.x-p.x,dz=p.target.z-p.z,d=Math.hypot(dx,dz);
        p.yaw=Math.atan2(dx,dz);
        // JIM-50: turn toward the new route before walking along it. An
        // instant U-turn otherwise drags a planted foot behind the pelvis.
        // Drivers rejoin pavement through a tight turn beside the car. A short
        // escape jog keeps their planted foot in reach during that handoff.
        const facing=Math.cos(p.yaw-p.mesh.rotation.y),turn=p.wasDriver?Math.max(0,(facing-DRIVING.DRIVER_TURN_COS)/(1-DRIVING.DRIVER_TURN_COS)):Math.max(0,facing);
        // Full flat-ground sprint speed on a steep street outruns the
        // planted support leg. Let the same ground query set the climb pace.
        const probe=PED.SLOPE_PROBE,grade=Math.abs(p.grounding.ground(p.x+dx/(d||1)*probe,p.z+dz/(d||1)*probe)-p.grounding.ground(p.x,p.z))/probe;
        const speed=(p.flee>0?(p.wasDriver?DRIVING.DRIVER_FLEE_SPEED:PED.FLEE_SPEED):PED.SPEED)*turn/(1+grade*PED.GRADE_SPEED_GAIN);
        const step=Math.min(speed*delta,d),nx=p.x+dx/(d||1)*step,nz=p.z+dz/(d||1)*step;
        const surface=this.voxels.terrainHeightAt(nx,nz), ground=this.voxels.physicalGroundHeightAt(nx,nz,p.y+PED.MAX_STEP,0);
        const givesWay=p.flee<=0&&Math.hypot(nx-jp.x,nz-jp.z)<PED.GIVE_WAY_RADIUS;
        if(!givesWay&&this.activities.personClear(p,nx,nz,{performersOnly:true})&&(!Layout.isFootpathAtWorld(p.x,p.z)||Layout.isFootpathAtWorld(nx,nz))&&this._clear(nx,nz)&&Math.abs(ground-p.y)<PED.MAX_STEP&& !this.voxels.physicalSolidAtWorld(nx,ground+PED.BODY_PROBE,nz)) {
          p.x=nx;p.z=nz;p.y=ground;p.yaw=Math.atan2(dx,dz);moving=step>0;
        } else {p.target=null;p.previous=null;p.steps++;}
      }
      const surface=this.voxels.terrainHeightAt(p.x,p.z);
      p.y=this.voxels.physicalGroundHeightAt(p.x,p.z,p.y+PED.MAX_STEP,0);
      p.mesh.position.set(p.x,p.y+PED.FOOT_CLEARANCE,p.z);
      const difference=Math.atan2(Math.sin(p.yaw-p.mesh.rotation.y),Math.cos(p.yaw-p.mesh.rotation.y));
      p.mesh.rotation.y+=difference*Math.min(1,delta*PED.TURN_SPEED);
      this._animate(p,moving?(p.flee>0?'Run':'Walk'):'Idle');
      p.mixer.update(delta*(p.flee>0?PED.RUN_RATE:PED.WALK_RATE));
      p.grounding.update(p.actions[p.animation],moving,delta,p.wasDriver&&p.flee>0?DRIVING.DRIVER_FLEE_STRIDE:1);
    }
  }

  reset() {
    if(!this.ready)return;
    for(const p of [...this.people])this._remove(p);
    this.activities.reset();this.serial=0;this.center=null;this.graphWork=null;
    this._graphAround(this.jimothy.position.x,this.jimothy.position.z);this._populate();
    for(const p of this.people)p.y=this.voxels.terrainHeightAt(p.x,p.z);
    this.update(0);
  }

  get fleeingCount(){return this.people.filter(p=>p.flee>0).length;}
  snapshot(){const j=this.jimothy.position;return {ready:this.ready,models:this.models.length,activities:this.activities.snapshot(),count:this.people.length,nearby:this.people.filter(p=>Math.hypot(p.x-j.x,p.z-j.z)<PED.NEAR_DISTANCE).length,fleeing:this.fleeingCount,items:this.people.map(p=>({id:p.id,model:p.model,x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2),animation:p.animation,activity:p.activity?{kind:p.activity.kind,phase:p.activity.phase,time:+p.activity.time.toFixed(2),partner:p.activity.partner,role:p.activity.role}:null,attached:p.attached,ragdoll:!!p.ragdoll,feet:p.grounding.contacts}))};}
}
