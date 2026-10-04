import * as THREE from 'three';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {VoxelWorld} from '../src/level/VoxelWorld.js';import {VOXEL} from '../src/core/Constants.js';
const baseline=process.argv[2]||'6795e1a',source=execFileSync('git',['show',`${baseline}:src/level/VoxelWorld.js`],{encoding:'utf8'}).replaceAll("'../core/","'../../src/core/");
await fs.writeFile('output/iterate/.profile-ground-baseline.mjs',source);const {VoxelWorld:Before}=await import('../output/iterate/.profile-ground-baseline.mjs');
function fixture(Type,channel){const w=new Type(new THREE.Scene()),s=VOXEL.SIZE,h=10,top=Math.floor(h/s-.5);w.terrain={surfaceHeight:()=>h,topSolidVoxelY:()=>top,materialAtVoxel:(x,y,z)=>y<=top?8:0};
 for(let cx=-1;cx<=1;cx++)for(let cz=-1;cz<=1;cz++)w.generated.add(`${cx},${cz}`);
 for(let x=-1;x<=32;x++)for(let z=-1;z<=32;z++)for(let y=top-3;y<=top;y++)w.set(x,y,z,8);
 w.damageSphere(3.5,9.2,3.5,2.5,{digsTerrain:true});if(channel)w.channels={cells:1,sample:()=>-1};return w;}
const rows=[];for(const [label,Type]of [['baseline',Before],['current',VoxelWorld]])for(const channel of [false,true]){
 const w=fixture(Type,channel),start=performance.now();w.remeshDirty();const meshMs=performance.now()-start,vertices=[...w.chunks.values()].reduce((n,c)=>n+(c.mesh?.geometry.attributes.position.count||0),0),runs=[];let sum=0;
 for(let run=0;run<6;run++){const t=performance.now();for(let i=0;i<10000;i++){const x=1+(i%127)/25,z=1+(i%113)/25;sum+=w.groundHeightAt(x,z,10.2);w.solidAtWorld(x,9.1,z);}runs.push(performance.now()-t);}
 const sorted=runs.slice(1).sort((a,b)=>a-b);rows.push({label,channel,meshMs,vertices,queryPairCount:10000,medianMs:sorted[2],runs,finite:Number.isFinite(sum)});w.clear();
}
await fs.writeFile('output/iterate/damaged-ground-profile.json',JSON.stringify({baseline,rows},null,2));console.log(JSON.stringify(rows));
