import {OCEAN as C} from './Constants.js';

const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const approach=(a,b,step)=>a+Math.max(-step,Math.min(step,b-a));

// JIM-90: facing and velocity use the same bounded turn. Smoothing only the
// mesh makes a frightened fish slide sideways through its own animation.
export class FishMotion {
 constructor(yaw,speed){this.yaw=yaw;this.speed=speed;this.fleeing=false;this.avoid=null;this.hold=0;}
 update(dt,{position:p,home,phase,swimmer,radius,large,depth,time,clear}){
  const distance=Math.hypot(p.x-swimmer.x,p.y-swimmer.y,p.z-swimmer.z),range=C.FLEE_RADIUS+radius;
  this.fleeing=distance<range+(this.fleeing?C.FLEE_HYSTERESIS:0);
  const dx=this.fleeing?p.x-swimmer.x:home.x+Math.sin(phase)*C.SCHOOL_RADIUS-p.x,dz=this.fleeing?p.z-swimmer.z:home.z+Math.cos(phase)*C.SCHOOL_RADIUS-p.z;
  let desired=Math.hypot(dx,dz)>C.FISH_DIRECTION_EPSILON?Math.atan2(dx,dz):this.yaw;
  const look=Math.max(C.FISH_LOOKAHEAD,this.speed*C.FISH_LOOK_SECONDS),probe=yaw=>{
   const steps=Math.ceil(look/C.FISH_PROBE_STEP);
   for(let i=1;i<=steps;i++)if(!clear(p.x+Math.sin(yaw)*look*i/steps,p.y,p.z+Math.cos(yaw)*look*i/steps,yaw))return false;
   return true;
  };
  this.hold=Math.max(0,this.hold-dt);
  if(this.avoid!==null&&this.hold>0&&probe(this.avoid))desired=this.avoid;
  else if(!probe(desired)){
   // Keep the chosen escape side briefly so alternating edge probes cannot
   // flip a fish left/right on every frame beside a wall or wreck.
   const side=this.avoid===null?1:Math.sign(angle(this.avoid-this.yaw))||1;
   const candidate=C.FISH_AVOID_ANGLES.map(a=>this.yaw+a*side).find(probe);
   desired=candidate??this.yaw+side*Math.PI;this.avoid=desired;this.hold=C.FISH_AVOID_HOLD;
  }else this.avoid=null;
  this.yaw+=Math.max(-C.FISH_TURN*dt,Math.min(C.FISH_TURN*dt,angle(desired-this.yaw)));
  const cruise=this.fleeing?C.FLEE_SPEED:large?C.LARGE_SPEED:C.FISH_SPEED;
  this.speed=approach(this.speed,probe(this.yaw)?cruise:0,C.FISH_ACCELERATION*dt);
  const x=p.x+Math.sin(this.yaw)*this.speed*dt,z=p.z+Math.cos(this.yaw)*this.speed*dt,y=approach(p.y,depth+Math.sin(time+phase)*C.FISH_BOB,C.FISH_VERTICAL_SPEED*dt);
  if(clear(x,y,z,this.yaw)){p.x=x;p.y=y;p.z=z;}
  else if(clear(x,p.y,z,this.yaw)){p.x=x;p.z=z;}
  else this.speed=0;
 }
}
