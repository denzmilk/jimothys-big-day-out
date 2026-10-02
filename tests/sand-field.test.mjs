import test from 'node:test';
import assert from 'node:assert/strict';
import {SandField} from '../src/core/SandField.js';
import {BEACH} from '../src/core/Constants.js';
import * as Terrain from '../src/level/Terrain.js';

test('beach has dry and wet sand and a gentle shallows profile',()=>{
 const p={x:70,z:-700,ux:1/3,uz:-Math.sqrt(8/9)};
 const at=d=>({x:p.x+p.ux*d,z:p.z+p.uz*d});
 const mats=[2,10,20].map(d=>{const q=at(d);return Terrain.sandAt(q.x,q.z);});
 assert(mats.includes(BEACH.WET_MATERIAL));assert(mats.includes(BEACH.DRY_MATERIAL));
 let last=Terrain.surfaceHeight(at(-10).x,at(-10).z);
 for(let d=-9;d<=25;d++){const q=at(d),h=Terrain.surfaceHeight(q.x,q.z);assert(Math.abs(h-last)<.45);last=h;}
 assert.equal(Terrain.sandAt(0,0),0);
});
test('compaction is bounded, partially settles and survives leaving the render window',()=>{
 const f=new SandField(()=>true);f.centerAt(0,0);f.stamp(0,0,1,.1);f.update(.1);const start=f.sample(0,0);assert(start<-.01);
 for(let i=0;i<100;i++){f.stamp(0,0,1,.1);f.update(.1);}assert(f.sample(0,0)>=-BEACH.MAX_DEPTH-1e-6);
 const deep=f.sample(0,0);for(let i=0;i<500;i++)f.update(.1);assert(f.sample(0,0)>deep);assert(f.sample(0,0)<-.01);
 f.centerAt(1000,1000);f.centerAt(0,0);assert(f.sample(0,0)<-.01);assert(Math.abs(f.sample(.12,.08)-f.renderSample(.12,.08))<1e-6);
 assert(f.cells.size<=BEACH.MAX_CELLS);f.reset();assert.equal(f.sample(0,0),0);
});
test('stamps leave non-sand surfaces unchanged and process bounded queues',()=>{
 const f=new SandField((x,z)=>x>0);for(let i=0;i<100;i++)f.stamp(0,0,30,.1);f.update(.1);
 assert.equal(f.sample(-1,0),0);assert(f.pending.length<=BEACH.MAX_JOBS);assert(f.lastWork<=BEACH.WORK_CELLS);
});
