import {INFANTRY as C} from './Constants.js';

// A whole volley commits to the warning's aim point. Tracking between rounds
// would punish the dodge that M61 explicitly gives the player time to make.
export class RifleBurst {
 constructor(){this.phase='idle';this.time=0;this.target=null;this.rounds=0;}
 cancel(){this.phase='recover';this.time=0;this.target=null;this.rounds=0;}
 update(dt,{allowed=false,target}={}){
  const out={fire:false,target:null};
  if(!allowed){if(this.phase==='aim'||this.phase==='burst')this.cancel();}
  else if(this.phase==='idle'){this.phase='aim';this.time=0;this.rounds=0;this.target={x:target.x,y:target.y,z:target.z};}
  this.time+=dt;
  const fire=()=>{out.fire=true;out.target=this.target;this.rounds++;};
  if(this.phase==='aim'&&this.time>=C.GUN_WINDUP){this.time-=C.GUN_WINDUP;this.phase='burst';fire();}
  else if(this.phase==='burst'&&this.time>=C.BURST_INTERVAL){this.time-=C.BURST_INTERVAL;fire();if(this.rounds>=C.BURST_ROUNDS){this.phase='recover';this.time=0;}}
  else if(this.phase==='recover'&&this.time>=C.GUN_RECOVERY){this.phase='idle';this.time=0;}
  return out;
 }
}
