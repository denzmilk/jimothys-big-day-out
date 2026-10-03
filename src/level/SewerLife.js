import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SEWER as C,VOXEL} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';
import {rooms,fixtureSites,profile} from './SewerLayout.js';
import * as Plan from './CityPlanner.js';

// M48: dressing is nearby-only. Structural pipework lives in voxels; movable
// equipment shares the existing physical prop and rolling-collection lifecycle.
export class SewerLife {
 constructor(scene,jimothy,voxels){
  Object.assign(this,{scene,jimothy,voxels,items:[],saved:new Map(),ready:false,time:0,center:null});
  this.sites=fixtureSites();this.templates=new Map();
  this.lights=Array.from({length:C.LOCAL_LIGHT_LIMIT},()=>{const l=new THREE.PointLight(C.LIGHT_COLOR,0,C.LOCAL_LIGHT_RANGE);scene.add(l);return l;});
  const loader=new GLTFLoader();this.loading=Promise.all(['pump','workbench','locker','lamp','pipe-rack'].map(async kind=>{
   const g=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/models/sewer/${kind}.glb`),box=new THREE.Box3().setFromObject(g.scene),centre=box.getCenter(new THREE.Vector3()),half=box.getSize(new THREE.Vector3()).multiplyScalar(.5);
   const template=new THREE.Group();g.scene.position.sub(centre);template.add(g.scene);this.templates.set(kind,{mesh:template,half:half.toArray()});
  })).then(()=>{this.ready=true;}).catch(e=>console.error('Sewer assets failed',e));
  this.water=new THREE.InstancedMesh(new THREE.PlaneGeometry(C.GUTTER_TILE,C.GUTTER_WIDTH),new THREE.MeshStandardMaterial({color:C.WATER_COLOR,roughness:.3,metalness:.35,transparent:true,opacity:C.WATER_OPACITY,side:THREE.DoubleSide,depthWrite:false}),C.WATER_LIMIT);
  this.waterUniforms={sewerTime:{value:0},sewerPlayer:{value:new THREE.Vector3()},sewerMotion:{value:0}};
  this.water.material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.waterUniforms);
   shader.vertexShader='varying vec3 sewerPoint;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n sewerPoint=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader='uniform float sewerTime,sewerMotion;uniform vec3 sewerPlayer;varying vec3 sewerPoint;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float rippled=distance(sewerPoint.xz,sewerPlayer.xz);
    float wake=(1.-smoothstep(0.,${C.RIPPLE_REACH.toFixed(2)},rippled))*sewerMotion*sin(rippled*${C.RIPPLE_FREQUENCY.toFixed(2)}-sewerTime*${C.RIPPLE_FREQUENCY.toFixed(2)});
    float flow=sin((sewerPoint.x+sewerPoint.z)*${C.WAVE_FREQUENCY.toFixed(2)}+sewerTime*${C.WATER_SPEED.toFixed(2)});
    diffuseColor.rgb*=.85+flow*.12+wake*.22;
   `);
  };
  this.water.frustumCulled=false;this.water.count=0;scene.add(this.water);this.waterTiles=[];this.dummy=new THREE.Object3D();
  eventBus.on(Events.WORLD_IMPACT,h=>{for(const p of this.items)if(!p.attached&&p.mesh.position.distanceTo(new THREE.Vector3(h.x,h.y,h.z))<h.radius+p.half[1])this.loosen(p,h);});
  eventBus.on(Events.PROP_UNSUPPORTED,({id})=>{const p=this.items.find(p=>p.id===id);if(p)this.disable(p);});
  eventBus.on(Events.ENTITY_ATTACH,({id})=>{const p=this.items.find(p=>p.id===id);if(p){this.disable(p);p.attached=true;eventBus.emit(Events.PROP_SUSPEND,{id});}});
  eventBus.on(Events.ENTITY_RELEASE,({id,position,ground})=>{const p=this.items.find(p=>p.id===id);if(p){p.attached=false;p.mesh.position.set(position.x,ground+p.half[1],position.z);eventBus.emit(Events.PROP_RELEASE,{id,position:p.mesh.position});}});
 }
 disable(p){p.loose=true;if(p.lamp)p.lamp.intensity=0;if(p.light)p.light.intensity=0;}
 loosen(p,hit){this.disable(p);const q=p.mesh.position,d=Math.hypot(q.x-hit.x,q.z-hit.z)||1;eventBus.emit(Events.PROP_IMPULSE,{id:p.id,velocity:[(q.x-hit.x)/d*C.FIXTURE_KICK,C.FIXTURE_LIFT,(q.z-hit.z)/d*C.FIXTURE_KICK],spin:C.FIXTURE_SPIN});}
 sign(p,site){
  const group=new THREE.Group(),exit=site.exit||site.room.exit;
  group.position.y=C.SIGN_Y-p.half[1];group.rotation.y=Math.atan2(exit.x-site.x,exit.z-site.z)-Math.PI/2;
  for(const side of [1,-1]){
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;const ctx=canvas.getContext('2d');ctx.fillStyle='#'+C.SIGN_COLOR.toString(16);ctx.fillRect(0,0,512,192);ctx.fillStyle='#'+C.SIGN_TEXT.toString(16);ctx.font='bold 35px sans-serif';ctx.textAlign='center';
   ctx.fillText(site.exit?'SURFACE STAIRS':site.room.kind.toUpperCase()+' CHAMBER',256,68);ctx.font='bold 30px sans-serif';ctx.fillText(site.exit?'EXIT  ↑':(side===1?'EXIT  →  ':'EXIT  ←  ')+Math.round(Math.hypot(site.x-exit.x,site.z-exit.z))+' m',256,130);
   const texture=new THREE.CanvasTexture(canvas),m=new THREE.MeshBasicMaterial({map:texture}),sign=new THREE.Mesh(new THREE.PlaneGeometry(C.SIGN_WIDTH,C.SIGN_HEIGHT),m);sign.rotation.y=side===1?0:Math.PI;group.add(sign);
  }
  p.mesh.add(group);p.sign=group;
 }

 spawn(site){
  const t=this.templates.get(site.kind),mesh=t.mesh.clone(true),half=t.half,pose=this.saved.get(site.id),base=pose?pose.position[1]-half[1]:profile(site.x,site.z).floor;
  const y=this.voxels.groundHeightAt(site.x,site.z,base+C.ROOM_BLEND);
  if(!pose&&(this.voxels.solidAtWorld(site.x,y+half[1],site.z)||Math.abs(y-base)>C.ROOM_BLEND))return;
  mesh.position.set(site.x,y+half[1],site.z);if(pose){mesh.position.fromArray(pose.position);mesh.quaternion.fromArray(pose.quaternion);}
  mesh.traverse(o=>{if(o.isMesh)o.receiveShadow=true;});
  const p={id:site.id,kind:'sewer-'+site.kind,mesh,half,mass:C.FIXTURE_MASS,size:Math.max(...half)*2,loose:pose?.loose||false,attached:false,site};
  if(site.kind==='lamp'){p.lamp={intensity:0};this.sign(p,site);}
  this.scene.add(mesh);this.items.push(p);eventBus.emit(Events.PROP_CREATE,p);eventBus.emit(Events.ENTITY_REGISTER,p);
 }
 remove(p,save=true){
  if(save)this.saved.set(p.id,{position:p.mesh.position.toArray(),quaternion:p.mesh.quaternion.toArray(),loose:p.loose});
  eventBus.emit(Events.ENTITY_UNREGISTER,{id:p.id});eventBus.emit(Events.PROP_REMOVE,{id:p.id});p.mesh.removeFromParent();
  if(p.sign)for(const sign of p.sign.children){sign.geometry.dispose();sign.material.map.dispose();sign.material.dispose();}
  this.items.splice(this.items.indexOf(p),1);
 }
 populate(below=true){
  const j=this.jimothy.position;this.center={x:j.x,z:j.z};
  for(const p of [...this.items])if(!p.attached&&p.mesh.position.distanceTo(j)>C.FIXTURE_RADIUS)this.remove(p);
  for(const s of this.sites.map(s=>{const saved=this.saved.get(s.id);return saved?{...s,x:saved.position[0],z:saved.position[2]}:s;}).filter(s=>(below||this.saved.get(s.id)?.loose)&&Math.hypot(s.x-j.x,s.z-j.z)<C.FIXTURE_RADIUS).sort((a,b)=>Math.hypot(a.x-j.x,a.z-j.z)-Math.hypot(b.x-j.x,b.z-j.z))){
   if(this.items.length>=C.FIXTURE_LIMIT)break;if(this.items.some(p=>p.id===s.id))continue;this.spawn(s);
  }
  if(!below){this.waterTiles=[];return;}
  const nodes=Plan.sewerNodesIn(j.x-C.WATER_RADIUS,j.z-C.WATER_RADIUS,j.x+C.WATER_RADIUS,j.z+C.WATER_RADIUS);
  this.waterTiles=[];
  for(const n of nodes){if(this.waterTiles.length>=C.WATER_LIMIT)break;const p=profile(n.x,n.z);if(!p.channel)continue;
   const horizontal=nodes.some(q=>q.z===n.z&&q.x===n.x+C.GUTTER_TILE);this.waterTiles.push({...n,y:p.floor-C.GUTTER_DEPTH+C.WATER_OFFSET,yaw:horizontal?0:Math.PI/2,w:C.GUTTER_TILE,d:C.GUTTER_WIDTH});
  }
  const step=VOXEL.SIZE*4;
  for(const r of rooms().filter(r=>r.kind==='overflow'&&Math.hypot(r.x-j.x,r.z-j.z)<C.WATER_RADIUS))
   for(let x=-r.radius*C.BASIN_SHARE;x<=r.radius*C.BASIN_SHARE;x+=step)for(let z=-r.radius*C.BASIN_SHARE;z<=r.radius*C.BASIN_SHARE;z+=step){
    if(Math.hypot(x,z)+step/2>r.radius*C.BASIN_SHARE||this.waterTiles.length>=C.WATER_LIMIT)continue;
    this.waterTiles.push({x:r.x+x,z:r.z+z,y:r.y-C.BASIN_DEPTH+C.WATER_OFFSET,yaw:0,w:step,d:step});
   }
 }
 update(dt){
  if(!this.ready||!gameState.game.isPlaying)return;this.time+=dt;
  const j=this.jimothy.position,below=this.voxels.terrainHeightAt(j.x,j.z)-j.y>C.BELOW;
  if(!below){
   for(const p of [...this.items])if(!p.attached&&(!p.loose||p.mesh.position.distanceTo(j)>C.FIXTURE_RADIUS))this.remove(p);
   if(this.wasBelow||!this.center||Math.hypot(j.x-this.center.x,j.z-this.center.z)>C.FIXTURE_REFRESH)this.populate(false);
   this.wasBelow=false;this.water.count=0;for(const l of this.lights)l.intensity=0;return;
  }
  if(!this.wasBelow)this.center=null;this.wasBelow=true;
  if(!this.center||Math.hypot(j.x-this.center.x,j.z-this.center.z)>C.FIXTURE_REFRESH)this.populate();
  for(const p of this.items)if(p.lamp){p.lamp.intensity=0;p.light=null;}
  const lamps=this.items.filter(p=>p.lamp&&!p.loose&&!p.attached).sort((a,b)=>a.mesh.position.distanceToSquared(j)-b.mesh.position.distanceToSquared(j));
  this.lights.forEach((l,i)=>{const p=lamps[i];l.intensity=p?C.LOCAL_LIGHT_INTENSITY:0;if(p){l.position.copy(p.mesh.position);l.position.y+=p.half[1];l.color.set(C.LOCAL_LIGHT_COLORS[p.site.room?.index||0]);p.lamp.intensity=l.intensity;p.light=l;}});
  this.waterUniforms.sewerTime.value=this.time;this.waterUniforms.sewerPlayer.value.copy(j);this.waterUniforms.sewerMotion.value=Math.min(1,this.jimothy.speed/C.FIXTURE_KICK);
  let n=0;for(const t of this.waterTiles){
   if(this.voxels.groundHeightAt(t.x,t.z,t.y)>t.y||!this.voxels.solidAtWorld(t.x,t.y-C.GUTTER_DEPTH,t.z))continue;
   this.dummy.position.set(t.x,t.y,t.z);this.dummy.rotation.set(-Math.PI/2,0,t.yaw);this.dummy.scale.set(t.w/C.GUTTER_TILE,t.d/C.GUTTER_WIDTH,1);this.dummy.updateMatrix();this.water.setMatrixAt(n++,this.dummy.matrix);
  }this.water.count=n;this.water.instanceMatrix.needsUpdate=true;
 }
 reset(){for(const p of [...this.items])this.remove(p,false);this.saved.clear();this.center=null;this.water.count=0;this.waterTiles=[];for(const l of this.lights)l.intensity=0;}
 snapshot(){return {ready:this.ready,rooms:rooms(),fixtures:this.items.length,lights:this.lights.filter(l=>l.intensity>0).length,water:this.water.count,loose:this.items.filter(p=>p.loose).length};}
}
