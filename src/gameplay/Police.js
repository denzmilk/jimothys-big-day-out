import * as THREE from 'three';
import {POLICE as C,VISION,RADAR} from '../core/Constants.js';
import {eventBus,Events} from '../core/EventBus.js';
import {gameState} from '../core/GameState.js';
import {rememberPoliceTarget} from '../core/PolicePolicy.js';
import {sightFan,belowGround} from '../core/Perception.js';

// StreetLife owns road travel and PhysicsSystem owns the car body. This owner
// supplies only observed route goals and the response's bounded presentation.
export class Police {
 constructor(scene,jimothy,voxels){
  Object.assign(this,{scene,jimothy,voxels});this.units=[];this.focused=true;this.serial=0;this.cooldown=0;this.time=0;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=C.LIGHT_TEXTURE;const ctx=canvas.getContext('2d'),r=C.LIGHT_TEXTURE/2,gradient=ctx.createRadialGradient(r,r,0,r,r,r);for(const [at,color]of C.LIGHT_STOPS)gradient.addColorStop(at,color);ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);this.lightTexture=new THREE.CanvasTexture(canvas);
  eventBus.on(Events.VEHICLE_REMOVE,({id})=>{const u=this.units.find(u=>u.car.id===id);if(u)this.remove(u);});
  eventBus.on(Events.TACTICAL_QUERY,q=>q.contacts.push(...this.radarContacts(q)));
  this.unlock=()=>this.initAudio();window.addEventListener('keydown',this.unlock);window.addEventListener('pointerdown',this.unlock);window.addEventListener('blur',()=>{this.focused=false;this.silence();});window.addEventListener('focus',()=>{this.focused=true;});document.addEventListener('visibilitychange',()=>{if(document.hidden)this.silence();});
 }
 capacity(){let result={ready:false,count:C.COUNT};eventBus.emit(Events.POLICE_CAPACITY,{receive:r=>result=r});return result;}
 get ready(){return this.capacity().ready;}
 spawn(){
  const j=this.jimothy.position,target={x:Math.round(j.x/C.REPORT_CELL)*C.REPORT_CELL,z:Math.round(j.z/C.REPORT_CELL)*C.REPORT_CELL};
  eventBus.emit(Events.VEHICLE_PATROL_REQUEST,{id:`police-car-${this.serial++}`,around:j,target,receive:car=>{
   if(!car)return;const lights=new THREE.Group();this.scene.add(lights);
   for(const [i,color]of[C.LIGHT_RED,C.LIGHT_BLUE].entries()){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:this.lightTexture,color,transparent:true,opacity:0,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));s.position.set((i?1:-1)*C.LIGHT_HALF_WIDTH,car.half[1]+C.LIGHT_HEIGHT,0);s.scale.setScalar(C.LIGHT_SIZE);lights.add(s);}
   this.units.push({car,lights,lastKnown:target,searchLeft:C.SEARCH_SECONDS,state:'search',seen:false,parked:false,parkedTime:0,routeClock:0});
  }});
 }
 sightRange(){return C.SIGHT*(gameState.player.hidden?VISION.BUSH_RANGE_SCALE:1)*THREE.MathUtils.lerp(VISION.NIGHT_RANGE_SCALE,1,gameState.world.daylight??1);}
 canSee(u){
  const a=u.car.mesh.position,j=this.jimothy.body.position,d=a.distanceTo(j);if(d>this.sightRange()||belowGround(this.voxels,a)!==belowGround(this.voxels,j))return false;
  const off=Math.atan2(j.x-a.x,j.z-a.z)-(u.car.yaw||0);if(d>VISION.PERIPHERAL_RANGE&&Math.abs(Math.atan2(Math.sin(off),Math.cos(off)))>C.CONE)return false;
  return this.voxels.hasLineOfSight(a.x,a.y+C.EYE_HEIGHT,a.z,j.x,j.y,j.z);
 }
 dismount(u){
  let released=false;eventBus.emit(Events.DRIVER_EXIT,{id:u.car.id,receive:r=>released=r});
  if(released){u.car.driving=false;u.car.route.speed=0;u.parked=true;u.state='dismounted';}return released;
 }
 remove(u){
  u.lights.removeFromParent();for(const s of u.lights.children)s.material.dispose();
  u.car.emergency=false;u.car.routeTarget=null;u.car.cruiseSpeed=undefined;u.car.turnSpeed=undefined;u.car.responseRole=null;
  const i=this.units.indexOf(u);if(i>=0)this.units.splice(i,1);
 }
 update(dt){
  if(!gameState.game.isPlaying){this.silence();return;}this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);
  const capacity=this.capacity(),active=gameState.heat.tier>=C.MIN_TIER;
  if(active&&capacity.ready&&capacity.count<C.COUNT&&this.units.length<C.COUNT&&this.cooldown<=0){this.spawn();this.cooldown=C.SPAWN_INTERVAL;}
  for(const u of [...this.units]){
   const p=u.car;if(p.playerControlled||p.attached||p.loose){this.remove(u);continue;}
   if(!active){if(u.parked||this.dismount(u))this.remove(u);continue;}
   if(u.parked){u.parkedTime+=dt;u.seen=false;}
   else{
    u.seen=this.canSee(u);rememberPoliceTarget(u,dt,u.seen?this.jimothy.position:null);u.routeClock-=dt;
    if(u.routeClock<=0){p.routeTarget=u.state==='patrol'?null:{...u.lastKnown};u.routeClock=C.ROUTE_INTERVAL;}
    if(u.seen&&p.mesh.position.distanceTo(this.jimothy.position)<C.STOP_DISTANCE+this.jimothy.radius&&p.driverAssigned)this.dismount(u);
   }
   u.lights.position.copy(p.mesh.position);u.lights.quaternion.copy(p.mesh.quaternion);u.lights.visible=p.mesh.visible;
   for(const [i,s]of u.lights.children.entries())s.material.opacity=(!u.parked||u.parkedTime<C.LIGHT_RETIRE)&&Math.floor(this.time*C.LIGHT_HZ)%2===i?1:0;
  }
  this.sound();
 }
 initAudio(){
  if(!this.audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;this.audio=new Audio();this.gain=this.audio.createGain();this.gain.gain.value=0;this.analyser=this.audio.createAnalyser();this.analyser.fftSize=C.AUDIO_FFT;this.samples=new Float32Array(C.AUDIO_FFT);this.gain.connect(this.analyser);this.analyser.connect(this.audio.destination);this.oscillator=this.audio.createOscillator();this.oscillator.type='triangle';this.oscillator.connect(this.gain);this.oscillator.start();}this.audio.resume().catch(()=>{});
 }
 silence(){if(this.gain)this.gain.gain.value=0;}
 sound(){
  if(!this.audio||document.hidden||!this.focused){this.silence();return;}
  const distances=this.units.filter(u=>!u.parked||u.parkedTime<C.LIGHT_RETIRE).map(u=>u.car.mesh.position.distanceTo(this.jimothy.position));
  const volume=Math.max(0,1-Math.min(Infinity,...distances)/C.SIREN_RANGE);this.gain.gain.value=volume*C.SIREN_GAIN;this.oscillator.frequency.value=THREE.MathUtils.lerp(C.SIREN_LOW,C.SIREN_HIGH,(Math.sin(this.time*C.SIREN_HZ*Math.PI*2)+1)/2);
 }
 radarContacts({player=this.jimothy.position,range=RADAR.MAX_RANGE,sampleSight=(_id,args)=>sightFan(...args)}={}){
  return this.units.filter(u=>!u.parked&&u.car.mesh.position.distanceTo(player)<range+this.sightRange()&&belowGround(this.voxels,u.car.mesh.position)===belowGround(this.voxels,player)).map(u=>{
   const p=u.car,at=p.mesh.position,r=this.sightRange();return{id:p.id,kind:'police-car',x:at.x,z:at.z,yaw:p.yaw,state:u.state,awareness:u.seen?1:0,sightRange:r,sight:sampleSight(`${p.id}:cone`,[this.voxels,at,p.yaw,r,C.CONE,false,C.EYE_HEIGHT,this.jimothy.radius]),searchRemaining:u.searchLeft,search:u.state==='search'?{...u.lastKnown,radius:C.SEARCH_RADIUS}:null};
  });
 }
 reset(){for(const u of [...this.units])this.remove(u);this.silence();this.serial=0;this.cooldown=0;this.time=0;}
 snapshot(){let rms=0;if(this.analyser){this.analyser.getFloatTimeDomainData(this.samples);rms=Math.sqrt(this.samples.reduce((s,x)=>s+x*x,0)/this.samples.length);}return{ready:this.ready,cars:this.units.map(u=>({id:u.car.id,model:u.car.model,state:u.state,seen:u.seen,lastKnown:u.lastKnown,searchLeft:u.searchLeft,speed:u.car.route?.speed,parked:u.parked,lights:u.lights.children.map(s=>s.material.opacity)})),rms};}
}
