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
 stop(){for(const voice of [...this.voices]){try{voice.oscillator.stop();}catch{}this.remove(voice);}}
 snapshot(){let rms=0;if(this.analyser){this.analyser.getFloatTimeDomainData(this.samples);rms=Math.sqrt(this.samples.reduce((sum,x)=>sum+x*x,0)/this.samples.length);}return{voices:this.voices.size,rms};}
}
