import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {VoxelWorld} from '../src/level/VoxelWorld.js';import {VOXEL} from '../src/core/Constants.js';
const bounds={min:[-1,-1,-1],max:[5,5,3]};
function bridge(){const w=new VoxelWorld(new THREE.Scene());w.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(_x,y)=>y<0?1:0};for(const x of [0,16])for(let y=0;y<8;y++)w.set(x,y,0,3);for(let x=0;x<=16;x++)w.set(x,8,0,3);return w;}
function check(w){assert.equal(typeof w.supportTask,'function');let n=0,out=[];for(const batch of w.supportTask(bounds)){n++;if(batch)out.push(...batch);}assert.ok(n<1000);return out;}
test('supported roof survives one lost pier, then detaches when its remaining support is removed',()=>{const w=bridge();for(let y=0;y<8;y++)w.setEdit(0,y,0,0);assert.equal(check(w).length,0);assert.equal(w.get(8,8,0),3);for(let y=0;y<8;y++)w.setEdit(16,y,0,0);assert.equal(check(w).length,17);assert.equal(w.get(8,8,0),0);});
test('excavation under a foundation releases the structure and work can yield',()=>{const w=bridge();w.channels={cells:1,sample:()=>-3};const task=w.supportTask?.(bounds);assert.ok(task);const first=task.next();assert.equal(w.get(8,8,0),3);let removed=first.value?.length||0;for(const batch of task)removed+=batch?.length||0;assert.equal(removed,33);assert.equal(w.get(8,8,0),0);});

test('ordinary excavation removes ground support even though the authored grade stays unchanged',()=>{
 const w=bridge();
 for(let x=-1;x<=17;x++)for(let z=-1;z<=1;z++)for(let y=-4;y<0;y++)w.setEdit(x,y,z,0);
 assert.equal(w.terrain.surfaceHeight(0,0),0);
 assert.equal(check(w).length,33);
 assert.equal(w.get(8,8,0),0);
});

test('separated voxels inside one coarse support cell do not share an anchor',()=>{
 const w=new VoxelWorld(new THREE.Scene());
 w.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(_x,y)=>y<0?1:0};
 for(let y=0;y<4;y++)w.set(0,y,0,3);
 w.set(2,2,0,3);
 const removed=check(w);
 assert.equal(removed.length,1);
 assert.equal(w.get(2,2,0),0);
 assert.equal(w.get(0,3,0),3);
});

test('a one-voxel horizontal cut disconnects a wall within a coarse support cell',()=>{
 const w=new VoxelWorld(new THREE.Scene());
 w.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(_x,y)=>y<0?1:0};
 for(let x=0;x<8;x++)for(let y=0;y<12;y++)w.set(x,y,0,3);
 for(let x=0;x<8;x++)w.setEdit(x,1,0,0);
 assert.equal(check(w).length,80);
 assert.equal(w.get(4,0,0),3);
 assert.equal(w.get(4,8,0),0);
});

test('wide supported foundations do not spend one graph node and yield per individual cell',()=>{
 const w=new VoxelWorld(new THREE.Scene());w.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(_x,y)=>y<0?1:0};
 for(let x=0;x<64;x++)for(let z=0;z<32;z++)for(let y=0;y<32;y++)w.set(x,y,z,3);
 let slices=0,removed=0;for(const batch of w.supportTask({min:[-VOXEL.SIZE,-VOXEL.SIZE,-VOXEL.SIZE],max:[64*VOXEL.SIZE,32*VOXEL.SIZE,32*VOXEL.SIZE]})){slices++;removed+=batch.length;}
 assert.equal(removed,0);assert.ok(slices<300,`support graph took ${slices} slices`);
});

