import {POLICE as C} from './Constants.js';

// Only observed coordinates may replace this memory. Dispatch and a finite
// search do not grant patrols the hidden player's position (M60).
export function rememberPoliceTarget(unit,dt,seen){
 if(seen){unit.lastKnown={x:seen.x,z:seen.z};unit.searchLeft=C.SEARCH_SECONDS;unit.state='chase';}
 else{unit.searchLeft=Math.max(0,unit.searchLeft-dt);unit.state=unit.searchLeft>0?'search':'patrol';}
}

export class GunAttack {
 constructor(){this.phase='idle';this.time=0;this.target=null;}
 cancel(){this.phase='recover';this.time=0;this.target=null;}
 update(dt,{allowed=false,target}={}){
  const out={fire:false,target:null};
  if(!allowed){if(this.phase==='aim')this.cancel();}
  else if(this.phase==='idle'){this.phase='aim';this.time=0;this.target={x:target.x,y:target.y,z:target.z};}
  this.time+=dt;
  if(this.phase==='aim'&&this.time>=C.GUN_WINDUP){out.fire=true;out.target=this.target;this.phase='recover';this.time=0;}
  else if(this.phase==='recover'&&this.time>=C.GUN_RECOVERY){this.phase='idle';this.time=0;}
  return out;
 }
}
