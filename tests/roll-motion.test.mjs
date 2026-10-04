import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {RollMotion} from '../src/core/RollMotion.js';
const eps=1e-6;
test('rolling orientation follows contact distance around corners, and reverses with travel',()=>{
 const m=new RollMotion(),p=new T.Vector3(),q=new T.Quaternion();m.start(p,q,0,3);
 p.z=3;m.pose(q,p,3,1,{rolling:true,grounded:true});assert.ok(q.angleTo(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),1))<eps);
 const before=q.clone();p.x=3;m.pose(q,p,3,1,{rolling:true,grounded:true});const expected=before.clone().premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,-1),1));assert.ok(q.angleTo(expected)<eps);
 p.x=0;m.pose(q,p,3,1,{rolling:true,grounded:true});assert.ok(q.angleTo(before)<eps);
 const stopped=q.clone();m.pose(q,p,3,1,{rolling:true,grounded:true});assert.ok(q.angleTo(stopped)<eps);
});
test('airborne rolls retain angular momentum; growth and zero-time inspection add no spin',()=>{
 const m=new RollMotion(),p=new T.Vector3(),q=new T.Quaternion();m.start(p,q,0,3);p.z=1;m.pose(q,p,3,.1,{rolling:true,grounded:true});
 const before=q.clone();p.y+=2;m.pose(q,p,3,.1,{rolling:true,grounded:false});assert.ok(Math.abs(q.angleTo(before)-1/3)<eps);
 m.pose(q,p,3,.1,{rolling:true,grounded:true});const still=q.clone();p.y+=1;m.pose(q,p,4,0,{rolling:true,grounded:true});assert.ok(q.angleTo(still)<eps);
 m.pose(q,p,4,.1,{rolling:true,grounded:true});assert.ok(q.angleTo(still)<eps);m.reset();assert.equal(m.active,false);
});
test('steering turns momentum gradually, with consistent speed at 30, 60 and 120 Hz',()=>{
 const rows=[];for(const hz of [30,60,120]){
  const m=new RollMotion(),v=new T.Vector3(0,0,12);m.start(new T.Vector3(),new T.Quaternion(),0,6);
  m.drive(v,1/hz,{x:1,z:0,speed:12,radius:6,held:true,grounded:true});assert.ok(v.z>11);assert.ok(v.x<1);
  for(let i=1;i<hz;i++)m.drive(v,1/hz,{x:1,z:0,speed:12,radius:6,held:true,grounded:true});rows.push(v.clone());assert.ok(v.x>8);assert.ok(v.z<5);
 }
 for(const v of rows)assert.ok(v.distanceTo(rows[1])<.3);
});
test('release settles the stored orientation without a single-frame upright snap',()=>{
 const m=new RollMotion(),p=new T.Vector3(),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),2.5);m.start(p,q,0,3);let previous=q.clone();
 for(let i=0;i<30;i++){q.identity();m.pose(q,p,3,1/30,{rolling:false,grounded:true,recovering:true});assert.ok(previous.angleTo(q)<.41);previous.copy(q);}
 assert.equal(m.active,false);assert.ok(q.angleTo(new T.Quaternion())<eps);
});
test('a large inspection warp does not add a false roll',()=>{
 const m=new RollMotion(),p=new T.Vector3(),q=new T.Quaternion();m.start(p,q,0,3);p.z=100;m.pose(q,p,3,.1,{rolling:true,grounded:true});assert.ok(q.angleTo(new T.Quaternion())<eps);assert.equal(m.spin,0);
});
