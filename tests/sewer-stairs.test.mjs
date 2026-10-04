import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {planSewerStairs} from '../src/level/SewerStairs.js';import {VoxelWorld} from '../src/level/VoxelWorld.js';import {generateColumn} from '../src/level/VoxelCity.js';import * as Layout from '../src/level/Layout.js';import {VOXEL,SEWER} from '../src/core/Constants.js';
const entrance=Layout.Masterplan.sewerNetwork().flatMap(n=>n.entrances).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];
function world(e){const w=new VoxelWorld(new THREE.Scene());w.terrain=Layout.terrain;w.generator=generateColumn;const size=VOXEL.CHUNK_XZ*VOXEL.SIZE,pad=SEWER.SHAFT*VOXEL.SIZE/2+1;for(let x=Math.floor((e.x-pad)/size);x<=Math.floor((e.x+pad)/size);x++)for(let z=Math.floor((e.z-pad)/size);z<=Math.floor((e.z+pad)/size);z++)w.ensureColumn(x,z);return w;}
test('sewer shafts retain destructible street support above their central void',()=>{
 for(const e of Layout.Masterplan.sewerNetwork().flatMap(n=>n.entrances)){
  const w=world(e),p=planSewerStairs(e,Layout.terrain),x=(p.ox+p.n/2)*VOXEL.SIZE,z=(p.oz+p.n/2)*VOXEL.SIZE,y=w.terrainHeightAt(x,z);
  assert.ok(Math.abs(w.groundHeightAt(x,z,y+1)-y)<.01,`open roadway over sewer ${JSON.stringify(e)}`);
  w.damageSphere(x,y,z,.5);assert.ok(w.groundHeightAt(x,z,y+1)<y-.5);w.clear();
 }
});
test('the top sewer landing supports the full width of a lean raccoon',()=>{
 const e=entrance,w=world(e),s=VOXEL.SIZE,p=planSewerStairs(e,Layout.terrain),x=p.path[0].x-(p.width-1)*s/2,z=p.path[0].z-(p.width-1)*s/2;
 const top=w.groundHeightAt(x,z,w.terrainHeightAt(x,z)+3);let gap=0;
 for(let dx=0;dx<1.1;dx+=s)for(let dz=0;dz<1.1;dz+=s)gap=Math.max(gap,Math.abs(top-w.groundHeightAt(x+dx,z+dz,top+.1)));
 assert.ok(gap<=s,`single-cell stair landing drops ${gap.toFixed(2)} m within Jimothy's footprint`);w.clear();
});

test('every generated stair flight has full treads, connected landings and standing headroom',async()=>{
 const {planSewerStairs}=await import('../src/level/SewerStairs.js');
 for(const e of Layout.Masterplan.sewerNetwork().flatMap(n=>n.entrances)){
  const w=world(e),plan=planSewerStairs(e,Layout.terrain),s=VOXEL.SIZE;
  for(const [i,p] of plan.path.entries()){
   const floor=w.groundHeightAt(p.x,p.z,p.y+.01);assert.ok(Math.abs(floor-p.y)<.001,`missing support at ${JSON.stringify({e,p,floor})}`);
   if(i)assert.ok(Math.abs(p.y-plan.path[i-1].y)<=s+.001,'stairs have an excessive riser');
   for(const dx of [-.45,0,.45])for(const dz of [-.45,0,.45])for(const dy of [.6,1.1,1.7])assert.equal(w.solidAtWorld(p.x+dx,p.y+dy,p.z+dz),false,`blocked body/headroom ${JSON.stringify({e,p,dx,dy,dz})}`);
  }
  assert.ok(plan.path.at(-1).y<=plan.floor*s+.001);
  const exit=plan.exit;assert.ok(exit,`stairs have no clear bore doorway: ${JSON.stringify(e)}`);
  for(const point of [plan.route[0],exit]){
   const floor=w.groundHeightAt(point.x,point.z,point.y+.1);assert.ok(Math.abs(floor-point.y)<=s+.001,`disconnected landing ${JSON.stringify({e,point,floor})}`);
   for(const dx of [-.4,0,.4])for(const dz of [-.4,0,.4])for(const dy of [.6,1.2,1.7])assert.equal(w.solidAtWorld(point.x+dx,floor+dy,point.z+dz),false,`blocked doorway ${JSON.stringify({e,point,dx,dz,dy})}`);
  }
  w.clear();
 }
});

test('the rendered stair treads share their flat collision height near street level',()=>{
 const w=world(entrance),plan=planSewerStairs(entrance,Layout.terrain);w.remeshDirty();const meshes=[...w.chunks.values()].map(c=>c.mesh).filter(Boolean);
 for(const p of plan.path.slice(0,10)){
  const ray=new THREE.Raycaster(new THREE.Vector3(p.x,p.y+.1,p.z),new THREE.Vector3(0,-1,0),0,.2),hit=ray.intersectObjects(meshes)[0];
  assert.ok(hit,`no visible tread at ${JSON.stringify(p)}`);assert.ok(Math.abs(hit.point.y-w.groundHeightAt(p.x,p.z,p.y+.01))<.001);
 }
 w.clear();
});
