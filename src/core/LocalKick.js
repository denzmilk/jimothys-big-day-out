import {LOCAL_RESPONSE as C} from './Constants.js';

// One resolved contact per committed swing, including misses. This keeps a
// dodged kick from becoming a hit when Jimothy returns during recovery (M59).
export class LocalKick {
 constructor(){this.phase='idle';this.time=0;this.cooldown=0;this.heading=0;this.resolved=false;}
 get busy(){return this.phase!=='idle';}
 cancel(){this.phase='idle';this.time=0;this.cooldown=C.COOLDOWN;this.resolved=false;}
 update(dt,{canStart=false,canHit=false,yaw=0}={}){
  const result={started:false,swish:false,hit:false,finished:false};this.cooldown=Math.max(0,this.cooldown-dt);
  if(!this.busy){if(!canStart||this.cooldown>0)return result;this.phase='windup';this.time=0;this.heading=yaw;this.resolved=false;result.started=true;}
  this.time+=dt;
  if(this.phase==='windup'&&this.time>=C.WINDUP){this.time-=C.WINDUP;this.phase='strike';result.swish=true;}
  if(this.phase==='strike'){
   if(!this.resolved&&this.time>=C.CONTACT){this.resolved=true;result.hit=canHit;}
   if(this.time>=C.STRIKE){this.time-=C.STRIKE;this.phase='recovery';}
  }
  if(this.phase==='recovery'&&this.time>=C.RECOVERY){this.cancel();result.finished=true;}
  return result;
 }
}
