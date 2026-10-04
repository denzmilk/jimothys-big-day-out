import {TOOLS as C} from './Constants.js';

// M63 shares one bounded graph across the tool catalogue; supply cues and
// later tool families must not create an AudioContext for each pickup.
export class ToolAudio {
 constructor(listener){
  this.listener=listener;this.voices=new Set();
  this.onUnlock=()=>this.unlock();this.onBlur=()=>this.stop();
  window.addEventListener('keydown',this.onUnlock);window.addEventListener('pointerdown',this.onUnlock);
  window.addEventListener('blur',this.onBlur);document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});
 }
 async unlock(){
  if(!this.context){
   const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
   this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=C.AUDIO_GAIN;
   const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=C.AUDIO_THRESHOLD;limiter.knee.value=C.AUDIO_KNEE;limiter.ratio.value=C.AUDIO_RATIO;
   this.analyser=this.context.createAnalyser();this.analyser.fftSize=C.AUDIO_FFT;this.samples=new Float32Array(C.AUDIO_FFT);
   this.master.connect(limiter);limiter.connect(this.analyser);this.analyser.connect(this.context.destination);
   this.noise=this.context.createBuffer(1,this.context.sampleRate*C.FLOW_AUDIO_NOISE_SECONDS,this.context.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  }
  try{await this.context.resume();}catch{/* An unavailable output device must not block gameplay. */}
 }
 play(kind,position){
  const profile=C.AUDIO_CUES[kind],context=this.context;if(!profile||context?.state!=='running'||this.voices.size>=C.AUDIO_VOICES)return;
  const at=this.listener(),distance=Math.hypot(position.x-at.x,position.y-at.y,position.z-at.z),volume=Math.max(0,1-distance/C.AUDIO_RANGE);if(!volume)return;
  const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
  oscillator.type=profile.wave;oscillator.frequency.setValueAtTime(profile.hz,now);oscillator.frequency.exponentialRampToValueAtTime(profile.end,now+profile.seconds);
  gain.gain.setValueAtTime(C.AUDIO_FLOOR,now);gain.gain.linearRampToValueAtTime(volume,now+C.AUDIO_ATTACK);gain.gain.exponentialRampToValueAtTime(C.AUDIO_FLOOR,now+profile.seconds);
  oscillator.connect(gain);gain.connect(this.master);const voice={oscillator,gain};this.voices.add(voice);
  oscillator.onended=()=>this.remove(voice);oscillator.start();oscillator.stop(now+profile.seconds);
 }
 remove(voice){voice.oscillator.disconnect();voice.gain.disconnect();this.voices.delete(voice);}
 sustain(mode,position){
  const context=this.context,profile=C.AUDIO_FLOWS[mode];if(!profile||context?.state!=='running')return;
  if(this.loop?.mode!==mode){
   this.stopFlow();this.play(`${mode}-start`,position);
   const oscillator=context.createOscillator(),noise=context.createBufferSource(),filter=context.createBiquadFilter(),tone=context.createGain(),gain=context.createGain();
   oscillator.type=profile.wave;oscillator.frequency.value=profile.hz;noise.buffer=this.noise;noise.loop=true;filter.type='lowpass';filter.frequency.value=profile.cutoff;tone.gain.value=C.FLOW_AUDIO_OSC_SHARE;gain.gain.value=0;
   oscillator.connect(tone);tone.connect(gain);noise.connect(filter);filter.connect(gain);gain.connect(this.master);oscillator.start();noise.start();this.loop={mode,oscillator,noise,filter,tone,gain,position};
  }
  const at=this.listener(),volume=Math.max(0,1-Math.hypot(position.x-at.x,position.y-at.y,position.z-at.z)/C.AUDIO_RANGE);
  this.loop.position=position;this.loop.gain.gain.setTargetAtTime(volume*C.FLOW_AUDIO_GAIN,context.currentTime,C.FLOW_AUDIO_ATTACK);
 }
 stopFlow(tail=true){const loop=this.loop;if(!loop)return;this.loop=null;loop.oscillator.stop();loop.noise.stop();for(const node of [loop.oscillator,loop.noise,loop.filter,loop.tone,loop.gain])node.disconnect();if(tail)this.play(`${loop.mode}-end`,loop.position);}
 stop(){this.stopFlow(false);for(const voice of [...this.voices]){try{voice.oscillator.stop();}catch{}this.remove(voice);}}
 snapshot(){let rms=0;if(this.analyser){this.analyser.getFloatTimeDomainData(this.samples);rms=Math.sqrt(this.samples.reduce((sum,x)=>sum+x*x,0)/this.samples.length);}return{voices:this.voices.size,loops:this.loop?1:0,rms};}
}
