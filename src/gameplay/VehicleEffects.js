import * as THREE from 'three';
import {DRIVING as C} from '../core/Constants.js';

// One bounded voice bank and one instanced layer; a rev never adds scene lights.
export class VehicleEffects {
  constructor(scene){
    this.particles=[];this.clock=0;this.voices=new Set();this.running=false;
    this.mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,...C.EFFECT_SEGMENTS),new THREE.MeshBasicMaterial({transparent:true,opacity:C.EFFECT_OPACITY,depthWrite:false}),C.EFFECT_LIMIT);
    this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.name='vehicle-exhaust-and-skids';scene.add(this.mesh);this.dummy=new THREE.Object3D();
    this.unlock=()=>this.init();window.addEventListener('keydown',this.unlock);window.addEventListener('pointerdown',this.unlock);
    window.addEventListener('blur',()=>this.silence());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.silence();});
  }
  init(){
    if(!this.audio){
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      this.audio=new Audio();this.master=this.audio.createGain();this.master.gain.value=C.AUDIO_GAIN;
      this.analyser=this.audio.createAnalyser();this.analyser.fftSize=C.AUDIO_FFT;this.samples=new Float32Array(C.AUDIO_FFT);const limiter=this.audio.createDynamicsCompressor();limiter.threshold.value=C.AUDIO_COMPRESS_THRESHOLD;limiter.ratio.value=C.AUDIO_COMPRESS_RATIO;this.master.connect(limiter);limiter.connect(this.analyser);this.analyser.connect(this.audio.destination);
      this.engine=this.audio.createOscillator();this.engine.type='sawtooth';this.engineGain=this.audio.createGain();this.engineGain.gain.value=0;this.engine.connect(this.engineGain);this.engineGain.connect(this.master);this.engine.start();
      const buffer=this.audio.createBuffer(1,this.audio.sampleRate*C.AUDIO_NOISE_SECONDS,this.audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      this.skid=this.audio.createBufferSource();this.skid.buffer=buffer;this.skid.loop=true;const filter=this.audio.createBiquadFilter();filter.type='highpass';filter.frequency.value=C.CUE_HZ.horn;
      this.skidGain=this.audio.createGain();this.skidGain.gain.value=0;this.skid.connect(filter);filter.connect(this.skidGain);this.skidGain.connect(this.master);this.skid.start();
    }
    this.audio.resume().catch(()=>{});
  }
  cue(kind){
    if(!this.audio||this.audio.state!=='running'||this.voices.size>=C.AUDIO_VOICES)return;
    const t=this.audio.currentTime,seconds=C.CUE_DURATIONS[kind],o=this.audio.createOscillator(),gain=this.audio.createGain();o.type=kind==='horn'?'square':'triangle';o.frequency.setValueAtTime(C.CUE_HZ[kind],t);o.frequency.exponentialRampToValueAtTime(C.CUE_HZ[kind]/2,t+seconds);
    gain.gain.setValueAtTime(C.CUE_GAIN[kind],t);gain.gain.exponentialRampToValueAtTime(C.AUDIO_FLOOR,t+seconds);o.connect(gain);gain.connect(this.master);this.voices.add(o);
    let noise,filter;
    if(['door','start','crash'].includes(kind)){noise=this.audio.createBufferSource();noise.buffer=this.skid.buffer;filter=this.audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=C.CRASH_NOISE_HZ;noise.connect(filter);filter.connect(gain);noise.start();noise.stop(t+seconds);}
    o.onended=()=>{o.disconnect();noise?.disconnect();filter?.disconnect();gain.disconnect();this.voices.delete(o);};o.start();o.stop(t+seconds);
  }
  engineSound(active,speed,skid){
    this.running=!!active&&this.audio?.state==='running';if(!this.audio)return;const t=this.audio.currentTime;
    this.engine.frequency.setTargetAtTime(C.ENGINE_HZ+Math.abs(speed)*C.ENGINE_RPM,t,C.AUDIO_RAMP);
    this.engineGain.gain.setTargetAtTime(this.running?C.ENGINE_GAIN:0,t,C.AUDIO_RAMP);this.skidGain.gain.setTargetAtTime(this.running&&skid?C.SKID_GAIN:0,t,C.AUDIO_RAMP);
  }
  silence(){this.engineSound(false,0,false);if(this.audio){this.engineGain.gain.cancelScheduledValues(this.audio.currentTime);this.engineGain.gain.value=0;this.skidGain.gain.cancelScheduledValues(this.audio.currentTime);this.skidGain.gain.value=0;}for(const o of this.voices){try{o.stop();}catch{}}}
  emit(at,color,count=1){for(let i=0;i<count&&this.particles.length<C.EFFECT_LIMIT;i++)this.particles.push({at:at.clone(),age:0,color,dx:Math.sin(i)*C.EFFECT_RISE,dz:Math.cos(i)*C.EFFECT_RISE});}
  update(dt,car,speed,skid){
    this.clock+=dt;if(car&&this.clock>=C.EFFECT_INTERVAL){this.clock=0;car.mesh.updateWorldMatrix(true,false);this.emit(car.mesh.localToWorld(new THREE.Vector3(car.half[0]/2,-car.half[1]/2,-car.half[2])),C.EXHAUST_COLOR);if(skid)for(const side of [-1,1])this.emit(car.mesh.localToWorld(new THREE.Vector3(car.half[0]*side,-car.half[1],-car.half[2]/2)),C.SKID_COLOR);}
    this.particles=this.particles.filter(p=>{p.age+=dt;p.at.y+=dt*C.EFFECT_RISE;p.at.x+=dt*p.dx;p.at.z+=dt*p.dz;return p.age<C.EFFECT_LIFE;});
    this.mesh.count=this.particles.length;this.particles.forEach((p,i)=>{this.dummy.position.copy(p.at);this.dummy.scale.setScalar(C.EFFECT_SIZE*(1+p.age)*(1-p.age/C.EFFECT_LIFE));this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);this.mesh.setColorAt(i,new THREE.Color(p.color));});this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
  }
  reset(){this.silence();this.particles=[];this.mesh.count=0;this.clock=0;}
  audioSnapshot(){let rms=0;if(this.analyser){this.analyser.getFloatTimeDomainData(this.samples);rms=Math.sqrt(this.samples.reduce((s,x)=>s+x*x,0)/this.samples.length);}return {running:this.running,voices:this.voices.size,rms};}
}
