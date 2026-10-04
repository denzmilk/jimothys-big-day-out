import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LOCAL_RESPONSE as C} from '../core/Constants.js';
import {LocalKick} from '../core/LocalKick.js';
import {HumanResponsePose} from './HumanResponsePose.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';

// A component of Pursuers: actor/navigation ownership stays with that owner.
export class LocalResponse {
 constructor(owner){
  this.owner=owner;this.ready=false;this.photos=0;this.kicks=0;this.hits=0;this.cooldown=0;this.particles=[];this.voices=new Set();
  // Perception and attack clocks also run in Node's headless AI tests.
  // Browser resources are optional; the same gameplay state remains active.
  if(typeof document==='undefined')return;
  const c=document.createElement('canvas');c.width=c.height=C.FLASH_TEXTURE;const ctx=c.getContext('2d'),r=c.width/2,g=ctx.createRadialGradient(r,r,0,r,r,r);
  for(const [at,color]of C.FLASH_STOPS)g.addColorStop(at,color);ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);this.flashTexture=new THREE.CanvasTexture(c);
  this.effects=new THREE.InstancedMesh(new THREE.SphereGeometry(C.EFFECT_SIZE,...C.EFFECT_SEGMENTS),new THREE.MeshBasicMaterial({color:C.EFFECT_COLOR}),C.EFFECT_LIMIT);this.effects.count=0;this.effects.frustumCulled=false;owner.scene.add(this.effects);this.dummy=new THREE.Object3D();
  this.loading=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${C.CAMERA_PATH}`).then(g=>{this.camera=g.scene;this.camera.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});this.ready=true;for(const p of owner.all)this.person(p);}).catch(e=>console.error('Response camera failed',e));
  this.unlock=()=>this.initAudio();window.addEventListener('keydown',this.unlock);window.addEventListener('pointerdown',this.unlock);window.addEventListener('blur',()=>this.silence());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.silence();});
 }
 person(p){
  if(p.type==='angry-local')p.kick??=new LocalKick();
  if(!p.visual||p.type==='animal-control')return;
  p.responsePose??=new HumanResponsePose(p);
  if(p.type==='paparazzo'&&this.ready&&!p.camera){
   p.camera=this.camera.clone(true);p.camera.name='paparazzi-camera';p.visual.getObjectByName('hand_r').add(p.camera);
   p.cameraFlash=new THREE.Sprite(new THREE.SpriteMaterial({map:this.flashTexture,color:C.FLASH_COLOR,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));p.cameraFlash.position.fromArray(C.FLASH_POSITION);p.cameraFlash.scale.setScalar(C.FLASH_SIZE);p.camera.add(p.cameraFlash);
  }
 }
 remove(p){p.cameraFlash?.material.dispose();}
 interrupt(p){p.kick?.cancel();p.photoLeft=0;if(p.cameraFlash)p.cameraFlash.material.opacity=0;}
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
 update(dt){
  this.cooldown=Math.max(0,this.cooldown-dt);
  for(const p of this.owner.all){p.photoLeft=Math.max(0,(p.photoLeft||0)-dt);if(p.cameraFlash)p.cameraFlash.material.opacity=p.photoLeft/C.FLASH_SECONDS;}
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
 reset(){this.silence();this.particles=[];if(this.effects)this.effects.count=0;this.photos=this.kicks=this.hits=0;this.cooldown=0;}
 snapshot(){let rms=0;if(this.analyser){this.analyser.getFloatTimeDomainData(this.samples);rms=Math.sqrt(this.samples.reduce((s,x)=>s+x*x,0)/this.samples.length);}return{ready:this.ready,photos:this.photos,kicks:this.kicks,hits:this.hits,particles:this.particles.length,voices:this.voices.size,rms};}
}
