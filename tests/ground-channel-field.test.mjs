import test from 'node:test';import assert from 'node:assert/strict';
import {GroundChannelField} from '../src/core/GroundChannelField.js';import {GROUND_CHANNEL as C} from '../src/core/Constants.js';
const drain=f=>{let n=0;while(f.pending.length&&n++<1000){f.update();assert.ok(f.work<=C.FIELD_WORK);}assert.equal(f.pending.length,0);};
test('a broad furrow displaces soil into banks and reuses a bounded render window',()=>{
 const f=new GroundChannelField(()=>0);f.centerAt(0,0);const values=f.values,data=f.data;f.queue({x:0,y:0,z:-40},{x:0,y:0,z:40},28,6);drain(f);
 assert.ok(f.sample(0,0)<-5);assert.ok(f.sample(15,0)<-3);assert.ok(f.sample(33,0)>1);assert.equal(f.sample(45,0),0);
 for(const [x,z] of [[0,0],[15.7,-20.6],[-33,30]])assert.ok(Math.abs(f.sample(x,z)-f.renderSample(x,z))<1e-5);
 f.centerAt(800,500);f.centerAt(0,0);assert.equal(values,f.values);assert.equal(data,f.data);assert.ok(f.sample(0,0)<-5);assert.ok(Math.abs(f.sample(0,0)-f.renderSample(0,0))<1e-5);
});
test('bridge passes leave remote ground alone and repeat passes do not keep excavating',()=>{
 const f=new GroundChannelField(()=>0);for(const y of [20,4]){f.queue({x:0,y,z:-20},{x:0,y,z:20},28,6);drain(f);assert.equal(f.cells,0);}
 f.queue({x:0,y:0,z:-20},{x:0,y:0,z:20},28,6);drain(f);const before=f.sample(0,0);f.queue({x:0,y:0,z:20},{x:0,y:0,z:-20},28,6);drain(f);assert.equal(f.sample(0,0),before);assert.equal(f.removed,0);
});
test('a crossing gouge cuts through an earlier bank and reset removes all displacement',()=>{
 const f=new GroundChannelField(()=>0);f.centerAt(0,0);f.queue({x:0,y:0,z:-40},{x:0,y:0,z:40},28,6);drain(f);assert.ok(f.sample(33,0)>0);
 f.queue({x:-40,y:0,z:0},{x:40,y:0,z:0},28,6);drain(f);assert.ok(f.sample(33,0)<-5);f.reset();assert.equal(f.cells,0);assert.equal(f.sample(33,0),0);assert.equal(f.renderSample(33,0),0);
});
