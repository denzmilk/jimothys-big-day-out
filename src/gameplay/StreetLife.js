import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { groundVehicle } from '../core/Grounding.js';
import {splitGlassPanes,paneHit,panePoints} from '../core/GlassGeometry.js';
import {buildCarFragments} from '../core/CarFragments.js';
import {STREET as C, VOXEL, CAR_EXPLOSION, DAY_NIGHT, TRAFFIC as T, BODY_CONTACT} from '../core/Constants.js';
import {canPush,pushingMass} from '../core/BodyContact.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';
import * as Layout from '../level/Layout.js';
import {buildTrafficRoutes} from '../level/TrafficRoutes.js';
import {InstanceBatches} from '../core/InstanceBatches.js';
import {TrafficFlow} from '../core/TrafficFlow.js';

const hash=(x,z)=>Math.abs(Math.imul(x,73856093)^Math.imul(z,19349663))>>>0;
const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];

export class StreetLife {
  constructor(scene,jimothy,voxels){
    this.scene=scene;this.jimothy=jimothy;this.voxels=voxels;
    this.items=[];this.saved=new Map();this.destroyed=new Set();this.center=null;this.graph=new Map();this.serial=0;
    this.materials=new Map();this.geometries=new Map();this.templates=new Map();
    this.carFragments=new Map();this.batches=new InstanceBatches(scene,C.BATCH_CAPACITY);this.markingsDirty=false;this.markingTimer=0;
    eventBus.on(Events.WORLD_DEMOLISHED,()=>{this.markingsDirty=true;});
    this.routes=buildTrafficRoutes();this.flow=new TrafficFlow(this.routes,(x,z)=>this.roadClear(x,z));
    // Signal colours are gameplay cues: exposure must not wash green into white.
    this.signalMaterials=T.SIGNAL_COLORS.map(color=>new THREE.MeshBasicMaterial({color,toneMapped:false}));
    this.signalOff=new THREE.MeshStandardMaterial({color:T.SIGNAL_OFF});
    this.markings=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),T.MARK_LIMIT);
    this.markings.count=0;this.markings.frustumCulled=false;scene.add(this.markings);
    this.streetLights=Array.from({length:DAY_NIGHT.STREET_LIGHT_COUNT},()=>{const l=new THREE.PointLight(DAY_NIGHT.STREET_LIGHT_COLOR,0,DAY_NIGHT.STREET_LIGHT_RANGE);scene.add(l);return l;});
    eventBus.on(Events.WORLD_IMPACT,e=>this.impact(e));
    eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.items.find(p=>p.id===id);if(p){this.disableControl(p);this.flow.release(p.id);p.attached=true;p.driving=false;eventBus.emit(Events.PROP_SUSPEND,{id});}});
    eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{const p=this.items.find(p=>p.id===id);if(p){p.attached=false;p.loose=true;p.mesh.position.set(position.x,ground+p.half[1]+C.CLEARANCE,position.z);eventBus.emit(Events.PROP_RELEASE,{id,position:p.mesh.position});}});
    this.vehicles=[];this.ready=false;
    this.loading=Promise.all(C.VEHICLES.map(name=>new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/vehicles/${name}.glb`))).then(models=>{
      this.vehicles=models;this.ready=true;this.populate();
    }).catch(error=>console.error('Vehicle assets failed',error));
    this.populate();
  }
  material(color){if(!this.materials.has(color))this.materials.set(color,new THREE.MeshStandardMaterial({color,roughness:C.ROUGHNESS}));return this.materials.get(color);}
  box(part){const [w,h,d,x,y,z,color,section]=part,key=`${w},${h},${d}`;if(!this.geometries.has(key))this.geometries.set(key,new THREE.BoxGeometry(w,h,d));const mesh=new THREE.Mesh(this.geometries.get(key),this.material(color));mesh.position.set(x,y,z);mesh.userData.section=section;return mesh;}
  template(kind,seed){
    const key=kind==='car'?`car-${seed%this.vehicles.length}`:kind;
    if(!this.templates.has(key)){
      const g=new THREE.Group();
      if(kind==='car'){
        const source=this.vehicles[seed%this.vehicles.length].scene;source.updateMatrixWorld(true);
        source.traverse(o=>{
          if(!o.isMesh)return;
          const glass=Array.isArray(o.material)?o.material.some(m=>m.transmission):o.material.transmission;
          for(const m of glass?splitGlassPanes(o):[o.clone()]){
            m.applyMatrix4(o.parent.matrixWorld);
            m.applyMatrix4(new THREE.Matrix4().makeRotationY(C.CAR.MODEL_YAW));
            m.userData.section=o.name.includes('wheel')?2+g.children.length:0;g.add(m);
          }
        });
      }
      if(kind!=='car')for(const part of C.TYPES[kind].parts){
        if(kind==='tree'&&part[0]>C.LEAF_THRESHOLD){
          const [w,h,d,x,y,z,color,section]=part,s=VOXEL.SIZE;
          for(let ix=0;ix<Math.ceil(w/s);ix++)for(let iy=0;iy<Math.ceil(h/s);iy++)for(let iz=0;iz<Math.ceil(d/s);iz++){
            const dx=(ix+.5)*s-w/2,dy=(iy+.5)*s-h/2,dz=(iz+.5)*s-d/2;
            if((dx/(w/2))**2+(dy/(h/2))**2+(dz/(d/2))**2>1)continue;
            g.add(this.box([s,s,s,x+dx,y+dy,z+dz,color,section]));
          }
        }else {const m=this.box(part);if(kind==='signal'&&part[7]===2)m.userData.signalLens=T.SIGNAL_COLORS.indexOf(part[6]);g.add(m);}
      }
      // Small leaf cells retain the finer silhouette, but share one draw per
      // material/section. A leaf must not cost an entire scene object at runtime.
      if(kind==='tree'){
        const batches=new Map();for(const m of [...g.children]){m.updateMatrix();const key=`${m.material.uuid}:${m.userData.section}`;if(!batches.has(key))batches.set(key,{material:m.material,section:m.userData.section,geometries:[]});batches.get(key).geometries.push(m.geometry.clone().applyMatrix4(m.matrix));g.remove(m);}
        for(const b of batches.values()){const geometry=mergeGeometries(b.geometries);for(const geo of b.geometries)geo.dispose();const mesh=new THREE.Mesh(geometry,b.material);mesh.userData.section=b.section;g.add(mesh);}
      }
      const box=new THREE.Box3().setFromObject(g),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
      for(const m of g.children)m.position.sub(center);
      g.userData={half:size.multiplyScalar(.5).toArray(),size:Math.max(size.x,size.y,size.z)*2,center:center.toArray()};
      g.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
      this.templates.set(key,g);
    }
    return this.templates.get(key).clone();
  }
  roadClear(x,z){return [[0,0],[C.ROAD_CLEARANCE,0],[-C.ROAD_CLEARANCE,0],[0,C.ROAD_CLEARANCE],[0,-C.ROAD_CLEARANCE]].every(([dx,dz])=>Layout.Masterplan.classAt(x+dx,z+dz)===Layout.Masterplan.CLASS.ROAD);}
  clearLand(x,z){return Layout.Masterplan.classAt(x,z)!==Layout.Masterplan.CLASS.WATER&&!this.buildings.some(b=>x>b.x-C.ROAD_CLEARANCE&&x<b.x+b.w+C.ROAD_CLEARANCE&&z>b.z-C.ROAD_CLEARANCE&&z<b.z+b.d+C.ROAD_CLEARANCE);}
  ground(x,z){return this.voxels.groundHeightAt(x,z,this.voxels.terrainHeightAt(x,z)+C.GROUND_SCAN);}
  populate(){
    const j=this.jimothy.body.position,R=C.RADIUS,S=C.GRID;this.center={x:j.x,z:j.z};this.graph.clear();
    this.buildings=Layout.Masterplan.buildingsIn(j.x-R,j.z-R,j.x+R,j.z+R);
    const kerbs=[],roads=[];
    for(let iz=Math.floor((j.z-R)/S);iz<=Math.ceil((j.z+R)/S);iz++)for(let ix=Math.floor((j.x-R)/S);ix<=Math.ceil((j.x+R)/S);ix++){
      const x=ix*S,z=iz*S,d=Math.hypot(x-j.x,z-j.z);if(d>R||d<C.SPAWN_MIN)continue;
      const seed=hash(ix,iz),n={key:`${ix},${iz}`,ix,iz,x,z,links:[],seed};
      if(this.roadClear(x,z)){this.graph.set(n.key,n);roads.push(n);}
      else if(!Layout.roadAtWorld(x,z)&&this.clearLand(x,z)&&dirs.some(([dx,dz])=>Layout.roadAtWorld(x+dx*S,z+dz*S)))kerbs.push(n);
    }
    for(const n of roads)for(const [dx,dz] of dirs){const m=this.graph.get(`${n.ix+dx},${n.iz+dz}`);if(m&&this.roadClear((m.x+n.x)/2,(m.z+n.z)/2)&&Math.abs(this.ground(n.x,n.z)-this.ground(m.x,m.z))<C.MAX_SLOPE)n.links.push(m.key);}
    for(const p of [...this.items])if(!p.attached&&Math.hypot(p.mesh.position.x-j.x,p.mesh.position.z-j.z)>R){if(!p.fragment&&(!p.driving||p.brokenWindows?.length))this.saved.set(p.id,{position:p.mesh.position.toArray(),quaternion:p.mesh.quaternion.toArray(),loose:p.loose,kind:p.kind,seed:p.seed,brokenWindows:p.brokenWindows,junction:p.junction,axis:p.axis});this.remove(p);}
    for(const [id,saved] of this.saved){
      const [x,,z]=saved.position;
      if(!this.items.some(p=>p.id===id)&&Math.hypot(x-j.x,z-j.z)<R){this.spawn(id,saved.kind,{x,z,seed:saved.seed,key:null},false);}
    }
    this.populateControls();
    const types=Object.keys(C.TYPES).filter(k=>k!=='lamp'&&k!=='signal');
    for(const n of kerbs.sort((a,b)=>a.seed-b.seed)){
      if(this.items.filter(p=>p.kind!=='car'&&p.kind!=='lamp'&&p.kind!=='signal'&&!p.fragment&&!p.attached).length>=C.PROP_COUNT)break;
      if(this.items.some(p=>Math.hypot(p.mesh.position.x-n.x,p.mesh.position.z-n.z)<C.PROP_GAP))continue;
      this.spawn(`street-${n.key}`,types[n.seed%types.length],n,false);
    }
    if(!this.ready)return;
    const sites=[];
    for(const road of this.routes.roads)for(let d=T.PARK_START;d<road.length-T.SPAWN_END;d+=T.PARK_SPACING){
      const x=road.start.x+road.dir.x*d,z=road.start.z+road.dir.z*d;
      if(Math.hypot(x-j.x,z-j.z)<R&&Math.hypot(x-j.x,z-j.z)>C.SPAWN_MIN)sites.push({road,d,x,z,seed:hash(Math.round(x),Math.round(z)),key:`${road.id}:${d}`});
    }
    sites.sort((a,b)=>Math.hypot(a.x-j.x,a.z-j.z)-Math.hypot(b.x-j.x,b.z-j.z));
    for(const n of sites){
      if(this.items.filter(p=>p.driving).length>=C.CAR_COUNT)break;
      if(this.items.some(p=>p.kind==='car'&&Math.hypot(p.mesh.position.x-n.x,p.mesh.position.z-n.z)<C.CAR_GAP))continue;
      const p=this.spawn(`traffic-${n.key}`,'car',n,true);if(p)this.assignRoute(p,n.road,n.d);
    }
    for(const n of sites){
      if(n.road.width<T.PARK_MIN_WIDTH)continue;
      if(this.items.filter(p=>p.kind==='car'&&!p.driving&&!p.loose&&!p.attached).length>=C.PARKED_COUNT)break;
      const shift=n.road.width/2-T.PARK_KERB-n.road.lane,x=n.x-n.road.dir.z*shift,z=n.z+n.road.dir.x*shift;
      if(this.items.some(p=>Math.hypot(p.mesh.position.x-x,p.mesh.position.z-z)<(p.kind==='car'?C.CAR_GAP:C.PROP_GAP)))continue;
      const p=this.spawn(`parked-${n.key}`,'car',{...n,x,z},false);if(p&&!this.saved.has(p.id)){p.yaw=Math.atan2(n.road.dir.x,n.road.dir.z);p.mesh.rotation.y=p.yaw;this.poseVehicle(p);}
    }
    this.updateMarkings();
  }
  assignRoute(p,road,d=0){this.flow.assign(p,road,d);this.poseVehicle(p);}
  poseVehicle(p){
    p.mesh.position.y=this.ground(p.mesh.position.x,p.mesh.position.z)+p.half[1]+C.CLEARANCE;
    p.grounding=groundVehicle(p.mesh,p.half,(x,z)=>this.ground(x,z));
    eventBus.emit(Events.PROP_POSE,{id:p.id,position:p.mesh.position,quaternion:p.mesh.quaternion});
  }
  populateControls(){
    const j=this.jimothy.body.position;
    for(const [kind,sites,limit] of [['lamp',this.routes.lamps,T.LAMP_LIMIT],['signal',this.routes.signals,T.SIGNAL_LIMIT]]){
      const nearby=sites.filter(p=>Math.hypot(p.x-j.x,p.z-j.z)<C.RADIUS).sort((a,b)=>Math.hypot(a.x-j.x,a.z-j.z)-Math.hypot(b.x-j.x,b.z-j.z));
      for(const site of nearby){
        if(this.items.filter(p=>p.kind===kind&&!p.fragment&&!p.attached).length>=limit)break;
        const p=this.spawn(site.id,kind,site,false);if(!p)continue;p.junction=site.junction;p.axis=site.axis;
        if(!this.saved.has(site.id)){
          // Templates are centred for physical boxes. Rotate the arm/head
          // around the post's authored origin so its base stays on pavement.
          p.mesh.rotation.y=site.yaw;
          const centre=new THREE.Vector3().fromArray(p.mesh.userData.center);centre.y=0;centre.applyQuaternion(p.mesh.quaternion);
          p.mesh.position.x+=centre.x;p.mesh.position.z+=centre.z;
          eventBus.emit(Events.PROP_POSE,{id:p.id,position:p.mesh.position,quaternion:p.mesh.quaternion});
        }
      }
    }
  }
  disableControl(p){if(p.kind==='signal'&&!p.fragment&&p.junction)this.flow.broken.add(p.junction);}
  updateMarkings(){
    const dummy=new THREE.Object3D(),j=this.jimothy.body.position,color=new THREE.Color();let count=0;
    const mark=(x,z,dir,width,length,tint)=>{
      if(count>=T.MARK_LIMIT||Math.hypot(x-j.x,z-j.z)>C.RADIUS)return;
      const h=this.ground(x,z),expected=Layout.pavingAtWorld(x,z)?.height;
      if(expected===undefined||Math.abs(h-expected)>T.MAX_DROP)return;
      const front=this.ground(x+dir.x*length/2,z+dir.z*length/2),back=this.ground(x-dir.x*length/2,z-dir.z*length/2);
      if(Math.abs(front-(Layout.pavingAtWorld(x+dir.x*length/2,z+dir.z*length/2)?.height??front))>T.MAX_DROP||Math.abs(back-(Layout.pavingAtWorld(x-dir.x*length/2,z-dir.z*length/2)?.height??back))>T.MAX_DROP)return;
      dummy.position.set(x,(front+back)/2+T.MARK_LIFT,z);dummy.rotation.set(-Math.atan2(front-back,length),Math.atan2(dir.x,dir.z),0,'YXZ');dummy.scale.set(width,T.MARK_LIFT,Math.hypot(length,front-back));dummy.updateMatrix();this.markings.setMatrixAt(count,dummy.matrix);this.markings.setColorAt(count++,color.set(tint));
    };
    for(const road of this.routes.roads){
      if(road.to.outgoing.length>=T.SIGNAL_MIN_ROADS)mark(road.end.x-road.dir.x*T.STOP_SETBACK,road.end.z-road.dir.z*T.STOP_SETBACK,road.dir,road.lane*2,T.MARK_WIDTH,T.MARK_COLOR);
      if(road.from.id<road.to.id)for(let d=T.DASH_SPACING/2;d<road.length;d+=T.DASH_SPACING)mark(road.centreStart.x+road.dir.x*d,road.centreStart.z+road.dir.z*d,road.dir,T.DASH_WIDTH,T.DASH_LENGTH,T.DASH_COLOR);
    }
    this.markingsDirty=false;this.markingTimer=0;
    this.markings.count=count;this.markings.instanceMatrix.needsUpdate=true;if(this.markings.instanceColor)this.markings.instanceColor.needsUpdate=true;this.markings.frustumCulled=true;this.markings.computeBoundingSphere();
  }

  spawn(id,kind,node,driving){
    if(this.destroyed.has(id)||this.items.some(p=>p.id===id))return null;
    const saved=this.saved.get(id),mesh=this.template(kind,node.seed),half=mesh.userData.half;
    mesh.position.set(node.x,this.ground(node.x,node.z)+half[1]+C.CLEARANCE,node.z);
    if(saved){mesh.position.fromArray(saved.position);mesh.quaternion.fromArray(saved.quaternion);driving=false;}
    const brokenWindows=[...(saved?.brokenWindows||[])];
    for(const pane of [...mesh.children])if(brokenWindows.includes(pane.userData.glassPane))mesh.remove(pane);
    if(Math.hypot(mesh.position.x-this.center.x,mesh.position.z-this.center.z)>C.RADIUS)return null;
    const p={id,kind,mesh,seed:node.seed,size:mesh.userData.size,half,mass:kind==='car'?C.CAR.MASS:C.TYPES[kind].mass,driving,loose:!!saved?.loose,attached:false,node:node.key,previous:null,target:null,fragment:false,brokenWindows,junction:saved?.junction??node.junction,axis:saved?.axis??node.axis};
    this.install(p);return p;
  }
  install(p){this.items.push(p);this.scene.add(p.mesh);eventBus.emit(Events.PROP_CREATE,p);eventBus.emit(Events.ENTITY_REGISTER,{id:p.id,mesh:p.mesh,kind:p.kind,size:p.size,mass:p.mass});}
  remove(p){this.flow.release(p.id);eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});eventBus.emit(Events.PROP_REMOVE,{id:p.id});p.mesh.removeFromParent();this.items.splice(this.items.indexOf(p),1);}
  update(dt){
    const night=1-(gameState.world.daylight??1),lightCenter=this.jimothy.body.position;
    const bulbs=this.items.filter(p=>p.kind==='lamp'&&!p.fragment&&!p.loose&&!p.attached).map(p=>p.mesh.children.find(m=>m.userData.section===2)).filter(Boolean);
    bulbs.forEach(m=>m.getWorldPosition(m.userData.lightPosition??=new THREE.Vector3()));
    bulbs.sort((a,b)=>a.userData.lightPosition.distanceToSquared(lightCenter)-b.userData.lightPosition.distanceToSquared(lightCenter));
    this.streetLights.forEach((l,i)=>{const bulb=bulbs[i];l.intensity=bulb?night*DAY_NIGHT.STREET_LIGHT_INTENSITY:0;if(bulb)l.position.copy(bulb.userData.lightPosition);});
    const bulbMaterial=this.material(C.TYPES.lamp.parts.at(-1)[6]);
    for(const p of this.items)if(p.kind==='lamp')for(const part of p.mesh.children)if(part.userData.section===2)part.material=!p.fragment&&!p.loose&&!p.attached?bulbMaterial:this.signalOff;bulbMaterial.emissive.set(DAY_NIGHT.STREET_LIGHT_COLOR);bulbMaterial.emissiveIntensity=night*DAY_NIGHT.STREET_GLOW;

    if(!gameState.game.isPlaying){this.updateSignals();return;}
    const j=this.jimothy.body.position;
    if(!this.center||Math.hypot(j.x-this.center.x,j.z-this.center.z)>C.REFRESH||this.items.some(p=>p.driving&&Math.hypot(p.mesh.position.x-j.x,p.mesh.position.z-j.z)>C.RADIUS))this.populate();
    for(const p of [...this.items]){
      if(p.attached)continue;
      if(p.fragment){p.life-=dt;if(p.life<=0){this.remove(p);continue;}}
      const pos=p.mesh.position,dx=pos.x-j.x,dz=pos.z-j.z,d=Math.hypot(dx,dz);
      if(!p.loose&&d<this.jimothy.radius+p.half[0]&&Math.abs(pos.y-j.y)<this.jimothy.radius+p.half[1]&&this.jimothy.speed>C.BONK_SPEED){this.loosen(p,dx,dz);continue;}
    }
    const obstacles=[];eventBus.emit(Events.TRAFFIC_OBSTACLES,{obstacles});
    obstacles.push({id:'jimothy',x:j.x,z:j.z,y:j.y,radius:this.jimothy.radius});
    for(const p of this.items)if(!p.driving&&!p.attached)obstacles.push({id:p.id,x:p.mesh.position.x,z:p.mesh.position.z,y:p.mesh.position.y,width:p.half[0],length:p.half[2]});
    for(const o of obstacles){o.width??=o.radius;o.length??=o.radius;}
    const cars=this.items.filter(p=>p.driving&&!p.attached&&!p.loose);
    this.flow.update(dt,cars,obstacles,(x,z)=>{
      const h=this.ground(x,z),expected=Layout.pavingAtWorld(x,z)?.height;
      return expected===undefined||Math.abs(h-expected)>T.MAX_DROP||this.voxels.solidAtWorld(x,h+C.ROAD_CLEARANCE,z)?NaN:h;
    });
    for(const p of cars)this.poseVehicle(p);
    this.markingTimer+=dt;if(this.markingsDirty&&this.markingTimer>=C.MARK_REFRESH)this.updateMarkings();this.updateSignals();
  }
  afterUpdate(){
    this.batches.update(this.items.filter(p=>!p.fragment).map(p=>({
      key:`${p.kind}:${p.kind==='car'?p.seed%this.vehicles.length:''}:${p.brokenWindows?.join(',')||''}:${p.mesh.children.map(m=>m.material?.uuid).join(',')}`,
      root:p.mesh,visible:p.mesh.visible&&(p.attached||p.mesh.position.distanceTo(this.jimothy.body.position)<(gameState.world.graphics?.detail??Infinity)+this.jimothy.radius),
    })));
  }
  updateSignals(){
    for(const p of this.items)if(p.kind==='signal'){
      const phase=!p.fragment&&!p.loose&&!p.attached?this.flow.signal(this.routes.junctions.get(p.junction),p.axis):'off';
      for(const lens of p.mesh.children)if(lens.userData.signalLens!==undefined)lens.material=['red','amber','green'][lens.userData.signalLens]===phase?this.signalMaterials[lens.userData.signalLens]:this.signalOff;
    }
  }

  loosen(p,dx,dz){
    const car=p.kind==='car'&&!p.fragment,mass=pushingMass(gameState.player.fatness);
    if(car&&!canPush(gameState.player.fatness,p.mass,BODY_CONTACT.CAR_PUSH_RATIO))return;
    this.disableControl(p);this.flow.release(p.id);p.driving=false;p.loose=true;
    const d=Math.hypot(dx,dz)||1,speed=car?Math.min(C.IMPULSE,this.jimothy.speed*mass/(mass+p.mass)):C.IMPULSE;
    eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity:[dx/d*speed,car?BODY_CONTACT.CAR_LIFT:C.LIFT,dz/d*speed],spin:car?BODY_CONTACT.CAR_SPIN:C.SPIN});
  }
  impact({x,y,z,radius}){
    const point=new THREE.Vector3(x,y,z);
    for(const p of [...this.items])if(!p.attached&&!p.fragment&&p.mesh.position.distanceTo(point)<radius+p.size/2){
      const hit=this.shatterWindows(p,point,radius);
      if(radius>=(p.kind==='car'?C.CAR.BREAK_RADIUS:C.BREAK_RADIUS))this.fracture(p,x,z,radius);else if(!hit)this.loosen(p,p.mesh.position.x-x,p.mesh.position.z-z);
    }
  }
  shatterWindows(p,origin,radius=Infinity){
    let hit=false;
    for(const pane of [...p.mesh.children]){
      if(pane.userData.glassPane===undefined||!paneHit(pane,origin,radius))continue;
      eventBus.emit(Events.GLASS_SHATTER,{points:panePoints(pane),origin});
      p.brokenWindows.push(pane.userData.glassPane);p.mesh.remove(pane);hit=true;
    }
    return hit;
  }
  carParts(seed){
    const key=`car-${seed%this.vehicles.length}`;
    if(!this.carFragments.has(key))this.carFragments.set(key,buildCarFragments(this.templates.get(key)));
    return this.carFragments.get(key);
  }
  fracture(p,x,z,radius=C.BREAK_RADIUS){
    this.disableControl(p);
    this.shatterWindows(p,new THREE.Vector3(x,p.mesh.position.y,z));
    p.mesh.updateMatrixWorld(true);const sections=new Map();
    const isCar=p.kind==='car',children=isCar?this.carParts(p.seed):p.mesh.children;
    for(const [i,child] of children.entries()){
      const key=isCar?(child.userData.part==='wheel'?`wheel-${i}`:child.userData.part):child.userData.section||0;
      if(!sections.has(key)){const group=new THREE.Group();group.userData.part=child.userData.part;sections.set(key,group);}
      const part=child.clone();part.visible=true;part.applyMatrix4(p.mesh.matrixWorld);sections.get(key).add(part);
    }
    const origin=p.mesh.position.clone(),power=Math.min(CAR_EXPLOSION.POWER_CAP,Math.max(1,radius/C.CAR.EXPLODE_RADIUS));
    this.destroyed.add(p.id);this.saved.delete(p.id);this.remove(p);
    if(isCar&&radius>=C.CAR.EXPLODE_RADIUS)eventBus.emit(Events.CAR_EXPLODED,{id:p.id,x:origin.x,y:origin.y,z:origin.z,radius});
    for(const mesh of sections.values()){
      // Recycle loose rubble, never something already carried by Jimothy.
      // Destroying another car must still work when the debris budget is full.
      if(this.items.filter(p=>p.fragment).length>=C.FRAGMENT_LIMIT){const oldest=this.items.find(p=>p.fragment&&!p.attached);if(!oldest)break;this.remove(oldest);}
      const box=new THREE.Box3().setFromObject(mesh),center=box.getCenter(new THREE.Vector3()),half=box.getSize(new THREE.Vector3()).multiplyScalar(.5);
      if(isCar)half.max(new THREE.Vector3().setScalar(C.CAR.COLLIDER_MIN));
      for(const part of mesh.children)part.position.sub(center);mesh.position.copy(center);
      const q={id:`fragment-${this.serial++}`,kind:p.kind,mesh,half:half.toArray(),mass:p.mass/sections.size,size:Math.max(...half.toArray())*2,fragment:true,life:C.FRAGMENT_LIFE,loose:true,driving:false,attached:false,sourceId:p.id,part:mesh.userData.part};
      if(isCar){q.collisionFilterGroup=C.CAR.PART_GROUP;q.collisionFilterMask=C.CAR.PART_MASK;}
      this.install(q);
      if(isCar){
        const direction=center.clone().sub(origin);direction.y=0;
        if(direction.lengthSq()===0)direction.set(Math.cos(this.serial),0,Math.sin(this.serial));direction.normalize().multiplyScalar(C.CAR.PART_SPEED*power);
        direction.y=C.CAR.PART_LIFT*power;
        eventBus.emit(Events.PROP_IMPULSE,{id:q.id,velocity:direction.toArray(),spin:C.CAR.PART_SPIN*power*(this.serial%2?1:-1)});
      }else this.loosen(q,center.x-x,center.z-z);
    }
  }
  reset(){this.batches.clear();for(const p of [...this.items])this.remove(p);this.saved.clear();this.destroyed.clear();this.serial=0;this.center=null;this.flow.reset();this.populate();}
  snapshot(){return {junctions:[...this.routes.junctions.values()].filter(j=>Math.hypot(j.x-this.center.x,j.z-this.center.z)<C.RADIUS).map(j=>({id:j.id,x:j.x,z:j.z,phase:[this.flow.signal(j,0),this.flow.signal(j,1)],holder:this.flow.reservations.get(j.id)||null,broken:this.flow.broken.has(j.id)})),ready:this.ready,models:this.vehicles.length,traffic:this.items.filter(p=>p.driving).length,parked:this.items.filter(p=>p.kind==='car'&&!p.driving&&!p.loose).length,fragments:this.items.filter(p=>p.fragment).length,items:this.items.map(p=>({id:p.id,kind:p.kind,x:+p.mesh.position.x.toFixed(2),y:+p.mesh.position.y.toFixed(2),z:+p.mesh.position.z.toFixed(2),model:p.kind==='car'&&!p.fragment?C.VEHICLES[p.seed%this.vehicles.length]:null,driving:p.driving,speed:p.route?.speed||0,waiting:p.route&&p.route.speed<T.STOP_SPEED?p.route.reason:null,road:p.route?.road.id,yaw:p.yaw,loose:p.loose,attached:p.attached,windows:p.mesh.children.filter(m=>m.userData.glassPane!==undefined).length,brokenWindows:p.brokenWindows?.length||0,sourceId:p.sourceId,part:p.part}))};}
}
