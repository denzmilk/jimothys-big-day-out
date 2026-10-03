import test from 'node:test';import assert from 'node:assert/strict';
import{planInterior,writeInterior,interiorPoint,blocksInteriorRoute}from'../src/level/InteriorLayout.js';import{VOXEL}from'../src/core/Constants.js';
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
test('doors connect generous rooms and short footprints remain open',()=>{
 for(const [vw,vd]of[[34,40],[48,42],[54,58],[72,76]])for(let front=0;front<4;front++){
  const p=planInterior({...base,vw,vd,front,type:'craftsman'});
  assert.ok(p.doors?.some(d=>d.exterior),'front door is part of the shared plan');
  for(const f of p.floors)for(const r of f.rooms){
   assert.ok((r.x1-r.x0+1)*VOXEL.SIZE>=3,`narrow ${vw}/${vd}/${front}`);
   assert.ok((r.z1-r.z0+1)*VOXEL.SIZE>=3,`short ${vw}/${vd}/${front}`);
   if(!r.open)assert.ok(p.doors.some(d=>d.rooms.includes(r.id)),`unconnected ${r.id}`);
  }
 }
});

test('furniture keeps the entrance spine and door swing clear',()=>{
 const p=planInterior({...base,type:'craftsman',vh:14}),f=p.floors[0],r=f.rooms[0],s=VOXEL.SIZE;
 assert.equal(blocksInteriorRoute(p,f,(Math.floor(p.w/2)+.5)*s,(r.z0+r.z1)/2*s,.5,.35),true);
 const d=p.doors.find(d=>!d.exterior);assert.equal(blocksInteriorRoute(p,f,d.x*s,d.z*s,.1,.1),true);
 assert.equal(blocksInteriorRoute(p,f,(r.x1-1)*s,(r.z0+2)*s,.1,.1),false);
});
