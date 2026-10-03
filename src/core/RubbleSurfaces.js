import * as CANNON from 'cannon-es';
import {RUBBLE as C} from './Constants.js';

// The voxel solver owns terrain. Walkers query nearby dynamic shapes separately
// so a resting wall can be a step without becoming an invisible terrain edit.
export class RubbleSurfaces {
 constructor(){this.buckets=new Map();this.local=new CANNON.Vec3();this.direction=new CANNON.Vec3();this.inverse=new CANNON.Quaternion();}
 rebuild(bodies){
  this.buckets.clear();
  for(const b of bodies){
   if(b.mass<C.SURFACE_MASS||b._ragdoll||b._player||!b.world)continue;
   b.updateAABB();const a=b.aabb;
   for(let x=Math.floor(a.lowerBound.x/C.GRID);x<=Math.floor(a.upperBound.x/C.GRID);x++)for(let z=Math.floor(a.lowerBound.z/C.GRID);z<=Math.floor(a.upperBound.z/C.GRID);z++){
    const key=`${x},${z}`;let list=this.buckets.get(key);if(!list)this.buckets.set(key,list=[]);list.push(b);
   }
  }
 }
 nearby(x,z){return this.buckets.get(`${Math.floor(x/C.GRID)},${Math.floor(z/C.GRID)}`)||[];}
 localPoint(b,i,x,y,z){
  b.quaternion.conjugate(this.inverse);this.local.set(x-b.position.x,y-b.position.y,z-b.position.z);this.inverse.vmult(this.local,this.local);this.local.vsub(b.shapeOffsets[i],this.local);
 }
 height(x,z,from,step,exclude){
  let height=-Infinity;
  for(const b of this.nearby(x,z)){
   if(!b.world||b===exclude||Math.abs(b.velocity.y)>C.FLOOR_SPEED)continue;
   for(let i=0;i<b.shapes.length;i++){
    const h=b.shapes[i].halfExtents;if(!h)continue;
    this.localPoint(b,i,x,from+step,z);this.inverse.vmult(new CANNON.Vec3(0,-1,0),this.direction);
    let near=-Infinity,far=Infinity;
    for(const axis of ['x','y','z']){
     const o=this.local[axis],d=this.direction[axis],extent=h[axis];
     if(Math.abs(d)<C.EPSILON){if(Math.abs(o)>extent){far=-Infinity;break;}continue;}
     const a=(-extent-o)/d,c=(extent-o)/d;near=Math.max(near,Math.min(a,c));far=Math.min(far,Math.max(a,c));
    }
    // A ray starting inside a wall cannot lift a walker onto its roof.
    if(near>=-C.SKIN&&near<=far)height=Math.max(height,from+step-Math.max(0,near));
   }
  }
  return height;
 }
 solid(x,y,z){
  for(const b of this.nearby(x,z))if(b.world)for(let i=0;i<b.shapes.length;i++){
   const h=b.shapes[i].halfExtents;if(!h)continue;this.localPoint(b,i,x,y,z);
   if(Math.abs(this.local.x)<h.x&&Math.abs(this.local.y)<h.y&&Math.abs(this.local.z)<h.z)return true;
  }
  return false;
 }
}
