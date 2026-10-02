import * as THREE from 'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{clone}from'three/addons/utils/SkeletonUtils.js';
import{RigidBatches}from'../core/RigidBatches.js';
import{FootGrounding}from'../core/Grounding.js';
import{INTERIORS as C,PEDESTRIANS as PED,COLLECTION,VOXEL,FOOD_MODELS}from'../core/Constants.js';
import{eventBus,Events}from'../core/EventBus.js';
import{gameState}from'../core/GameState.js';
import * as Layout from './Layout.js';
import{planInterior,interiorPoint}from'./InteriorLayout.js';

export class InteriorSystem{
 constructor(scene,jimothy,voxels){
  Object.assign(this,{scene,jimothy,voxels});this.templates=new Map();this.plans=new Map();this.active=new Map();this.items=[];this.residents=[];this.destroyed=new Set();this.saved=new Map();this.eaten=new Set();this.models=[];this.serial=0;this.clock=0;this.ready=false;
  this.batches=new RigidBatches(scene,C.BATCH_CAPACITY,C.BATCH_VERTICES);this.fragmentCache=new Map();
  eventBus.on(Events.HUMAN_MODELS_READY,({models})=>{this.models=models;this.stream();});
  eventBus.on(Events.FOOD_TAKEN,({owner})=>this.eaten.add(owner));
  eventBus.on(Events.WORLD_IMPACT,h=>this.impact(h));
  eventBus.on(Events.ENTITY_ATTACH,({id})=>{
   const item=this.items.find(p=>p.id===id);if(item){item.attached=true;this.destroyed.add(id);eventBus.emit(Events.PROP_SUSPEND,{id});}
   const p=this.residents.find(p=>p.id===id);if(p){p.attached=true;this.animate(p,'Idle');}
  });
  eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{
   const item=this.items.find(p=>p.id===id);if(item){item.attached=false;item.loose=true;item.mesh.position.set(position.x,ground+item.half[1],position.z);eventBus.emit(Events.PROP_RELEASE,{id,position:item.mesh.position});if(!item.fragment)this.save(item);}
   const p=this.residents.find(p=>p.id===id);if(p){p.attached=false;p.displaced=true;p.mesh.position.set(position.x,ground,position.z);p.route=[];p.grounding.reset();p.flee=C.FLEE_TIME;}
  });
  eventBus.on(Events.HUMAN_DOWN,({id,active,position})=>{const p=this.residents.find(p=>p.id===id);if(p){p.ragdoll=active;if(!active){p.mesh.position.copy(position);p.grounding.reset();p.route=[];p.flee=C.FLEE_TIME;}}});
  const loader=new GLTFLoader();this.loading=Promise.all(C.MODELS.map(async name=>{
   const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/models/furniture/${name}.glb`),root=new THREE.Group();gltf.scene.updateMatrixWorld(true);
   gltf.scene.traverse(m=>{if(m.isMesh){const part=new THREE.Mesh(m.geometry.clone().applyMatrix4(m.matrixWorld),m.material);part.castShadow=true;part.receiveShadow=true;root.add(part);}});
   const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3()),half=box.getSize(new THREE.Vector3()).multiplyScalar(.5);
   for(const m of root.children)m.geometry.translate(-center.x,-center.y,-center.z);
   this.templates.set(name,{root,half:half.toArray(),size:Math.max(...half.toArray())*2});
  })).then(()=>{this.ready=true;this.stream();}).catch(e=>console.error('Interior assets failed',e));
 }
 plan(b){const key=`${b.vx}:${b.vz}`;if(!this.plans.has(key)){if(this.plans.size>=C.PLAN_CACHE)this.plans.delete(this.plans.keys().next().value);this.plans.set(key,planInterior(b));}return this.plans.get(key);}
 distance(f,j){const b=f.home,loX=b.vx*VOXEL.SIZE,loZ=b.vz*VOXEL.SIZE;return Math.hypot(Math.max(loX-j.x,j.x-(b.vx+b.vw)*VOXEL.SIZE,0),Math.max(loZ-j.z,j.z-(b.vz+b.vd)*VOXEL.SIZE,0),Math.abs(f.y-j.y));}
 stream(){
  if(!this.ready)return;const j=this.jimothy.position,R=C.RADIUS;
  const plans=Layout.buildingsIntersecting(j.x-R,j.z-R,j.x+R,j.z+R).map(b=>this.plan(b));
  const near=plans.flatMap(plan=>plan.floors.map(floor=>({plan,floor,d:this.distance(floor,j)}))).filter(v=>v.d<R&&Math.abs(v.floor.y-j.y)<C.VERTICAL_RADIUS).sort((a,b)=>a.d-b.d).slice(0,C.MAX_FLOORS),keep=new Set(near.map(v=>v.floor.id));
  for(const [id,a]of this.active)if(!keep.has(id)){
   for(const p of [...this.items])if(p.floor===id&&!p.attached&&!p.fragment&&!p.loose)this.removeItem(p);
   for(const p of [...this.residents])if(p.floor===id&&!p.attached&&!p.ragdoll&&!p.displaced)this.removeResident(p);
   for(let k=0;k<C.MAX_FOOD_PER_FLOOR;k++)eventBus.emit(Events.FOOD_REMOVE,{owner:`${id}:food:${k}`});this.active.delete(id);
  }
  for(const p of [...this.items])if(!p.attached&&!p.fragment&&p.mesh.position.distanceTo(j)>C.RADIUS){if(p.loose)this.save(p);this.removeItem(p);}
  for(const p of [...this.residents])if(!p.attached&&!p.ragdoll&&p.mesh.position.distanceTo(j)>C.RADIUS)this.removeResident(p);
  for(const [id,saved]of this.saved){
   if(this.items.filter(p=>!p.fragment).length>=C.MAX_ITEMS)break;
   if(this.items.some(p=>p.id===id)||new THREE.Vector3().fromArray(saved.position).distanceTo(j)>C.RADIUS)continue;
   const t=this.templates.get(saved.kind),mesh=t.root.clone();mesh.position.fromArray(saved.position);mesh.quaternion.fromArray(saved.quaternion);
   this.install({id,kind:saved.kind,key:saved.kind,floor:saved.floor,worldHalf:saved.worldHalf,mesh,half:t.half,size:t.size,mass:C.MASS,loose:true,attached:false,fragment:false});
  }
  for(const a of near){
   if(!this.active.has(a.floor.id)){this.active.set(a.floor.id,a);this.furnish(a.plan,a.floor);}
   if(this.models.length&&a.d<C.RESIDENT_DISTANCE){
    for(let k=0;k<C.RESIDENTS_PER_FLOOR&&this.residents.length<C.MAX_RESIDENTS;k++)if(!this.residents.some(p=>p.id===`${a.floor.id}:resident:${k}`))this.addResident(a.plan,a.floor,k);
   }
  }
 }
 furnish(plan,floor){
  const s=VOXEL.SIZE,seed=plan.seed+floor.index;
  for(const [ri,room]of floor.rooms.entries()){
   const choices=C.FURNISHINGS[room.purpose];
   for(let slot=0;slot<choices.length;slot++){
    if(this.items.filter(p=>!p.fragment).length>=C.MAX_ITEMS)break;
    const kind=choices[slot][((seed>>>(slot*3))+ri)%choices[slot].length],t=this.templates.get(kind),id=`${room.id}:prop:${slot}`;
    if(this.destroyed.has(id)||this.items.some(p=>p.id===id)||this.saved.has(id))continue;
    const [hx,,hz]=t.half,edge=C.CLEARANCE,rug=kind==='rugRectangle';
    const x=rug?(room.x0+room.x1+1)*s/2:slot===1||slot===3?(room.side?room.x0*s+hx+edge: (room.x1+1)*s-hx-edge):(room.side?(room.x1+1)*s-hx-edge:room.x0*s+hx+edge);
    const z=rug?(room.z0+room.z1+1)*s/2:slot===1||slot===2?(room.z1+1)*s-hz-edge:room.z0*s+hz+edge;
    const yaw=slot===1?Math.PI:0,point=interiorPoint(plan.b,x/s,floor.localY,z/s),node=plan.nodes.find(n=>n.key===room.node);
    // Keep the entire hall-to-activity segment clear, including Jimothy's width.
    const nx=node.local.x*s,nz=node.local.z*s;
    if(x-hx<room.x0*s||x+hx>(room.x1+1)*s||z-hz<room.z0*s||z+hz>(room.z1+1)*s)continue;
    const approachMin=Math.min(nx,plan.w*s/2),approachMax=Math.max(nx,plan.w*s/2);
    if(!rug&&x+hx+C.ROOM_CLEARANCE>approachMin&&x-hx-C.ROOM_CLEARANCE<approachMax&&Math.abs(z-nz)<hz+C.ROOM_CLEARANCE)continue;
    const angle=yaw-(plan.b.front||0)*Math.PI/2,halfXZ=(plan.b.front||0)%2?[hz,hx]:[hx,hz];
    if(!rug&&this.items.some(p=>p.kind!=='rugRectangle'&&p.floor===floor.id&&!p.fragment&&Math.abs(p.mesh.position.x-point.x)<p.worldHalf[0]+halfXZ[0]+C.FURNITURE_GAP&&Math.abs(p.mesh.position.z-point.z)<p.worldHalf[1]+halfXZ[1]+C.FURNITURE_GAP))continue;
    const mesh=t.root.clone();mesh.position.set(point.x,point.y+t.half[1]+C.CLEARANCE,point.z);mesh.rotation.y=angle;
    const item={id,kind,key:kind,mesh,half:t.half,size:t.size,mass:C.MASS,floor:floor.id,worldHalf:halfXZ,loose:false,attached:false,fragment:false};
     this.install(item);
   }
  }
  for(let k=0;k<Math.min(C.MAX_FOOD_PER_FLOOR,floor.rooms.length);k++){
   const room=floor.rooms[k],node=plan.nodes.find(n=>n.key===room.node),owner=`${floor.id}:food:${k}`;
   if(!this.eaten.has(owner))eventBus.emit(Events.FOOD_SPAWN,{foodId:FOOD_MODELS.IDS[(seed+k)%FOOD_MODELS.IDS.length],x:node.x,z:node.z,y:node.y+C.CLEARANCE,owner});
  }
 }
 install(p){this.items.push(p);this.scene.add(p.mesh);eventBus.emit(Events.PROP_CREATE,p);eventBus.emit(Events.ENTITY_REGISTER,{id:p.id,mesh:p.mesh,kind:'furniture',size:p.size});}
 save(p){this.saved.set(p.id,{kind:p.kind,floor:p.floor,worldHalf:p.worldHalf,position:p.mesh.position.toArray(),quaternion:p.mesh.quaternion.toArray()});}
 removeItem(p){eventBus.emit(Events.PROP_REMOVE,{id:p.id});eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});p.mesh.removeFromParent();this.items.splice(this.items.indexOf(p),1);}
 fragments(kind){
  if(this.fragmentCache.has(kind))return this.fragmentCache.get(kind);
  const t=this.templates.get(kind),parts=[];
  for(const mesh of t.root.children){
   const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),a=geo.attributes.position,groups=new Map();
   for(let i=0;i<a.count;i+=3){let x=0,y=0;for(let j=0;j<3;j++){x+=a.getX(i+j);y+=a.getY(i+j);}const key=(x>0?1:0)+(y>0?2:0);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
   for(const [key,triangles]of groups){const g=new THREE.BufferGeometry();for(const [name,attr]of Object.entries(geo.attributes)){const values=[];for(const i of triangles)for(let j=0;j<3;j++)for(let c=0;c<attr.itemSize;c++)values.push(attr.getComponent(i+j,c));g.setAttribute(name,new THREE.Float32BufferAttribute(values,attr.itemSize));}
    parts[key]??=new THREE.Group();const m=new THREE.Mesh(g,mesh.material);m.castShadow=true;m.receiveShadow=true;parts[key].add(m);
   }geo.dispose();
  }
  const result=parts.filter(Boolean).map((root,i)=>{const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3()),half=box.getSize(new THREE.Vector3()).multiplyScalar(.5);for(const m of root.children)m.geometry.translate(-center.x,-center.y,-center.z);return{root,center,half:half.toArray().map(v=>Math.max(C.FRAGMENT_MIN,v)),key:`${kind}:piece:${i}`};});this.fragmentCache.set(kind,result);return result;
 }
 loosen(p,origin){p.loose=true;const direction=p.mesh.position.clone().sub(origin);direction.y=0;if(!direction.lengthSq())direction.x=1;direction.normalize().multiplyScalar(C.IMPULSE);direction.y=C.LIFT;eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity:direction.toArray(),spin:C.SPIN});}
 breakItem(p,origin){
  this.destroyed.add(p.id);this.saved.delete(p.id);p.mesh.updateWorldMatrix(true,true);const matrix=p.mesh.matrixWorld.clone(),rotation=p.mesh.quaternion.clone();this.removeItem(p);
  for(const part of this.fragments(p.kind)){
   while(this.items.filter(q=>q.fragment).length>=C.FRAGMENTS){const old=this.items.find(q=>q.fragment&&!q.attached);if(!old)return;this.removeItem(old);}
   const mesh=part.root.clone();mesh.position.copy(part.center).applyMatrix4(matrix);mesh.quaternion.copy(rotation);
   const q={...p,id:`interior-piece:${this.serial++}`,key:part.key,mesh,half:part.half,size:Math.max(...part.half)*2,fragment:true,life:C.FRAGMENT_LIFE,attached:false,loose:true};this.install(q);this.loosen(q,origin);
  }
 }
 impact(h){const origin=new THREE.Vector3(h.x,h.y,h.z);for(const p of [...this.items])if(!p.attached&&!p.fragment&&p.mesh.position.distanceTo(origin)<h.radius+p.size/2){if(h.radius>=C.BREAK_RADIUS)this.breakItem(p,origin);else this.loosen(p,origin);}
  for(const p of this.residents)if(p.mesh.position.distanceTo(origin)<h.radius+C.SCARE_RADIUS)p.flee=C.FLEE_TIME;
 }
 addResident(plan,floor,index){
  const node=plan.nodes.find(n=>n.key===floor.rooms[index%floor.rooms.length].node),source=this.models[(plan.seed+floor.index+index)%this.models.length],visual=clone(source.scene);visual.position.y-=new THREE.Box3().setFromObject(visual).min.y;
  const mesh=new THREE.Group();mesh.position.set(node.x,node.y,node.z);mesh.add(visual);this.scene.add(mesh);visual.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
  const mixer=new THREE.AnimationMixer(visual),actions={};for(const clip of source.animations)actions[clip.name]=mixer.clipAction(clip);
  const p={id:`${floor.id}:resident:${index}`,floor:floor.id,plan,mesh,visual,mixer,actions,route:[],steps:index,pause:0,flee:0,vy:0,attached:false,ragdoll:false,model:PED.MODELS[(plan.seed+floor.index+index)%this.models.length]};
  p.grounding=new FootGrounding(mesh,visual,(x,z)=>this.ground(x,z,p.mesh.position.y));this.residents.push(p);this.animate(p,'Idle');
  eventBus.emit(Events.HUMAN_REGISTER,{id:p.id,group:mesh,visual});eventBus.emit(Events.ENTITY_REGISTER,{id:p.id,mesh,kind:'person',size:COLLECTION.PERSON_SIZE});
 }
 removeResident(p){eventBus.emit(Events.HUMAN_UNREGISTER,{id:p.id});eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});p.mixer.stopAllAction();p.mixer.uncacheRoot(p.visual);p.visual.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});p.mesh.removeFromParent();this.residents.splice(this.residents.indexOf(p),1);}
 animate(p,name){if(p.animation===name)return;p.actions[p.animation]?.fadeOut(PED.FADE_TIME);p.actions[name]?.reset().fadeIn(PED.FADE_TIME).play();p.animation=name;}
 ground(x,z,y){return this.voxels.groundHeightAt(x,z,y+C.GROUND_SCAN);}
 path(p,goal){
  const nodes=p.plan.nodes,start=[...nodes].sort((a,b)=>p.mesh.position.distanceToSquared(a)-p.mesh.position.distanceToSquared(b))[0],seen=new Map([[start.key,null]]),queue=[start];
  while(queue.length){const n=queue.shift();if(n.key===goal.key)break;for(const k of n.links)if(!seen.has(k)){seen.set(k,n.key);queue.push(nodes.find(n=>n.key===k));}}
  const result=[];let k=goal.key;while(k){result.unshift(nodes.find(n=>n.key===k));k=seen.get(k);}return result;
 }
 walkClear(x,y,z,p){
  for(const [dx,dz]of[[0,0],[C.BODY_RADIUS,0],[-C.BODY_RADIUS,0],[0,C.BODY_RADIUS],[0,-C.BODY_RADIUS]])if(this.voxels.solidAtWorld(x+dx,y+C.BODY_HEIGHT,z+dz)||this.voxels.solidAtWorld(x+dx,y+C.MAX_STEP,z+dz))return false;
  for(const item of this.items){if(item.attached||item.fragment||Math.abs(item.mesh.position.y-y)>item.half[1]+C.BODY_HEIGHT)continue;const v=new THREE.Vector3(x,y+C.BODY_HEIGHT/2,z);item.mesh.worldToLocal(v);if(Math.abs(v.y)<item.half[1]+C.BODY_HEIGHT/2-C.MAX_STEP&&Math.abs(v.x)<item.half[0]+C.BODY_RADIUS&&Math.abs(v.z)<item.half[2]+C.BODY_RADIUS)return false;}
  return !this.residents.some(q=>q!==p&&!q.ragdoll&&!q.attached&&q.mesh.position.distanceTo(new THREE.Vector3(x,y,z))<C.BODY_RADIUS*2);
 }
 update(dt,isVisible=()=>true){
  if(!this.ready||!gameState.game.isPlaying)return;this.clock-=dt;if(this.clock<=0){this.clock=C.REFRESH;this.stream();}
  const j=this.jimothy.position;
  for(const item of [...this.items]){
   if(item.attached)continue;
   if(item.fragment){item.life-=dt;if(item.life<=0)this.removeItem(item);continue;}
   if(!item.loose){
    item.support=(item.support||0)-dt;
    if(item.support<=0){item.support=C.SUPPORT_INTERVAL;const p=item.mesh.position,y=this.ground(p.x,p.z,p.y-item.half[1]);if(y<p.y-item.half[1]-C.MAX_STEP){item.loose=true;eventBus.emit(Events.PROP_RELEASE,{id:item.id,position:p});}}
    if(this.jimothy.speed>C.BONK_SPEED&&item.mesh.position.distanceTo(this.jimothy.body.position)<this.jimothy.radius+item.size/2)this.loosen(item,new THREE.Vector3(j.x,j.y,j.z));
   }
  }
  for(const p of this.residents){
   if(p.attached||p.ragdoll)continue;
   const pos=p.mesh.position,d=pos.distanceTo(j);p.pending=(p.pending||0)+dt;
   if(d>C.NEAR_DISTANCE&&!isVisible(pos)&&p.pending<(gameState.world.graphics?.aiInterval||0))continue;
   const delta=p.pending;p.pending=0;p.flee=Math.max(0,p.flee-delta);p.pause=Math.max(0,p.pause-delta);p.passing=Math.max(0,(p.passing||0)-delta);
   if(d<C.SCARE_RADIUS&&!gameState.player.hidden){let clear=true;for(let k=1;k<4;k++)if(this.voxels.solidAtWorld(pos.x+(j.x-pos.x)*k/4,pos.y+C.BODY_HEIGHT/2,pos.z+(j.z-pos.z)*k/4))clear=false;if(clear){if(!p.flee){eventBus.emit(Events.LOCAL_SCARED,{id:p.id,x:pos.x,z:pos.z});p.route=[];}p.flee=C.FLEE_TIME;}}
   if(!p.route.length&&p.pause<=0){const floor=p.plan.floors.find(f=>f.id===p.floor),rooms=floor.rooms;const goal=p.flee?p.plan.entrance:p.plan.nodes.find(n=>n.key===rooms[(++p.steps)%rooms.length].node);p.route=this.path(p,goal);}
   let moving=false;const target=p.route[0];
   if(target&&p.pause<=0){const dx=target.x-pos.x,dz=target.z-pos.z,dist=Math.hypot(dx,dz);if(dist<C.ARRIVE){p.route.shift();if(!p.route.length)p.pause=p.flee?C.PAUSE/2:C.PAUSE;}
    else{const yaw=Math.atan2(dx,dz),turn=Math.atan2(Math.sin(yaw-p.mesh.rotation.y),Math.cos(yaw-p.mesh.rotation.y));p.mesh.rotation.y+=turn*Math.min(1,delta*PED.TURN_SPEED);
     const step=Math.min(dist,delta*(p.flee?C.FLEE_SPEED:C.SPEED)*Math.max(0,Math.cos(turn))),nx=pos.x+dx/dist*step,nz=pos.z+dz/dist*step,ground=this.ground(nx,nz,pos.y);
     if(ground-pos.y<C.MAX_STEP&&this.walkClear(nx,Math.max(ground,pos.y-C.MAX_STEP),nz,p)){pos.x=nx;pos.z=nz;moving=step>0; }else{
      const neighbour=this.residents.find(q=>q!==p&&!q.ragdoll&&!q.attached&&q.mesh.position.distanceTo(pos)<C.PASS_DISTANCE);
      if(neighbour){
       const side={x:pos.x+dz/dist*C.PASS_STEP,y:pos.y,z:pos.z-dx/dist*C.PASS_STEP};
       if(!p.passing&&Math.abs(this.ground(side.x,side.z,side.y)-side.y)<C.MAX_STEP&&this.walkClear(side.x,side.y,side.z,p)){p.route.unshift(side);p.passing=C.PASS_SECONDS;}
       else p.pause=C.PASS_WAIT;
      }else{p.route=[];p.pause=C.PAUSE/2;}
     }
    }
   }
   const ground=this.ground(pos.x,pos.z,pos.y);if(ground<pos.y-C.CLEARANCE){p.vy+=C.GRAVITY*delta;pos.y=Math.max(ground,pos.y-p.vy*delta);}else{pos.y=ground;p.vy=0;}
   this.animate(p,moving?(p.flee?'Run':'Walk'):'Idle');p.mixer.update(delta*(p.flee?PED.RUN_RATE:PED.WALK_RATE));p.grounding.update(p.actions[p.animation],moving,delta);
  }
 }
 afterUpdate(){this.batches.update(this.items.map(p=>({key:p.key,root:p.mesh})));}
 reset(){this.batches.clear();for(const p of [...this.items])this.removeItem(p);for(const p of [...this.residents])this.removeResident(p);this.active.clear();this.destroyed.clear();this.saved.clear();this.eaten.clear();this.clock=0;this.serial=0;this.stream();}
 snapshot(){return{ready:this.ready,buildings:[...this.active.values()].map(({plan,floor})=>({id:plan.id,type:plan.b.type,floor:floor.index,entry:plan.entrance,rooms:floor.rooms.map(r=>({purpose:r.purpose,node:plan.nodes.find(n=>n.key===r.node)}))})),furniture:this.items.map(p=>({id:p.id,kind:p.kind,x:p.mesh.position.x,y:p.mesh.position.y,z:p.mesh.position.z,fragment:p.fragment,attached:p.attached,loose:p.loose})),residents:this.residents.map(p=>({id:p.id,model:p.model,floor:p.floor,x:p.mesh.position.x,y:p.mesh.position.y,z:p.mesh.position.z,animation:p.animation,flee:p.flee,attached:p.attached,ragdoll:p.ragdoll,feet:p.grounding.contacts})),destroyed:this.destroyed.size};}
}
