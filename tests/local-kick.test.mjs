import test from 'node:test';import assert from 'node:assert/strict';import {LocalKick} from '../src/core/LocalKick.js';
test('committed local kicks wind up, contact once, recover and retain their original heading at every tick rate',()=>{
 const rows=[];for(const hz of [30,60,120]){const k=new LocalKick();let hit=0,at=0,swishes=0;for(let i=0;i<hz*3;i++){const r=k.update(1/hz,{canStart:true,canHit:true,yaw:i?2:0});if(r.hit){hit++;at=(i+1)/hz;}if(r.swish)swishes++;if(i<hz)assert.equal(k.heading,0);}assert.equal(hit,1);assert.equal(swishes,1);assert.ok(at>=.76&&at<=.81);assert.equal(k.phase,'idle');rows.push({hz,at});}console.log('LOCAL_KICK_TIMING',JSON.stringify(rows));
});
test('a missed strike remains missed when the target returns during recovery',()=>{
 const k=new LocalKick();let hits=0;for(let i=0;i<180;i++){const r=k.update(1/60,{canStart:true,canHit:i>55,yaw:0});if(r.hit)hits++;}assert.equal(hits,0);
});
test('attachment, ragdoll or shield cancellation cannot leave a latent strike',()=>{
 const k=new LocalKick();k.update(.5,{canStart:true,canHit:true});k.cancel();for(let i=0;i<120;i++)assert.equal(k.update(1/60,{canStart:false,canHit:true}).hit,false);assert.equal(k.phase,'idle');
});
