import {BODY_CONTACT as C} from './Constants.js';

export const pushingMass=fatness=>C.BASE_MASS+Math.max(0,fatness)*C.MASS_PER_FAT;
export const canPush=(fatness,mass,ratio)=>pushingMass(fatness)>=mass*ratio;

// Sweeping the proposed step catches a car's nose as well as its side, and
// cannot tunnel through a person when a frame takes longer than usual.
export function restrictMotion(m, obstacle){
  if(m.dt<=0)return false;
  const yaw=obstacle.yaw||0,s=Math.sin(yaw),c=Math.cos(yaw);
  const dx=m.position.x-obstacle.position.x,dz=m.position.z-obstacle.position.z;
  const x=dx*c-dz*s,z=dx*s+dz*c;
  const vx=m.velocity.x*c-m.velocity.z*s,vz=m.velocity.x*s+m.velocity.z*c;
  const tx=vx*m.dt,tz=vz*m.dt;
  if(tx*tx+tz*tz<C.EPSILON*C.EPSILON)return false;
  let t=0,nx=0,nz=0;
  if(obstacle.radius!==undefined){
    const r=m.radius+obstacle.radius+C.SKIN,a=tx*tx+tz*tz,b=x*tx+z*tz,d=x*x+z*z-r*r;
    if(d>0){
      const discriminant=b*b-a*d;
      if(b>=0||discriminant<0)return false;
      t=(-b-Math.sqrt(discriminant))/a;if(t<0||t>1)return false;
    }
    const hx=x+tx*t,hz=z+tz*t,length=Math.hypot(hx,hz);
    if(length>C.EPSILON){nx=hx/length;nz=hz/length;}
    else {const length=Math.hypot(tx,tz);nx=-tx/length;nz=-tz/length;}
  }else{
    const hx=obstacle.half[0]+m.radius+C.SKIN,hz=obstacle.half[2]+m.radius+C.SKIN;
    if(Math.abs(x)<hx&&Math.abs(z)<hz){
      if(hx-Math.abs(x)<hz-Math.abs(z))nx=Math.sign(x)||-Math.sign(tx);
      else nz=Math.sign(z)||-Math.sign(tz);
    }else{
      let enter=-Infinity,leave=Infinity;
      for(const [p,v,h,axis] of [[x,tx,hx,0],[z,tz,hz,1]]){
        if(Math.abs(v)<C.EPSILON){if(Math.abs(p)>h)return false;continue;}
        const a=(-h-p)/v,b=(h-p)/v,near=Math.min(a,b),far=Math.max(a,b);
        if(near>enter){enter=near;nx=axis===0?-Math.sign(v):0;nz=axis===1?-Math.sign(v):0;}
        leave=Math.min(leave,far);
      }
      if(enter>leave||leave<0||enter<0||enter>1)return false;t=enter;
    }
  }
  const y=m.position.y+m.velocity.y*m.dt*t;
  if(y+m.radius<=obstacle.bottom||y-m.radius>=obstacle.top)return false;
  const inward=vx*nx+vz*nz;if(inward>=0)return false;
  const normalX=nx*c+nz*s,normalZ=-nx*s+nz*c;
  m.velocity.x-=normalX*inward*(1-t);m.velocity.z-=normalZ*inward*(1-t);
  m.blocked=true;m.id=obstacle.id;
  return true;
}
