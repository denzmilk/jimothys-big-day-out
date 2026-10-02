import test from 'node:test';
import assert from 'node:assert/strict';
import {restrictMotion} from '../src/core/BodyContact.js';

const car={id:'car',position:{x:0,y:.7,z:0},half:[1,.7,2],bottom:0,top:1.4,yaw:0};
const person={id:'person',position:{x:0,y:0,z:0},radius:.4,bottom:0,top:1.8};
const motion=(x,z,vx,vz,dt=.1,y=.55)=>({position:{x,y,z},velocity:{x:vx,y:0,z:vz},radius:.55,dt});

test('a fast step cannot cross a car, regardless of simulation rate',()=>{
  for(const dt of [1/120,1/60,1/30,.1]){
    let z=4;
    for(let time=0;time<1;time+=dt){const m=motion(0,z,0,-12,dt);restrictMotion(m,car);z+=m.velocity.z*dt;}
    assert.ok(z>=2.55&&z<2.6,`${dt}: ${z}`);
  }
});

test('rotated vehicles retain front and side extents',()=>{
  const yaw=.7,s=Math.sin(yaw),c=Math.cos(yaw);
  const m=motion(4*s,4*c,-20*s,-20*c,.2);
  assert.equal(restrictMotion(m,{...car,yaw}),true);
  const x=m.position.x+m.velocity.x*m.dt,z=m.position.z+m.velocity.z*m.dt;
  assert.ok(x*s+z*c>=2.55);
});

test('contact retains tangential movement and allows backing away',()=>{
  const m=motion(1.6,0,-3,2);
  assert.equal(restrictMotion(m,car),true);assert.equal(m.velocity.z,2);
  const escape=motion(1.5,0,3,0);
  assert.equal(restrictMotion(escape,car),false);assert.equal(escape.velocity.x,3);
});

test('people on another floor do not block, and a hop clears a car',()=>{
  assert.equal(restrictMotion(motion(0,2,0,-20),{...person,bottom:3,top:4.8}),false);
  assert.equal(restrictMotion(motion(0,4,0,-20,.1,3),car),false);
});

test('standing people stop a long step and stationary queries stay finite',()=>{
  const m=motion(0,3,0,-30,.2);
  assert.equal(restrictMotion(m,person),true);
  assert.ok(m.position.z+m.velocity.z*m.dt>=.95);
  const idle=motion(0,0,0,0,0);assert.equal(restrictMotion(idle,person),false);
  assert.deepEqual(idle.velocity,{x:0,y:0,z:0});
});