function unsupportedOracle(w,b){
 const lo=b.min.map(v=>Math.floor(v/VOXEL.SIZE)),hi=b.max.map(v=>Math.ceil(v/VOXEL.SIZE)),nodes=new Map(),dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 for(const c of w.chunks.values())for(let i=0;i<c.data.length;i++){
  const mat=c.data[i];if(!mat||mat===VOXEL.EMPTY||mat===VOXEL.BEDROCK)continue;
  const x=c.cx*VOXEL.CHUNK_XZ+i%VOXEL.CHUNK_XZ,y=c.cy*VOXEL.CHUNK_Y+Math.floor(i/VOXEL.CHUNK_XZ)%VOXEL.CHUNK_Y,z=c.cz*VOXEL.CHUNK_XZ+Math.floor(i/(VOXEL.CHUNK_XZ*VOXEL.CHUNK_Y));
  if([x,y,z].some((v,j)=>v<lo[j]||v>hi[j])||!w.get(x,y,z))continue;nodes.set(`${x},${y},${z}`,{p:[x,y,z],held:false});
 }
 const queue=[];for(const n of nodes.values())for(const d of dirs){const p=n.p.map((v,i)=>v+d[i]);if(!nodes.has(p.join(','))&&w.get(...p)){n.held=true;queue.push(n);break;}}
 for(let i=0;i<queue.length;i++)for(const d of dirs){const n=nodes.get(queue[i].p.map((v,j)=>v+d[j]).join(','));if(n&&!n.held){n.held=true;queue.push(n);}}
 return [...nodes].filter(([,n])=>!n.held).map(([k])=>k).sort();
}
test('row connectivity agrees with a cell flood fill across mixed materials, gaps and chunk boundaries',()=>{
 for(let seed=1;seed<=12;seed++){
  let state=seed;const random=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/2**32),w=new VoxelWorld(new THREE.Scene());
  w.terrain={surfaceHeight:()=>0,topSolidVoxelY:()=>-1,materialAtVoxel:(_x,y)=>y<0?1:0};
  for(let x=-4;x<38;x++)for(let z=-3;z<4;z++)for(let y=0;y<8;y++)if(random()>.35)w.set(x,y,z,random()>.4?3:6);
  for(let x=-5;x<39;x++)if(random()>.45)for(let z=-4;z<5;z++)w.setEdit(x,-1,z,0);
  w.set(33,3,1,VOXEL.BEDROCK);
  const b={min:[-5*VOXEL.SIZE,-VOXEL.SIZE,-4*VOXEL.SIZE],max:[39*VOXEL.SIZE,9*VOXEL.SIZE,5*VOXEL.SIZE]},expected=unsupportedOracle(w,b),removed=[];
  for(const batch of w.supportTask(b))for(const p of batch)removed.push([p.x,p.y,p.z].map(v=>Math.round(v/VOXEL.SIZE-.5)).join(','));
  assert.deepEqual(removed.sort(),expected,`seed ${seed}`);w.clear();
 }
});
test('a support cut during a yielded scan cannot anchor a stale connected run',()=>{
 const w=bridge();for(let x=0;x<32;x++)for(let z=1;z<5;z++)w.set(x,8,z,3);
 const task=w.supportTask({min:bounds.min,max:[8,5,3]});task.next();task.next();
 for(let y=0;y<8;y++)for(const x of [0,16])w.setEdit(x,y,0,0);
 let removed=0;for(const batch of task)removed+=batch.length;
 assert.ok(removed>17);assert.equal(w.get(8,8,0),0);
});

test('repeated damage merges an active building support request instead of adding a second full scan',()=>{
 const w=bridge(),first={min:[-1,-1,-1],max:[5,5,3]},second={min:[-2,-3,-1],max:[6,5,4]};
 assert.equal(w.queueSupport(first,'building'),true);w.processDamage({maxSlices:1});
 assert.equal(w.queueSupport(second,'building'),true);assert.equal(w.damageQueue.length,1);
 const job=w.damageQueue[0];assert.deepEqual(job.bounds.min,second.min);assert.deepEqual(job.bounds.max,second.max);assert.ok(job.bounds.revision>0);
});

test('an expanded active scan rechecks the new boundary before preserving a floating roof',()=>{
 const w=bridge();for(let y=0;y<8;y++)for(const x of [0,16])w.setEdit(x,y,0,0);
 for(let x=0;x<32;x++)w.set(x,8,0,3);
 w.queueSupport({min:[-1,-1,-1],max:[5,5,3]},'roof');w.processDamage({maxSlices:2});
 w.queueSupport({min:[-1,-1,-1],max:[8,5,3]},'roof');w.processDamage();
 assert.equal(w.get(31,8,0),0);assert.equal(w.get(8,8,0),0);assert.equal(w.damageQueue.length,0);
});
