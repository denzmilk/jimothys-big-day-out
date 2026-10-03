import test from 'node:test';
import assert from 'node:assert/strict';
import {SightSampler} from '../src/core/Perception.js';
import {RADAR} from '../src/core/Constants.js';
const world={terrainHeightAt:()=>0,raycast:()=>null};
const args=(x=0)=>[world,{x,y:0,z:0},0,30,0,false];
function complete(s,id,a){let result=null;for(let i=0;i<40&&!result;i++){s.process();assert.ok(s.lastRays<=RADAR.SIGHT_RAYS_PER_FRAME);result=s.request(id,a);}assert.ok(result);return result;}
test('sight work is deferred, bounded per frame, and snapshots a mutable actor pose',()=>{
 const s=new SightSampler(),a=args(10);assert.equal(s.request('watcher',a),null);a[1].x=100;
 const result=complete(s,'watcher',args(10));assert.ok(result.every(p=>p.x===10&&p.z===30));
});
test('cached sight is reused, then destruction refreshes its boundary',()=>{
 const s=new SightSampler(),v={terrainHeightAt:()=>0,raycast:()=>null},a=[v,{x:0,y:0,z:0},0,30,0,false];s.request('watcher',a);const first=complete(s,'watcher',a);s.process();assert.equal(s.lastRays,0);assert.equal(s.request('watcher',a),first);
 v.raycast=()=>({t:1});s.invalidate();s.request('watcher',a);
 for(let i=0;i<40;i++)s.process();const after=s.request('watcher',a);assert.notEqual(after,first);assert.ok(after.every(p=>p.z<2));
});
test('leaving the radar and restart discard pending work and stale contacts',()=>{
 const s=new SightSampler();s.request('gone',args());s.begin();s.end();s.process();assert.equal(s.lastRays,0);assert.equal(s.request('gone',args()),null);
 s.reset();s.process();assert.equal(s.lastRays,0);assert.equal(s.request('gone',args()),null);
});
