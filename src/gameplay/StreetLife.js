import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { groundVehicle } from '../core/Grounding.js';
import {splitGlassPanes,paneHit,panePoints} from '../core/GlassGeometry.js';
import {buildCarFragments} from '../core/CarFragments.js';
import {STREET as C, VOXEL, CAR_EXPLOSION} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';
import * as Layout from '../level/Layout.js';

const hash=(x,z)=>Math.abs(Math.imul(x,73856093)^Math.imul(z,19349663))>>>0;
const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];

export class StreetLife {
  constructor(scene,jimothy,voxels){
    this.scene=scene;this.jimothy=jimothy;this.voxels=voxels;
    this.items=[];this.saved=new Map();this.destroyed=new Set();this.center=null;this.graph=new Map();this.serial=0;
    this.materials=new Map();this.geometries=new Map();this.templates=new Map();
    this.carFragments=new Map();
    eventBus.on(Events.WORLD_IMPACT,e=>this.impact(e));
    eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.items.find(p=>p.id===id);if(p){p.attached=true;p.driving=false;eventBus.emit(Events.PROP_SUSPEND,{id});}});
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
            m.applyMatrix4(o.parent.matrixWorld);m.userData.section=o.name.includes('wheel')?2+g.children.length:0;g.add(m);
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
        }else g.add(this.box(part));
      }
      // Small leaf cells retain the finer silhouette, but share one draw per
      // material/section. A leaf must not cost an entire scene object at runtime.
      if(kind==='tree'){
        const batches=new Map();for(const m of [...g.children]){m.updateMatrix();const key=`${m.material.uuid}:${m.userData.section}`;if(!batches.has(key))batches.set(key,{material:m.material,section:m.userData.section,geometries:[]});batches.get(key).geometries.push(m.geometry.clone().applyMatrix4(m.matrix));g.remove(m);}
        for(const b of batches.values()){const geometry=mergeGeometries(b.geometries);for(const geo of b.geometries)geo.dispose();const mesh=new THREE.Mesh(geometry,b.material);mesh.userData.section=b.section;g.add(mesh);}
      }
      const box=new THREE.Box3().setFromObject(g),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
      for(const m of g.children)m.position.sub(center);
      g.userData={half:size.multiplyScalar(.5).toArray(),size:Math.max(size.x,size.y,size.z)*2};
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
    for(const p of [...this.items])if(!p.attached&&Math.hypot(p.mesh.position.x-j.x,p.mesh.position.z-j.z)>R){if(!p.fragment)this.saved.set(p.id,{position:p.mesh.position.toArray(),quaternion:p.mesh.quaternion.toArray(),loose:p.loose,kind:p.kind,seed:p.seed,brokenWindows:p.brokenWindows});this.remove(p);}
    for(const [id,saved] of this.saved){
      const [x,,z]=saved.position;
      if(!this.items.some(p=>p.id===id)&&Math.hypot(x-j.x,z-j.z)<R){this.spawn(id,saved.kind,{x,z,seed:saved.seed,key:null},false);}
    }
    const types=Object.keys(C.TYPES);
    for(const n of kerbs.sort((a,b)=>a.seed-b.seed)){
      if(this.items.filter(p=>p.kind!=='car'&&!p.fragment&&!p.attached).length>=C.PROP_COUNT)break;
      if(this.items.some(p=>Math.hypot(p.mesh.position.x-n.x,p.mesh.position.z-n.z)<C.PROP_GAP))continue;
      this.spawn(`street-${n.key}`,types[n.seed%types.length],n,false);
    }
    let parked=this.items.filter(p=>p.kind==='car'&&!p.driving&&!p.attached).length,driving=this.items.filter(p=>p.driving).length;
    if(!this.ready)return;
    for(const n of roads.sort((a,b)=>Math.hypot(a.x-j.x,a.z-j.z)-Math.hypot(b.x-j.x,b.z-j.z)||a.seed-b.seed)){
      if(parked>=C.PARKED_COUNT&&driving>=C.CAR_COUNT)break;
      if(n.links.length<2||this.items.some(p=>Math.hypot(p.mesh.position.x-n.x,p.mesh.position.z-n.z)<(p.kind==='car'?C.CAR_GAP:C.ROAD_CLEARANCE+Math.max(p.half[0],p.half[2]))))continue;
      const drive=driving<C.CAR_COUNT;
      const edge=dirs.filter(([dx,dz])=>!Layout.roadAtWorld(n.x+dx*C.GRID,n.z+dz*C.GRID)).sort((a,b)=>(Math.abs(a[0])+Math.abs(a[1]))-(Math.abs(b[0])+Math.abs(b[1])))[0];
      if(!drive&&!edge)continue;
      const p=this.spawn(`car-${n.key}`,'car',n,drive);if(!p)continue;
      if(drive)driving++;else parked++;
      if(!drive&&edge)p.mesh.rotation.y=Math.atan2(-edge[1],edge[0]);
      const next=this.choose(p,n);if(next){p.target=next;p.yaw=Math.atan2(next.x-n.x,next.z-n.z);p.mesh.rotation.y=p.yaw;p.grounding=groundVehicle(p.mesh,p.half,(x,z)=>this.ground(x,z));eventBus.emit(Events.PROP_POSE,{id:p.id,position:p.mesh.position,quaternion:p.mesh.quaternion});}
    }
  }
  spawn(id,kind,node,driving){
    if(this.destroyed.has(id)||this.items.some(p=>p.id===id))return null;
    const saved=this.saved.get(id),mesh=this.template(kind,node.seed),half=mesh.userData.half;
    mesh.position.set(node.x,this.ground(node.x,node.z)+half[1]+C.CLEARANCE,node.z);
    if(saved){mesh.position.fromArray(saved.position);mesh.quaternion.fromArray(saved.quaternion);driving=false;}
    const brokenWindows=[...(saved?.brokenWindows||[])];
    for(const pane of [...mesh.children])if(brokenWindows.includes(pane.userData.glassPane))mesh.remove(pane);
    if(Math.hypot(mesh.position.x-this.center.x,mesh.position.z-this.center.z)>C.RADIUS)return null;
    const p={id,kind,mesh,seed:node.seed,size:mesh.userData.size,half,mass:kind==='car'?C.CAR.MASS:C.TYPES[kind].mass,driving,loose:!!saved?.loose,attached:false,node:node.key,previous:null,target:null,fragment:false,brokenWindows};
    this.install(p);return p;
  }
  install(p){this.items.push(p);this.scene.add(p.mesh);eventBus.emit(Events.PROP_CREATE,p);eventBus.emit(Events.ENTITY_REGISTER,{id:p.id,mesh:p.mesh,kind:p.kind,size:p.size});}
  remove(p){eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});eventBus.emit(Events.PROP_REMOVE,{id:p.id});p.mesh.removeFromParent();this.items.splice(this.items.indexOf(p),1);}
  choose(p,n){
    const heading=new THREE.Vector3(0,0,1).applyQuaternion(p.mesh.quaternion),candidates=n.links.map(k=>this.graph.get(k)).filter(Boolean);
    const onward=candidates.filter(m=>m.key!==p.previous),options=onward.length?onward:candidates;
    options.sort((a,b)=>{
      const score=m=>{const dx=m.x-n.x,dz=m.z-n.z,l=Math.hypot(dx,dz);return (dx*heading.x+dz*heading.z)/l;};return score(b)-score(a);
    });return options[0];
  }
  update(dt){
    if(!gameState.game.isPlaying)return;
    const j=this.jimothy.body.position;
    if(!this.center||Math.hypot(j.x-this.center.x,j.z-this.center.z)>C.REFRESH)this.populate();
    for(const p of [...this.items]){
      if(p.attached)continue;
      if(p.fragment){p.life-=dt;if(p.life<=0){this.remove(p);continue;}}
      const pos=p.mesh.position,dx=pos.x-j.x,dz=pos.z-j.z,d=Math.hypot(dx,dz);
      if(!p.loose&&d<this.jimothy.radius+p.half[0]&&Math.abs(pos.y-j.y)<this.jimothy.radius+p.half[1]&&this.jimothy.speed>C.BONK_SPEED){this.loosen(p,dx,dz);continue;}
      if(!p.driving)continue;
      const n=this.graph.get(p.node);if(!n){p.driving=false;continue;}
      if(!p.target||Math.hypot(pos.x-p.target.x,pos.z-p.target.z)<C.ARRIVE){if(p.target){p.previous=p.node;p.node=p.target.key;}p.target=this.choose(p,this.graph.get(p.node)||n);}
      if(!p.target)continue;
      const tx=p.target.x-pos.x,tz=p.target.z-pos.z,dist=Math.hypot(tx,tz),ux=tx/(dist||1),uz=tz/(dist||1);
      const stopped=(d<this.jimothy.radius+C.STOP_GAP&&(j.x-pos.x)*ux+(j.z-pos.z)*uz>0)||this.items.some(q=>q!==p&&!q.attached&&q.kind==='car'&&Math.hypot(q.mesh.position.x-pos.x,q.mesh.position.z-pos.z)<C.STOP_GAP&&(q.mesh.position.x-pos.x)*ux+(q.mesh.position.z-pos.z)*uz>0);
      if(stopped)continue;
      const step=Math.min(C.SPEED*dt,dist),nx=pos.x+ux*step,nz=pos.z+uz*step;
      if(!this.roadClear(nx,nz)||this.voxels.solidAtWorld(nx,this.ground(nx,nz)+p.half[1],nz)){p.previous=p.target.key;p.target=null;continue;}
      pos.set(nx,this.ground(nx,nz)+p.half[1]+C.CLEARANCE,nz);
      const yaw=Math.atan2(tx,tz),delta=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw));p.yaw+=delta*Math.min(1,dt*C.TURN_RATE);p.mesh.rotation.set(0,p.yaw,0);p.grounding=groundVehicle(p.mesh,p.half,(x,z)=>this.ground(x,z));
      eventBus.emit(Events.PROP_POSE,{id:p.id,position:pos,quaternion:p.mesh.quaternion});
    }
  }
  loosen(p,dx,dz){p.driving=false;p.loose=true;const d=Math.hypot(dx,dz)||1;eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity:[dx/d*C.IMPULSE,C.LIFT,dz/d*C.IMPULSE],spin:C.SPIN});}
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
    this.shatterWindows(p,new THREE.Vector3(x,p.mesh.position.y,z));
    p.mesh.updateMatrixWorld(true);const sections=new Map();
    const isCar=p.kind==='car',children=isCar?this.carParts(p.seed):p.mesh.children;
    for(const [i,child] of children.entries()){
      const key=isCar?(child.userData.part==='wheel'?`wheel-${i}`:child.userData.part):child.userData.section||0;
      if(!sections.has(key)){const group=new THREE.Group();group.userData.part=child.userData.part;sections.set(key,group);}
      const part=child.clone();part.applyMatrix4(p.mesh.matrixWorld);sections.get(key).add(part);
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
  reset(){for(const p of [...this.items])this.remove(p);this.saved.clear();this.destroyed.clear();this.serial=0;this.center=null;this.populate();}
  snapshot(){return {ready:this.ready,models:this.vehicles.length,traffic:this.items.filter(p=>p.driving).length,parked:this.items.filter(p=>p.kind==='car'&&!p.driving&&!p.loose).length,fragments:this.items.filter(p=>p.fragment).length,items:this.items.map(p=>({id:p.id,kind:p.kind,x:+p.mesh.position.x.toFixed(2),y:+p.mesh.position.y.toFixed(2),z:+p.mesh.position.z.toFixed(2),model:p.kind==='car'&&!p.fragment?C.VEHICLES[p.seed%this.vehicles.length]:null,driving:p.driving,loose:p.loose,attached:p.attached,windows:p.mesh.children.filter(m=>m.userData.glassPane!==undefined).length,brokenWindows:p.brokenWindows?.length||0,sourceId:p.sourceId,part:p.part}))};}
}
