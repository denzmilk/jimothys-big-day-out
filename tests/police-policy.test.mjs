import test from 'node:test';import assert from 'node:assert/strict';
import {GunAttack,rememberPoliceTarget} from '../src/core/PolicePolicy.js';

test('police shots commit to one aim point after a visible windup at every tick rate',()=>{
 for(const hz of [30,60,120]){const shot=new GunAttack();let fired=[];for(let i=0;i<hz;i++){const r=shot.update(1/hz,{allowed:true,target:{x:i?20:2,y:1,z:4}});if(r.fire)fired.push({at:(i+1)/hz,target:r.target});}assert.equal(fired.length,1);assert.ok(fired[0].at>=.7&&fired[0].at<.75);assert.deepEqual(fired[0].target,{x:2,y:1,z:4});}
});
test('cover, net coordination and ownership interrupts cannot leave a delayed shot',()=>{
 const shot=new GunAttack();shot.update(.5,{allowed:true,target:{x:0,y:1,z:2}});shot.update(.1,{allowed:false});for(let i=0;i<180;i++)assert.equal(shot.update(1/60,{allowed:false}).fire,false);
});
test('a patrol remembers only seen positions and gives up a finite search',()=>{
 const unit={state:'search',lastKnown:{x:2,z:4},searchLeft:1};rememberPoliceTarget(unit,.1,null);assert.deepEqual(unit.lastKnown,{x:2,z:4});rememberPoliceTarget(unit,.1,{x:10,z:12});assert.equal(unit.state,'chase');assert.deepEqual(unit.lastKnown,{x:10,z:12});for(let i=0;i<500;i++)rememberPoliceTarget(unit,.1,null);assert.equal(unit.state,'patrol');assert.deepEqual(unit.lastKnown,{x:10,z:12});
});

import {TrafficFlow} from '../src/core/TrafficFlow.js';
test('police route memory chooses connected streets and preserves obstacle stops at all rates',()=>{
 const a={id:'a',x:0,z:0,outgoing:[],incoming:[]},b={id:'b',x:0,z:30,outgoing:[],incoming:[]},c={id:'c',x:30,z:30,outgoing:[],incoming:[]},d={id:'d',x:0,z:60,outgoing:[],incoming:[]};
 const road=(from,to)=>{const length=Math.hypot(to.x-from.x,to.z-from.z),dir={x:(to.x-from.x)/length,z:(to.z-from.z)/length},r={id:from.id+to.id,from,to,length:length-4,start:{x:from.x+dir.x*2,z:from.z+dir.z*2},end:{x:to.x-dir.x*2,z:to.z-dir.z*2},dir,width:8,axis:0};from.outgoing.push(r);to.incoming.push(r);return r;};const ab=road(a,b),bc=road(b,c),bd=road(b,d),routes={roads:[ab,bc,bd],junctions:new Map([a,b,c,d].map(j=>[j.id,j]))};
 for(const hz of [30,60,120]){const flow=new TrafficFlow(routes,()=>true),position={x:0,y:1,z:0},p={id:'cop',seed:0,half:[1,1,2],mesh:{position,rotation:{set(){}}},routeTarget:{x:30,z:30},emergency:true,cruiseSpeed:12};flow.assign(p,ab,0);assert.equal(p.route.next,bc);for(let i=0;i<hz*3;i++)flow.update(1/hz,[p],[{id:'wall',x:0,y:0,z:16,width:3,length:1}],()=>0);assert.ok(position.z<12);assert.ok(position.z>3);assert.equal(p.route.reason,'obstacle');assert.equal(p.route.speed,0);}
});
