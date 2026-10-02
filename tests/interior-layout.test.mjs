import test from 'node:test';import assert from 'node:assert/strict';
import{planInterior,writeInterior,interiorPoint}from'../src/level/InteriorLayout.js';import{VOXEL}from'../src/core/Constants.js';
const base={vx:20,vy:10,vz:-30,vw:54,vd:58,vh:39,type:'apartment',front:0};
test('every room and storey has a deterministic route to the real entrance',()=>{
 for(let front=0;front<4;front++)for(const type of ['craftsman','shed','apartment','shop','warehouse','tower']){
 const p=planInterior({...base,front,type}),again=planInterior({...base,front,type});assert.deepEqual(p,again);
 const seen=new Set([p.entrance.key]),queue=[p.entrance];while(queue.length)for(const key of queue.shift().links)if(!seen.has(key)){seen.add(key);queue.push(p.nodes.find(n=>n.key===key));}
 for(const f of p.floors)for(const r of f.rooms)assert.ok(seen.has(r.node));
 const vox=new Map();for(const _ of writeInterior(p,(x,y,z,m)=>vox.set(`${x},${y},${z}`,m))){}
 for(const n of p.nodes.filter(n=>n!==p.entrance)){const {x,y,z}=n.local;assert.ok(!vox.has(`${Math.floor(x)},${Math.floor(y+1)},${Math.floor(z)}`),`${type}/${front} blocked ${n.key}`);}
 assert.equal(p.floors.length,type==='warehouse'?1:3);
 }
});
test('rotated local positions remain inside the quantised shell',()=>{
 for(let front=0;front<4;front++){const b={...base,front},p=planInterior(b);for(const n of p.nodes.filter(n=>n!==p.entrance)){const a=interiorPoint(b,n.local.x,n.local.y,n.local.z);assert.ok(a.x>=b.vx*VOXEL.SIZE&&a.x<=(b.vx+b.vw)*VOXEL.SIZE);assert.ok(a.z>=b.vz*VOXEL.SIZE&&a.z<=(b.vz+b.vd)*VOXEL.SIZE);}}
});
test('a full-height window storey gets a floor when there is usable headroom',()=>{
 const apartment=planInterior({...base,vh:38});assert.equal(apartment.floors.length,3);
 const house=planInterior({...base,type:'craftsman',vh:25});assert.equal(house.floors.length,2);
});
