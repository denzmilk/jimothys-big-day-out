import * as THREE from 'three';
import {MOMENTUM_ROLL as C,WORLD} from './Constants.js';

// M56 retains the controlled kinematic body from ADR-0002. This integrates
// its rolling momentum and orientation; terrain contact remains the controller's.
export class RollMotion {
 constructor(){
  this.orientation=new THREE.Quaternion();this.deltaRotation=new THREE.Quaternion();
  this.previous=new THREE.Vector3();this.normal=new THREE.Vector3(0,1,0);this.sample=new THREE.Vector3();
  this.travel=new THREE.Vector3();this.axis=new THREE.Vector3();this.spinVelocity=new THREE.Vector3();this.reset();
 }
 reset(){this.active=false;this.spin=0;this.previousRadius=0;this.spinVelocity.set(0,0,0);this.normal.set(0,1,0);}
 start(position,quaternion,yaw,radius){this.reset();this.active=true;this.previous.copy(position);this.orientation.copy(quaternion);this.heading=yaw;this.previousRadius=radius;}
 ground(world,position,radius,dt){
  if(!world)return;
  const probe=THREE.MathUtils.clamp(radius*C.PROBE_RATIO,C.PROBE_MIN,C.PROBE_MAX),y=position.y-radius+C.PROBE_SCAN;
  const h=(x,z)=>world.physicalGroundHeightAt(x,z,y);
  this.sample.set(h(position.x-probe,position.z)-h(position.x+probe,position.z),2*probe,h(position.x,position.z-probe)-h(position.x,position.z+probe)).normalize();
  this.normal.lerp(this.sample,1-Math.exp(-C.NORMAL_RESPONSE*dt)).normalize();
 }
 drive(velocity,dt,{x,z,speed,radius,held,grounded}){
  if(dt<=0)return;
  const input=Math.hypot(x,z);
  if(input>C.INPUT_DEADZONE&&held){
   const target=Math.atan2(x,z),difference=THREE.MathUtils.euclideanModulo(target-this.heading+Math.PI,Math.PI*2)-Math.PI;
   const turn=C.TURN_RATE/(1+radius*C.TURN_SIZE);
   this.heading+=THREE.MathUtils.clamp(difference,-turn*dt,turn*dt);
  }
  if(!grounded)return;
  const gx=WORLD.GRAVITY*C.GRAVITY_SHARE*this.normal.y*this.normal.x,gz=WORLD.GRAVITY*C.GRAVITY_SHARE*this.normal.y*this.normal.z;
  if(held){
   // Exponential motor response is consistent across render rates. Bounded
   // acceleration retains momentum through a sharp steering input.
   const response=(1-Math.exp(-C.RESPONSE*dt))/dt,limit=C.ACCEL_BASE+radius*C.ACCEL_RADIUS;
   let ax=(Math.sin(this.heading)*speed-velocity.x)*response,az=(Math.cos(this.heading)*speed-velocity.z)*response;
   const length=Math.hypot(ax,az);if(length>limit){ax*=limit/length;az*=limit/length;}
   velocity.x+=(ax+gx)*dt;velocity.z+=(az+gz)*dt;
  }else{
   velocity.x+=gx*dt;velocity.z+=gz*dt;
   const length=Math.hypot(velocity.x,velocity.z),brake=(C.BRAKE_BASE+radius*C.BRAKE_RADIUS)*dt;
   const keep=length?Math.max(0,1-brake/length):0;velocity.x*=keep;velocity.z*=keep;
  }
  const length=Math.hypot(velocity.x,velocity.z),max=speed*C.MAX_SPEED_RATIO;
  if(length>max){velocity.x*=max/length;velocity.z*=max/length;}
 }
 pose(quaternion,position,radius,dt,{rolling,grounded,recovering}){
  if(!this.active)return;
  if(rolling&&!recovering){
   this.travel.copy(position).sub(this.previous);this.travel.y-=radius-this.previousRadius;
   if(grounded&&dt>0){
    this.travel.projectOnPlane(this.normal);const distance=this.travel.length();
    if(distance>C.EPSILON&&distance<C.TELEPORT_DISTANCE+radius){
     this.axis.crossVectors(this.normal,this.travel).normalize();const angle=distance/radius;
     this.orientation.premultiply(this.deltaRotation.setFromAxisAngle(this.axis,angle)).normalize();
     this.spinVelocity.copy(this.axis).multiplyScalar(angle/dt);this.spin+=angle;
    }else this.spinVelocity.set(0,0,0);
   }else if(dt>0){
    const speed=this.spinVelocity.length();if(speed>C.EPSILON){this.axis.copy(this.spinVelocity).divideScalar(speed);this.orientation.premultiply(this.deltaRotation.setFromAxisAngle(this.axis,speed*dt)).normalize();this.spin+=speed*dt;}
   }
  }else if(dt>0){
   this.orientation.rotateTowards(quaternion,C.RECOVERY_TURN*dt);
   if(this.orientation.angleTo(quaternion)<C.RECOVERY_EPSILON){this.orientation.copy(quaternion);this.active=false;}
  }
  this.previous.copy(position);this.previousRadius=radius;quaternion.copy(this.orientation);
 }
}
