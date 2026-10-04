import test from 'node:test';import assert from 'node:assert/strict';
import {RifleBurst} from '../src/core/RifleBurst.js';

test('rifle warning, three committed rounds and recovery are consistent at 30/60/120 Hz',()=>{
 for(const hz of [30,60,120]){const a=new RifleBurst(),shots=[];for(let i=0;i<hz*3;i++){const r=a.update(1/hz,{allowed:true,target:{x:i?12:2,y:1,z:5}});if(r.fire)shots.push({time:(i+1)/hz,target:r.target});}
  assert.equal(shots.length,3);assert.ok(shots[0].time>=.9&&shots[0].time<.95);for(const shot of shots)assert.deepEqual(shot.target,{x:2,y:1,z:5});for(let i=1;i<3;i++)assert.ok(shots[i].time-shots[i-1].time>=.11&&shots[i].time-shots[i-1].time<=.18);assert.equal(a.phase,'recover');
 }
});
test('interrupting a rifle burst cancels its remaining rounds and cannot fire from stale memory',()=>{
 for(const hz of [30,60,120]){const a=new RifleBurst();let shots=0;for(let i=0;i<hz*2&&!shots;i++)shots+=Number(a.update(1/hz,{allowed:true,target:{x:1,y:1,z:2}}).fire);assert.equal(shots,1);for(let i=0;i<hz*3;i++)assert.equal(a.update(1/hz,{allowed:false}).fire,false);assert.equal(a.target,null);const r=a.update(1/hz,{allowed:true,target:{x:9,y:2,z:3}});assert.equal(r.fire,false);assert.deepEqual(a.target,{x:9,y:2,z:3});}
});
