import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {LANDMARKS as C,VOXEL} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';
import * as Layout from './Layout.js';
import islandPlan from './islandPlan.js';

export class Landmarks {
 constructor(scene,jimothy,voxels,coverage){
  Object.assign(this,{scene,jimothy,voxels,coverage});this.sites=Layout.Masterplan.landmarks();this.models=new Map();this.details=[];this.active=new Set();this.eaten=new Set();this.saved=new Map();this.damaged=new Set();this.time=0;this.target=null;this.ready=false;
  this.detailGeometry=this.furniture();this.detailMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:C.MATERIAL_ROUGHNESS});
  eventBus.on(Events.FOOD_TAKEN,({owner})=>{if(owner?.startsWith('landmark:'))this.eaten.add(owner);});
  eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.details.find(p=>p.id===id);if(p){p.attached=true;eventBus.emit(Events.PROP_SUSPEND,{id});}});
  eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{const p=this.details.find(p=>p.id===id);if(p){p.attached=false;p.loose=true;p.mesh.position.set(position.x,ground+p.half[1],position.z);eventBus.emit(Events.PROP_RELEASE,{id,position:p.mesh.position});}});
  eventBus.on(Events.PROP_UNSUPPORTED,({id})=>{const p=this.details.find(p=>p.id===id);if(p)p.loose=true;});
  eventBus.on(Events.WORLD_IMPACT,h=>{const hit=new THREE.Vector3(h.x,h.y,h.z);for(const p of this.details)if(!p.attached&&p.mesh.position.distanceTo(hit)<h.radius+p.size){p.loose=true;const dir=p.mesh.position.clone().sub(hit);dir.y=0;if(!dir.lengthSq())dir.set(1,0,0);dir.normalize();eventBus.emit(Events.PROP_RELEASE,{id:p.id,position:p.mesh.position});eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity:[dir.x*C.PROP_SPEED,C.PROP_LIFT,dir.z*C.PROP_SPEED],spin:0});}});
  eventBus.on(Events.WORLD_DEMOLISHED,({bounds,groundOnly})=>{if(!bounds||groundOnly)return;for(const s of this.sites)if(bounds.min[0]<s.x+s.width/2&&bounds.max[0]>s.x-s.width/2&&bounds.min[2]<s.z+s.depth/2&&bounds.max[2]>s.z-s.depth/2){this.damaged.add(s.id);const model=this.models.get(s.id);if(model)model.visible=false;}});
  const loader=new GLTFLoader();this.loading=Promise.all(this.sites.map(async s=>{const model=(await loader.loadAsync(import.meta.env.BASE_URL+`assets/models/landmarks/${s.id}.glb`)).scene;model.position.set(s.vx*VOXEL.SIZE,s.vy*VOXEL.SIZE,s.vz*VOXEL.SIZE);model.traverse(o=>{if(!o.isMesh)return;o.userData.farDetail=true;o.castShadow=false;o.receiveShadow=false;for(const material of Array.isArray(o.material)?o.material:[o.material]){
    material.onBeforeCompile=shader=>{shader.uniforms.landmarkCoverage={value:coverage.texture};shader.uniforms.landmarkGrid={value:new THREE.Vector3(coverage.origin,coverage.size,coverage.columnSize)};shader.vertexShader='varying vec3 landmarkWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlandmarkWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='varying vec3 landmarkWorld;uniform sampler2D landmarkCoverage;uniform vec3 landmarkGrid;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
     vec2 uv=(floor(landmarkWorld.xz/landmarkGrid.z)-landmarkGrid.x+.5)/landmarkGrid.y;
     if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThan(uv,vec2(1.)))&&texture2D(landmarkCoverage,uv).r>.5)discard;`);};material.customProgramCacheKey=()=> 'landmark-coverage';
   }});scene.add(model);this.models.set(s.id,model);model.visible=!this.damaged.has(s.id);})).then(()=>{this.ready=true;this.stream();}).catch(e=>console.error('Landmark model load failed',e));
  this.buildMap();
 }
 furniture(){
  const pieces=[],part=(size,pos,mat)=>{const g=new THREE.BoxGeometry(...size).toNonIndexed();g.translate(...pos);g.deleteAttribute('uv');const col=new THREE.Color(VOXEL.MATERIALS[mat].color),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3)col.toArray(a,i);g.setAttribute('color',new THREE.BufferAttribute(a,3));pieces.push(g);};
  for(const [size,pos,mat]of C.DETAIL_PARTS)part(size,pos,mat);
  const geometry=mergeGeometries(pieces);for(const p of pieces)p.dispose();geometry.computeBoundingBox();this.half=geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(.5).toArray();const center=geometry.boundingBox.getCenter(new THREE.Vector3());geometry.translate(-center.x,-center.y,-center.z);return geometry;
 }
 buildMap(){
  this.button=document.createElement('button');this.button.id='landmark-map-button';this.button.textContent='M · ISLAND MAP';document.body.appendChild(this.button);
  this.panel=document.createElement('section');this.panel.id='landmark-map';this.panel.hidden=true;this.panel.setAttribute('aria-label','Island destinations');
  const title=document.createElement('h2');title.textContent='Jimothy’s snack crawl';this.panel.appendChild(title);
  const map=document.createElementNS('http://www.w3.org/2000/svg','svg');map.setAttribute('viewBox',`0 0 ${C.MAP_SCALE} ${C.MAP_SCALE}`);map.setAttribute('role','img');map.setAttribute('aria-label','Sixteen landmark destinations across the island');
  const polygon=document.createElementNS(map.namespaceURI,'polygon');polygon.setAttribute('points',islandPlan.coast.map(([x,z])=>`${x+C.MAP_SCALE/2},${z+C.MAP_SCALE/2}`).join(' '));polygon.setAttribute('fill',C.MAP_LAND);map.style.background=C.MAP_WATER;map.appendChild(polygon);
  this.destinations=document.createElement('div');this.destinations.id='landmark-destinations';
  this.sites.forEach((s,i)=>{const mark=document.createElementNS(map.namespaceURI,'text');mark.setAttribute('x',s.x+C.MAP_SCALE/2);mark.setAttribute('y',s.z+C.MAP_SCALE/2);mark.setAttribute('fill',C.MAP_COLOR);mark.setAttribute('font-size',String(C.MAP_FONT_SIZE));mark.textContent=String(i+1);map.appendChild(mark);const b=document.createElement('button');b.textContent=`${i+1}. ${s.name}`;b.addEventListener('click',()=>{this.target=s.id;this.toggleMap(false);});this.destinations.appendChild(b);});
  const close=document.createElement('button');close.textContent='Close map · M';close.addEventListener('click',()=>this.toggleMap(false));this.panel.append(map,this.destinations,close);document.body.appendChild(this.panel);
  this.waypoint=document.createElement('div');this.waypoint.id='landmark-waypoint';document.body.appendChild(this.waypoint);
  this.button.addEventListener('click',()=>this.toggleMap());window.addEventListener('keydown',e=>{if(e.code===C.MAP_KEY&&!e.repeat&&!['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)){e.preventDefault();this.toggleMap();}});
 }
 toggleMap(open=this.panel.hidden){if(open){document.exitPointerLock?.();this.wasPaused=gameState.game.paused;gameState.game.paused=true;this.panel.hidden=false;this.destinations.firstElementChild?.focus();}else{this.panel.hidden=true;gameState.game.paused=!!this.wasPaused;this.wasPaused=false;document.querySelector('canvas')?.focus({preventScroll:true});}}
 stream(){
  if(!this.ready)return;const j=this.jimothy.position,near=this.sites.filter(s=>Math.hypot(s.x-j.x,s.z-j.z)<C.STREAM_RADIUS+this.jimothy.radius),keep=new Set(near.map(s=>s.id));
  for(const id of this.active)if(!keep.has(id)){for(let i=0;i<C.FOOD_LIMIT;i++)eventBus.emit(Events.FOOD_REMOVE,{owner:`landmark:${id}:food:${i}`});this.active.delete(id);}
  for(const p of [...this.details])if(!p.attached&&!keep.has(p.site)){if(p.loose)this.saved.set(p.id,{position:p.mesh.position.toArray(),quaternion:p.mesh.quaternion.toArray()});this.removeDetail(p);}
  for(const s of near){
   this.active.add(s.id);
   for(let i=0;i<C.FOOD_LIMIT;i++){const owner=`landmark:${s.id}:food:${i}`;if(this.eaten.has(owner))continue;const x=s.cache.x+(i+1)*C.CACHE_GAP,z=s.cache.z,y=this.voxels.groundHeightAt(x,z,s.height+C.SIGN_LIFT);eventBus.emit(Events.FOOD_SPAWN,{foodId:s.food[i%s.food.length],x,y:y+VOXEL.SIZE,z,owner});}
   for(let i=0;i<s.approaches.length&&this.details.length<C.DETAIL_LIMIT;i++){const id=`landmark:${s.id}:bench:${i}`;if(this.details.some(p=>p.id===id))continue;const a=s.approaches[i],saved=this.saved.get(id),mesh=new THREE.Mesh(this.detailGeometry,this.detailMaterial),ground=this.voxels.groundHeightAt(a.x,a.z,s.height+C.SIGN_LIFT);mesh.position.set(a.x,ground+this.half[1],a.z);if(saved){mesh.position.fromArray(saved.position);mesh.quaternion.fromArray(saved.quaternion);}mesh.castShadow=mesh.receiveShadow=true;this.scene.add(mesh);const p={id,site:s.id,kind:'landmark-prop',mesh,half:this.half,size:C.PROP_SIZE,mass:C.PROP_MASS,loose:!!saved,attached:false};this.details.push(p);eventBus.emit(Events.PROP_CREATE,p);eventBus.emit(Events.ENTITY_REGISTER,p);}
  }
 }
 removeDetail(p){eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});eventBus.emit(Events.PROP_REMOVE,{id:p.id});p.mesh.removeFromParent();this.details.splice(this.details.indexOf(p),1);}
 update(dt){this.time+=dt;if(this.time>=C.REFRESH){this.time=0;this.stream();}const j=this.jimothy.position,s=this.sites.find(s=>s.id===this.target)||this.sites.find(s=>Math.hypot(j.x-s.x,j.z-s.z)<Math.max(s.width,s.depth));let text='';if(s){const dx=s.x-j.x,dz=s.z-j.z,d=Math.hypot(dx,dz),angle=Math.atan2(dx,dz)-(this.jimothy.aimYaw||0),turn=Math.atan2(Math.sin(angle),Math.cos(angle));text=`${d<Math.max(s.width,s.depth)?'HERE':Math.abs(turn)<C.COMPASS_CONE?'↑':turn>0?'←':'→'}  ${s.name} · ${Math.round(d)} m`;}
  this.waypoint.textContent=text;this.waypoint.hidden=!text;
 }
 reset(){for(const p of [...this.details])this.removeDetail(p);this.active.clear();this.eaten.clear();this.saved.clear();this.damaged.clear();this.target=null;this.time=0;if(!this.panel.hidden)this.toggleMap(false);for(const m of this.models.values())m.visible=true;this.stream();}
 snapshot(){return {ready:this.ready,count:this.sites.length,farModels:this.models.size,details:this.details.length,active:[...this.active],damaged:[...this.damaged],target:this.target,sites:this.sites.map(s=>({id:s.id,name:s.name,x:s.x,y:s.height,z:s.z,width:s.width,depth:s.depth,approaches:s.approaches,tools:s.tools,cache:s.cache}))};}
}
