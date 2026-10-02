import * as THREE from 'three';
import {COMET as C,CAMERA} from '../core/Constants.js';
import {gameState} from '../core/GameState.js';
import {eventBus,Events} from '../core/EventBus.js';

const transitions={waiting:{ready:'falling'},falling:{contact:'impact'},impact:{settled:'done'},done:{}};

// Milestone 39: an authored entrance owns the pose briefly. Damage still goes
// through the normal bounded voxel queue; its cinematic scale is all effects.
export class CometArrival {
  constructor(scene,camera,jimothy,voxels,ready){
    Object.assign(this,{camera,jimothy,voxels,ready});
    this.trail=[];this.trailClock=0;this.age=Infinity;this.soundNodes=[];
    this.point=new THREE.Vector3();this.dummy=new THREE.Object3D();
    this.color=new THREE.Color();this.hot=new THREE.Color(C.CORE_COLOR);
    this.kick=new THREE.Quaternion();this.euler=new THREE.Euler();
    const pixels=new Uint8Array(C.TEXTURE_SIZE*C.TEXTURE_SIZE*4);
    for(let y=0;y<C.TEXTURE_SIZE;y++)for(let x=0;x<C.TEXTURE_SIZE;x++){
      const r=Math.hypot((x+.5)/C.TEXTURE_SIZE*2-1,(y+.5)/C.TEXTURE_SIZE*2-1),i=(x+y*C.TEXTURE_SIZE)*4;
      pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(255*Math.max(0,1-r*r)**2);
    }
    this.texture=new THREE.DataTexture(pixels,C.TEXTURE_SIZE,C.TEXTURE_SIZE);this.texture.needsUpdate=true;
    this.layers={};
    for(const [name,count,additive]of [['fire',C.FIRE_COUNT,true],['trail',C.TRAIL_COUNT,true],['wake',C.TRAIL_COUNT,false],['dust',C.DUST_COUNT,false]]){
      const geometry=new THREE.PlaneGeometry(1,1),alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1);geometry.setAttribute('particleAlpha',alpha);
      const material=new THREE.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false});
      material.onBeforeCompile=shader=>{
        shader.vertexShader='attribute float particleAlpha; varying float vParticleAlpha;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvParticleAlpha=particleAlpha;');
        shader.fragmentShader='varying float vParticleAlpha;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vParticleAlpha;');
      };
      const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=`comet-${name}`;mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=additive?2:1;
      for(let i=0;i<count;i++)mesh.setColorAt(i,new THREE.Color(additive?C.FIRE_COLOR:C.SMOKE_COLOR));
      scene.add(mesh);this.layers[name]={mesh,alpha};
    }
    this.ring=new THREE.Mesh(new THREE.RingGeometry(1-C.SHOCK_WIDTH,1,C.RING_SEGMENTS),new THREE.MeshBasicMaterial({color:C.SHOCK_COLOR,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}));
    this.ring.name='comet-shockwave';
    this.ring.rotation.x=-Math.PI/2;this.ring.visible=false;scene.add(this.ring);
    // Keep the light registered between runs: changing the light count caused
    // a multi-second world shader stall for explosions (JIM-64).
    this.light=new THREE.PointLight(C.FIRE_COLOR,0,C.LIGHT_DISTANCE);this.light.name='comet-light';scene.add(this.light);
    this.flash=document.createElement('div');this.flash.className='comet-flash';this.flash.style.background=this.hot.getStyle();document.body.appendChild(this.flash);
    this.unlock=()=>{
      this.audio??=new AudioContext();this.audio.resume().then(()=>{if(gameState.arrival.phase==='falling')this.rush();}).catch(()=>{});
    };
    window.addEventListener('pointerdown',this.unlock);window.addEventListener('keydown',this.unlock);
  }

  get active(){return gameState.arrival.phase!=='done';}

  transition(event){
    const s=gameState.arrival,next=transitions[s.phase]?.[event];
    if(!next){console.warn(`Arrival ignores ${event} while ${s.phase}`);return false;}
    s.phase=next;s.time=0;return true;
  }

  reset(){
    this.stopSound();this.trail.length=0;this.trailClock=0;this.age=Infinity;this.rushStarted=false;
    this.ground=this.voxels.groundHeightAt(0,0,this.voxels.terrainHeightAt(0,0)+C.CRATER_RADIUS);
    gameState.arrival={phase:window.__SKIP_ARRIVAL__?'done':'waiting',time:0,ground:this.ground,impacts:0,pitch:0,tuck:0};
    gameState.game.isPlaying=!this.active;this.jimothy.group.visible=!this.active;
    this.camera.fov=CAMERA.FOV;this.camera.updateProjectionMatrix();
    this.light.intensity=0;this.ring.visible=false;this.flash.style.opacity='0';
    for(const layer of Object.values(this.layers))layer.mesh.count=0;
  }

  pose(t){
    const fall=1-Math.pow(t,C.ACCEL_POWER),s=gameState.arrival;
    this.point.set(C.OFFSET[0]*fall,this.ground+C.HEIGHT*fall,C.OFFSET[1]*fall);
    s.pitch=C.PITCH+Math.sin(t*C.TUMBLE_RATE)*C.TUMBLE;s.tuck=C.TUCK;
    eventBus.emit(Events.SPAWN_POSE,{position:this.point,grounded:false});
  }

  update(dt){
    const s=gameState.arrival;
    if(s.phase==='waiting'){
      if(!this.ready())return;
      this.transition('ready');this.jimothy.group.visible=true;this.pose(0);this.rush();
    }
    if(s.phase==='falling'){
      s.time=Math.min(C.FALL_SECONDS,s.time+dt);this.pose(s.time/C.FALL_SECONDS);
      this.trailClock+=dt;
      while(this.trailClock>=C.TRAIL_INTERVAL){
        this.trailClock-=C.TRAIL_INTERVAL;
        if(this.trail.length===C.TRAIL_COUNT)this.trail.shift();
        this.trail.push({x:this.point.x,y:this.point.y+C.FIRE_HEIGHT,z:this.point.z,age:0});
      }
      if(s.time>=C.FALL_SECONDS){
        this.transition('contact');s.pitch=0;s.tuck=0;s.impacts++;this.age=0;
        this.stopSound();this.boom();
        eventBus.emit(Events.SPAWN_IMPACT,{x:0,y:this.ground,z:0});
        eventBus.emit(Events.EXPLOSION_SPAWN,{x:0,y:this.ground,z:0,radius:C.EXPLOSION_RADIUS});
        eventBus.emit(Events.WORLD_IMPACT,{x:0,y:this.ground,z:0,radius:C.IMPACT_RADIUS});
      }
    }else if(s.phase==='impact'){
      s.time+=dt;
      // The physical feet track the newly excavated surface while dust hides
      // the short settle. A finished camera beat cannot outrun terrain work.
      const y=this.voxels.groundHeightAt(0,0,this.ground+C.CRATER_RADIUS);
      eventBus.emit(Events.SPAWN_POSE,{position:this.point.set(0,y,0),grounded:true});
      if(s.time>=C.RECOVER_SECONDS&&!this.voxels.damageQueue.length){
        this.transition('settled');gameState.game.isPlaying=true;
        eventBus.emit(Events.SPAWN_COMPLETE);
      }
    }
    if(Number.isFinite(this.age)){
      this.age+=dt;
      // Audio clocks can stop progressing in a suspended tab or a stepped
      // simulation. The entrance's lifetime still owns its sound resources.
      if(this.age>=C.BOOM_SECONDS&&this.soundNodes.length)this.stopSound();
    }
    for(const p of this.trail)p.age+=dt;
    this.trail=this.trail.filter(p=>p.age<C.TRAIL_LIFE);
  }

  cameraPose(){
    const s=gameState.arrival;if(!this.active)return false;
    if(s.phase==='waiting')return true;
    const p=this.jimothy.position;
    if(s.phase==='falling'){
      this.camera.position.set(p.x+C.CAMERA_FALL[0],p.y+C.CAMERA_FALL[1],p.z+C.CAMERA_FALL[2]);
      this.camera.lookAt(p.x,p.y+C.CAMERA_LOOK,p.z);
      this.camera.fov=CAMERA.FOV+C.FOV_RUSH*s.time/C.FALL_SECONDS;
    }else{
      const t=THREE.MathUtils.smoothstep(s.time/C.RECOVER_SECONDS,0,1);
      this.camera.position.set(C.CAMERA_IMPACT[0]*(1-t),p.y+THREE.MathUtils.lerp(C.CAMERA_IMPACT[1],CAMERA.FOLLOW_HEIGHT,t),THREE.MathUtils.lerp(C.CAMERA_IMPACT[2],CAMERA.FOLLOW_DISTANCE,t));
      this.camera.lookAt(p.x,p.y+CAMERA.LOOK_HEIGHT,p.z);
      const shake=Math.max(0,1-s.time/C.SHAKE_SECONDS)*C.SHAKE,phase=s.time*C.SHAKE_RATE;
      this.euler.set(Math.sin(phase)*shake,Math.cos(phase)*shake,Math.sin(phase/2)*shake);
      this.camera.quaternion.multiply(this.kick.setFromEuler(this.euler));
      this.camera.fov=CAMERA.FOV+C.FOV_IMPACT*(1-t);
    }
    this.camera.updateProjectionMatrix();return true;
  }

  particle(layer,index,x,y,z,size,color,opacity){
    this.dummy.position.set(x,y,z);this.dummy.quaternion.copy(this.camera.quaternion);this.dummy.scale.setScalar(size);this.dummy.updateMatrix();
    layer.mesh.setMatrixAt(index,this.dummy.matrix);layer.mesh.setColorAt(index,color);layer.alpha.setX(index,opacity);
  }

  afterCamera(){
    const s=gameState.arrival,falling=s.phase==='falling',p=this.jimothy.position;
    const fire=this.layers.fire,trail=this.layers.trail,wake=this.layers.wake,dust=this.layers.dust;
    fire.mesh.count=falling?C.FIRE_COUNT:0;
    for(let i=0;i<fire.mesh.count;i++){
      const f=(i+.5)/C.FIRE_COUNT,a=i*Math.PI*(3-Math.sqrt(5))+s.time*C.FIRE_FLICKER;
      const ember=i<C.EMBERS,radius=(ember?C.EMBER_RADIUS:C.FIRE_RADIUS)*Math.sqrt(f),rise=ember?f*C.EMBER_RISE:Math.sin(a)*radius;
      this.color.set(C.FIRE_COLOR).lerp(this.hot,C.CORE_MIX*(1-f));
      this.particle(fire,i,p.x+Math.cos(a)*radius,p.y+C.FIRE_HEIGHT+rise,p.z+Math.sin(a*2)*radius,ember?C.EMBER_SIZE:C.FIRE_SIZE*(1-f/2),this.color,ember?1:C.FIRE_OPACITY);
    }
    trail.mesh.count=this.trail.length;wake.mesh.count=this.trail.length;
    for(const [i,q]of this.trail.entries()){
      const t=q.age/C.TRAIL_LIFE;this.color.set(C.FIRE_COLOR).lerp(this.hot,C.CORE_MIX*(1-t)**2);
      this.particle(trail,i,q.x,q.y+q.age*C.TRAIL_DRIFT,q.z,C.TRAIL_SIZE*(1+t),this.color,C.TRAIL_OPACITY*(1-t)**2);
      this.color.set(C.SMOKE_COLOR);
      this.particle(wake,i,q.x+Math.sin(i)*t,q.y+q.age*C.TRAIL_DRIFT,q.z+Math.cos(i)*t,C.WAKE_SIZE+q.age*C.WAKE_GROWTH,this.color,C.WAKE_OPACITY*Math.sin(t*Math.PI));
    }
    dust.mesh.count=this.age<C.DUST_LIFE?C.DUST_COUNT:0;
    const t=this.age/C.DUST_LIFE;
    for(let i=0;i<dust.mesh.count;i++){
      const f=(i+.5)/C.DUST_COUNT,a=i*Math.PI*(3-Math.sqrt(5)),radius=(C.CRATER_RADIUS+this.age*C.DUST_SPEED)*Math.sqrt(f);
      const x=Math.cos(a)*radius,z=Math.sin(a)*radius,y=this.voxels.terrainHeightAt(x,z)+C.DUST_RISE*this.age*(1-f/2);
      this.color.set(C.SMOKE_COLOR);
      this.particle(dust,i,x,y,z,C.DUST_SIZE*(1+this.age),this.color,C.DUST_OPACITY*(1-t)**2);
    }
    for(const l of Object.values(this.layers)){l.mesh.instanceMatrix.needsUpdate=true;l.mesh.instanceColor.needsUpdate=true;l.alpha.needsUpdate=true;}
    const shock=Math.min(1,this.age/C.SHOCK_SECONDS);this.ring.visible=shock<1;
    if(this.ring.visible){this.ring.position.set(0,this.ground+C.SHOCK_HEIGHT,0);this.ring.scale.setScalar(C.SHOCK_RADIUS*shock);this.ring.material.opacity=(1-shock)**2;}
    this.light.intensity=falling?C.LIGHT_INTENSITY:Math.max(0,1-this.age/C.FLASH_SECONDS)*C.LIGHT_INTENSITY;
    this.light.position.set(p.x,p.y+C.FIRE_HEIGHT,p.z);
    this.flash.style.opacity=String(Math.max(0,1-this.age/C.FLASH_SECONDS)*C.FLASH_OPACITY);
  }

  noise(seconds,cutoff,endCutoff,volume,swelling=false){
    const ctx=this.audio,now=ctx.currentTime,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*C.NOISE_SECONDS),ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;source.loop=true;
    filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,now);filter.frequency.exponentialRampToValueAtTime(endCutoff,now+seconds);
    if(swelling){gain.gain.setValueAtTime(C.AUDIO_FLOOR,now);gain.gain.exponentialRampToValueAtTime(volume,now+seconds);}
    else{gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume,now+C.AUDIO_FADE);gain.gain.exponentialRampToValueAtTime(C.AUDIO_FLOOR,now+seconds);}
    source.connect(filter).connect(gain).connect(ctx.destination);this.soundNodes.push(source);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.soundNodes=this.soundNodes.filter(n=>n!==source);};source.start();source.stop(now+seconds);
  }

  rush(){
    if(!this.audio||this.audio.state!=='running'||this.rushStarted)return;
    this.rushStarted=true;this.noise(Math.max(C.AUDIO_FADE*2,C.FALL_SECONDS-gameState.arrival.time),C.RUSH_HZ,C.RUSH_END_HZ,C.SOUND_VOLUME,true);
  }

  boom(){
    if(!this.audio||this.audio.state!=='running')return;
    this.noise(C.BOOM_SECONDS,C.RUSH_END_HZ,C.RUSH_HZ,C.SOUND_VOLUME);
    const ctx=this.audio,now=ctx.currentTime,source=ctx.createOscillator(),gain=ctx.createGain();source.type='sine';
    source.frequency.setValueAtTime(C.BOOM_HZ,now);source.frequency.exponentialRampToValueAtTime(C.BOOM_END_HZ,now+C.BOOM_SECONDS);
    gain.gain.setValueAtTime(C.SOUND_VOLUME,now);gain.gain.exponentialRampToValueAtTime(C.AUDIO_FLOOR,now+C.BOOM_SECONDS);
    source.connect(gain).connect(ctx.destination);this.soundNodes.push(source);source.onended=()=>{source.disconnect();gain.disconnect();this.soundNodes=this.soundNodes.filter(n=>n!==source);};source.start();source.stop(now+C.BOOM_SECONDS);
  }

  stopSound(){
    // Release the filter/gain chain too, even if the browser never advances
    // the audio clock far enough to dispatch the scheduled ended callback.
    for(const source of this.soundNodes){source.stop();source.onended?.();source.onended=null;}
    this.soundNodes=[];
  }
  snapshot(){return{...gameState.arrival,fire:this.layers.fire.mesh.count,trail:this.layers.trail.mesh.count,wake:this.layers.wake.mesh.count,dust:this.layers.dust.mesh.count,shockwave:this.ring.visible?this.ring.scale.x:0,audio:this.audio?.state||'locked',soundNodes:this.soundNodes.length};}
}
