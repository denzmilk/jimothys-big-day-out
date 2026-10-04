import {DRIVING as C} from './Constants.js';

export function driveStep(speed,steer,input,dt){
  const throttle=Math.max(-1,Math.min(1,input.throttle));
  // A braking frame may reach zero, but cannot also accelerate backwards.
  const brake=input.handbrake||speed*throttle<0;
  if(brake||!throttle){const drag=(input.handbrake?C.HANDBRAKE:brake?C.BRAKE:C.COAST)*dt;speed=Math.sign(speed)*Math.max(0,Math.abs(speed)-drag);}
  else {
    const acceleration=Math.abs(throttle)*(throttle>0?C.ACCEL:C.REVERSE_ACCEL);
    let magnitude=Math.abs(speed),remaining=dt;
    // Integrate the low-gear curve exactly: ditch recovery must have the same
    // pull at 30 and 120 Hz, including the frame that leaves first gear (M53).
    if(magnitude<C.LOW_GEAR_SPEED){
      const limit=C.LOW_GEAR_SPEED*(1+1/C.LOW_GEAR_PULL),rate=acceleration*C.LOW_GEAR_PULL/C.LOW_GEAR_SPEED;
      const until=Math.log((limit-magnitude)/(limit-C.LOW_GEAR_SPEED))/rate,step=Math.min(remaining,until);
      magnitude=limit-(limit-magnitude)*Math.exp(-rate*step);remaining-=step;
    }
    speed=Math.sign(throttle)*Math.min(throttle>0?C.TOP_SPEED:C.REVERSE_SPEED,magnitude+acceleration*remaining);
  }
  const target=-input.steer*C.STEER/(1+Math.abs(speed)*C.STEER_FADE);
  steer+=(target-steer)*(1-Math.exp(-C.STEER_RATE*dt));
  return {speed:speed||0,steer};
}

export function boxesOverlap(a,b,pad=0){
  const axes=[a.yaw,b.yaw].flatMap(y=>[{x:Math.cos(y),z:-Math.sin(y)},{x:Math.sin(y),z:Math.cos(y)}]);
  for(const axis of axes){
    const extent=p=>Math.abs(axis.x*Math.cos(p.yaw)-axis.z*Math.sin(p.yaw))*p.half[0]+Math.abs(axis.x*Math.sin(p.yaw)+axis.z*Math.cos(p.yaw))*p.half[2];
    if(Math.abs((a.x-b.x)*axis.x+(a.z-b.z)*axis.z)>extent(a)+extent(b)+pad)return false;
  }
  return true;
}
