import {test} from 'node:test';import assert from 'node:assert/strict';
import {FishMotion} from '../src/core/FishMotion.js';

test('flee boundary has hysteresis and a complete escape returns to schooling',()=>{
 const m=new FishMotion(0,1),p={x:0,y:-5,z:0},q={position:p,home:{x:0,z:0},phase:0,swimmer:{x:4.2,y:-5,z:0},radius:.34,large:false,depth:-5,time:0,clear:()=>true};m.update(1/60,q);assert.equal(m.fleeing,true);
 q.swimmer.x=5;m.update(1/60,q);assert.equal(m.fleeing,true);q.swimmer.x=7;m.update(1/60,q);assert.equal(m.fleeing,false);
});

test('bounded steering clears an obstacle and resumes travel at all simulation rates',()=>{
 for(const hz of [30,60,120]){
  const p={x:0,y:-5,z:0},m=new FishMotion(0,1),clear=(x,y,z)=>!(Math.abs(x)<1.2&&z>2&&z<4),start={...p};let blocked=0;
  for(let i=0;i<hz*12;i++){m.update(1/hz,{position:p,home:{x:0,z:2},phase:i/hz*.1,swimmer:{x:100,y:0,z:100},radius:.34,large:false,depth:-5,time:i/hz,clear});if(!clear(p.x,p.y,p.z))blocked++;}
  assert.equal(blocked,0);assert.ok(Math.hypot(p.x-start.x,p.z-start.z)>4,`${hz} Hz escape stalled at ${JSON.stringify(p)}`);
 }
});
