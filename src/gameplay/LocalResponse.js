import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LOCAL_RESPONSE as C,POLICE,INFANTRY} from '../core/Constants.js';
import {RifleBurst} from '../core/RifleBurst.js';
import {GunAttack} from '../core/PolicePolicy.js';
import {segmentSphere} from '../core/ProjectileContact.js';
import {LocalKick} from '../core/LocalKick.js';
import {HumanResponsePose} from './HumanResponsePose.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';

// A component of Pursuers: actor/navigation ownership stays with that owner.
export class LocalResponse {
 constructor(owner){
  this.owner=owner;this.bullets=[];this.rifleShots=0;this.infantryReady=false;this.gunShots=0;this.gunHits=0;this.gunBlocks=0;this.gunsReady=false;this.ready=false;this.photos=0;this.kicks=0;this.hits=0;this.cooldown=0;this.particles=[];this.voices=new Set();
  // Perception and attack clocks also run in Node's headless AI tests.
  // Browser resources are optional; the same gameplay state remains active.
  if(typeof document==='undefined')return;
  const c=document.createElement('canvas');c.width=c.height=C.FLASH_TEXTURE;const ctx=c.getContext('2d'),r=c.width/2,g=ctx.createRadialGradient(r,r,0,r,r,r);
  for(const [at,color]of C.FLASH_STOPS)g.addColorStop(at,color);ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);this.flashTexture=new THREE.CanvasTexture(c);
  this.effects=new THREE.InstancedMesh(new THREE.SphereGeometry(C.EFFECT_SIZE,...C.EFFECT_SEGMENTS),new THREE.MeshBasicMaterial({color:C.EFFECT_COLOR}),C.EFFECT_LIMIT);this.effects.count=0;this.effects.frustumCulled=false;owner.scene.add(this.effects);this.dummy=new THREE.Object3D();
  this.loading=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${C.CAMERA_PATH}`).then(g=>{this.camera=g.scene;this.camera.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});this.ready=true;for(const p of owner.all)this.person(p);}).catch(e=>console.error('Response camera failed',e));
  this.bulletGeometry=new THREE.BoxGeometry(POLICE.SHOT_RADIUS,POLICE.SHOT_RADIUS,POLICE.SHOT_LENGTH);this.bulletMaterial=new THREE.MeshBasicMaterial({color:POLICE.SHOT_COLOR,toneMapped:false});
  this.gunLoading=Promise.all([POLICE.GUN_PATH,POLICE.CAP_PATH].map(path=>new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${path}`))).then(([gun,cap])=>{
   this.gunTemplate=gun.scene;this.capTemplate=cap.scene;for(const root of [this.gunTemplate,this.capTemplate])root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});this.gunsReady=true;for(const p of owner.all)this.person(p);
  }).catch(e=>console.error('Police equipment failed',e));
  this.infantryLoading=Promise.all([INFANTRY.MODEL_PATH,INFANTRY.GUN_PATH,INFANTRY.CAP_PATH].map(path=>new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${path}`))).then(([human,gun,helmet])=>{
   this.infantryModel=human;this.rifleTemplate=gun.scene;this.helmetTemplate=helmet.scene;for(const root of [this.rifleTemplate,this.helmetTemplate])root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});this.infantryReady=true;for(const p of owner.all)if(p.type==='infantry'){owner._human(p);this.person(p);}
  }).catch(e=>console.error('Infantry assets failed',e));
  this.unlock=()=>this.initAudio();window.addEventListener('keydown',this.unlock);window.addEventListener('pointerdown',this.unlock);window.addEventListener('blur',()=>this.silence());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.silence();});
 }
 person(p){
  if(p.type==='angry-local')p.kick??=new LocalKick();
  if(p.type==='police')p.fire??=new GunAttack();
  if(p.type==='infantry')p.fire??=new RifleBurst();
  if(!p.visual||p.type==='animal-control')return;
  p.responsePose??=new HumanResponsePose(p);
  const infantry=p.type==='infantry',profile=infantry?INFANTRY:POLICE;
  if((infantry?this.infantryReady:p.type==='police'&&this.gunsReady)&&!p.gun){
   p.gunProfile=profile;p.gun=(infantry?this.rifleTemplate:this.gunTemplate).clone(true);p.gun.name=infantry?'infantry-rifle':'police-gun';p.visual.getObjectByName('hand_r').add(p.gun);
   p.gunFlash=new THREE.Sprite(new THREE.SpriteMaterial({map:this.flashTexture,color:profile.SHOT_COLOR,transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending,opacity:0}));p.gunFlash.position.fromArray(profile.MUZZLE);p.gunFlash.scale.setScalar(profile.MUZZLE_SIZE);p.gun.add(p.gunFlash);
   const head=p.visual.getObjectByName('head');p.group.updateWorldMatrix(true,true);const at=head.getWorldPosition(new THREE.Vector3());at.y=p.group.position.y+p.height-profile.CAP_SEAT;
   p.cap=(infantry?this.helmetTemplate:this.capTemplate).clone(true);p.cap.name=infantry?'infantry-helmet':'police-cap';head.add(p.cap);p.cap.position.copy(head.worldToLocal(at));p.cap.quaternion.copy(head.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(p.group.getWorldQuaternion(new THREE.Quaternion())));
  }
  if(p.type==='paparazzo'&&this.ready&&!p.camera){
   p.camera=this.camera.clone(true);p.camera.name='paparazzi-camera';p.visual.getObjectByName('hand_r').add(p.camera);
   p.cameraFlash=new THREE.Sprite(new THREE.SpriteMaterial({map:this.flashTexture,color:C.FLASH_COLOR,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));p.cameraFlash.position.fromArray(C.FLASH_POSITION);p.cameraFlash.scale.setScalar(C.FLASH_SIZE);p.camera.add(p.cameraFlash);
  }
 }
 remove(p){p.cameraFlash?.material.dispose();p.gunFlash?.material.dispose();}
 interrupt(p){p.kick?.cancel();p.fire?.cancel();if(p.gunFlash)p.gunFlash.material.opacity=0;p.photoLeft=0;if(p.cameraFlash)p.cameraFlash.material.opacity=0;}
 photo(p,stuns){
  if(!p.camera)return;this.photos++;p.photoLeft=C.FLASH_SECONDS;p.cameraFlash.material.opacity=1;this.cue('photo',p.group.position);eventBus.emit(Events.PAPARAZZI_PHOTO,{id:p.id,stuns});
 }
 kick(p,dt){
  const j=this.owner.jimothy,k=p.kick,pos=p.group.position,to=j.position,dx=to.x-pos.x,dz=to.z-pos.z;
  const distance=Math.hypot(dx,to.y-pos.y-C.HEIGHT,dz),angle=Math.atan2(dx,dz)-k.heading;
  // Locals yield during a committed net attempt; otherwise their repeated
  // knockback rescues even a stationary target from animal control.
  const allowed=gameState.capture.phase==='idle'&&gameState.vehicle.phase==='onFoot'&&gameState.tools.shield<=0&&!gameState.player.inTree&&!gameState.player.swimming;
  if(!allowed){k.cancel();return;}
  const clear=()=>!this.owner.voxels||this.owner.voxels.hasLineOfSight(pos.x,pos.y+C.HEIGHT,pos.z,to.x,to.y,to.z);
  const inReach=distance<=C.RANGE+j.radius;
  const r=k.update(dt,{canStart:gameState.heat.tier>=C.MIN_TIER&&this.cooldown<=0&&p.sees&&inReach&&clear(),canHit:p.sees&&inReach&&Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))<=C.ARC&&clear(),yaw:p.group.rotation.y});
  if(r.started){this.kicks++;this.cooldown=C.GLOBAL_COOLDOWN;}
  if(r.swish)this.cue('swish',pos);
  if(r.hit){
   this.hits++;const forward=new THREE.Vector3(Math.sin(k.heading),0,Math.cos(k.heading)),at=pos.clone().addScaledVector(forward,C.RANGE);at.y+=C.HEIGHT;
   eventBus.emit(Events.PLAYER_HIT,{source:'kick',velocity:[forward.x*C.IMPULSE,C.UP,forward.z*C.IMPULSE]});this.cue('hit',at);
   for(let i=0;i<C.EFFECT_COUNT&&this.particles.length<C.EFFECT_LIMIT;i++)this.particles.push({at:at.clone(),age:0,v:new THREE.Vector3(Math.sin(i),Math.abs(Math.cos(i)),Math.cos(i)).multiplyScalar(C.EFFECT_SPEED)});
  }
 }
 gun(p,dt){
  if(!p.fire||!p.gun)return;
  const profile=p.gunProfile;
  const target=this.owner.jimothy.body.position,pos=p.group.position;
  const allowed=gameState.heat.tier>=profile.MIN_TIER&&gameState.capture.phase==='idle'&&gameState.vehicle.phase==='onFoot'&&gameState.tools.shield<=0&&!gameState.player.inTree&&!gameState.player.swimming&&!p.attached&&!p.ragdoll&&p.sees&&p.responsePose.raised>=profile.GUN_READY&&pos.distanceTo(target)<=profile.GUN_RANGE+this.owner.jimothy.radius&&this.owner.voxels.hasLineOfSight(pos.x,pos.y+profile.CAP_HEIGHT,pos.z,target.x,target.y,target.z);
  const attack=p.fire.update(dt,{allowed,target});
  if(!attack.fire||this.bullets.length>=POLICE.SHOT_LIMIT)return;
  p.gun.updateWorldMatrix(true,true);const from=p.gun.localToWorld(new THREE.Vector3().fromArray(profile.MUZZLE)),direction=new THREE.Vector3(attack.target.x,attack.target.y,attack.target.z).sub(from).normalize();
  const mesh=new THREE.Mesh(this.bulletGeometry,this.bulletMaterial);mesh.position.copy(from);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);this.owner.scene.add(mesh);
  this.bullets.push({mesh,direction,age:0,profile,source:p.type});this.gunShots++;if(p.type==='infantry')this.rifleShots++;p.gunFlashLeft=profile.MUZZLE_SECONDS;this.cue(p.type==='infantry'?'rifle':'gun',from);
 }
 updateBullets(dt){
  const j=this.owner.jimothy;
  for(const b of [...this.bullets]){
   const profile=b.profile;
   const from=b.mesh.position.clone(),to=from.clone().addScaledVector(b.direction,profile.SHOT_SPEED*dt),length=from.distanceTo(to),wall=this.owner.voxels.raycast(from.x,from.y,from.z,b.direction.x,b.direction.y,b.direction.z,length);
   const contact=gameState.vehicle.phase==='onFoot'?segmentSphere(from,to,j.body.position,j.radius+profile.SHOT_RADIUS):null;
   const hit=contact!==null&&(!wall||contact*length<wall.t);b.age+=dt;
   if(hit||wall||b.age>=profile.SHOT_LIFE){
    if(wall&&!hit)this.gunBlocks++;
    if(hit&&gameState.tools.shield<=0&&gameState.capture.phase==='idle'){
     this.gunHits++;const direction=b.direction.clone();direction.y=0;direction.normalize();eventBus.emit(Events.PLAYER_HIT,{source:b.source,velocity:[direction.x*profile.HIT_SPEED,profile.HIT_UP,direction.z*profile.HIT_SPEED]});
    }
    if(hit||wall){const at=from.lerp(to,hit?contact:Math.min(1,wall.t/length));for(let i=0;i<C.EFFECT_COUNT&&this.particles.length<C.EFFECT_LIMIT;i++)this.particles.push({at:at.clone(),age:0,v:new THREE.Vector3(Math.sin(i),Math.abs(Math.cos(i)),Math.cos(i)).multiplyScalar(C.EFFECT_SPEED)});}
    b.mesh.removeFromParent();this.bullets.splice(this.bullets.indexOf(b),1);
   }else b.mesh.position.copy(to);
  }
 }
 update(dt){
  this.cooldown=Math.max(0,this.cooldown-dt);this.updateBullets(dt);
  for(const p of this.owner.all){if(p.gun)p.gun.visible=!p.vehicleSeat;p.gunFlashLeft=Math.max(0,(p.gunFlashLeft||0)-dt);if(p.gunFlash)p.gunFlash.material.opacity=p.gunFlashLeft/p.gunProfile.MUZZLE_SECONDS;p.photoLeft=Math.max(0,(p.photoLeft||0)-dt);if(p.cameraFlash)p.cameraFlash.material.opacity=p.photoLeft/C.FLASH_SECONDS;}
  this.particles=this.particles.filter(p=>{p.age+=dt;p.at.addScaledVector(p.v,dt);return p.age<C.EFFECT_LIFE;});
  if(!this.effects)return;
  this.effects.count=this.particles.length;this.particles.forEach((p,i)=>{this.dummy.position.copy(p.at);this.dummy.scale.setScalar(1-p.age/C.EFFECT_LIFE);this.dummy.updateMatrix();this.effects.setMatrixAt(i,this.dummy.matrix);});this.effects.instanceMatrix.needsUpdate=true;
 }
 initAudio(){
  if(!this.audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;this.audio=new Audio();this.master=this.audio.createGain();this.master.gain.value=C.AUDIO_GAIN;
   this.analyser=this.audio.createAnalyser();this.analyser.fftSize=C.AUDIO_FFT;this.samples=new Float32Array(C.AUDIO_FFT);const limiter=this.audio.createDynamicsCompressor();limiter.threshold.value=C.AUDIO_THRESHOLD;limiter.knee.value=C.AUDIO_KNEE;limiter.ratio.value=C.AUDIO_RATIO;this.master.connect(limiter);limiter.connect(this.analyser);this.analyser.connect(this.audio.destination);
   this.noise=this.audio.createBuffer(1,this.audio.sampleRate*C.AUDIO_NOISE,this.audio.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  }this.audio.resume().catch(()=>{});
 }
 cue(kind,at){
  if(!this.audio||this.audio.state!=='running'||this.voices.size>=C.AUDIO_VOICES)return;
  const volume=Math.max(0,1-at.distanceTo(this.owner.jimothy.position)/C.AUDIO_RANGE);if(!volume)return;
  const t=this.audio.currentTime,seconds=C.AUDIO_SECONDS[kind],o=this.audio.createOscillator(),noise=this.audio.createBufferSource(),gain=this.audio.createGain(),filter=this.audio.createBiquadFilter();
  o.type='triangle';o.frequency.setValueAtTime(C.AUDIO_HZ[kind],t);o.frequency.exponentialRampToValueAtTime(C.AUDIO_HZ[kind]/2,t+seconds);noise.buffer=this.noise;filter.type=kind==='hit'?'lowpass':'highpass';filter.frequency.value=C.AUDIO_HZ[kind];
  gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(C.AUDIO_FLOOR,t+seconds);o.connect(gain);noise.connect(filter);filter.connect(gain);gain.connect(this.master);this.voices.add(o);
  o.onended=()=>{o.disconnect();noise.disconnect();filter.disconnect();gain.disconnect();this.voices.delete(o);};o.start();noise.start();o.stop(t+seconds);noise.stop(t+seconds);
 }
 silence(){for(const o of this.voices){try{o.stop();}catch{}}}
 reset(){this.silence();for(const b of this.bullets)b.mesh.removeFromParent();this.bullets=[];this.rifleShots=this.gunShots=this.gunHits=this.gunBlocks=0;this.particles=[];if(this.effects)this.effects.count=0;this.photos=this.kicks=this.hits=0;this.cooldown=0;}
 snapshot(){let rms=0;if(this.analyser){this.analyser.getFloatTimeDomainData(this.samples);rms=Math.sqrt(this.samples.reduce((s,x)=>s+x*x,0)/this.samples.length);}return{ready:this.ready,gunsReady:this.gunsReady,infantryReady:this.infantryReady,rifleShots:this.rifleShots,gunShots:this.gunShots,gunHits:this.gunHits,gunBlocks:this.gunBlocks,bullets:this.bullets.length,photos:this.photos,kicks:this.kicks,hits:this.hits,particles:this.particles.length,voices:this.voices.size,rms};}
}
