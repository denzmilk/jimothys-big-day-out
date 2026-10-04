import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('continuous slopes keep grounded walking in both directions at 30/60/120 Hz',async({page})=>{
 await boot(page,{withRig:true});
 const rows=await page.evaluate(async()=>{
  const {VoxelWorld}=await import('/src/level/VoxelWorld.js'),T=await import('/node_modules/three/build/three.module.js'),{VOXEL,PLAYER_CONFIG:P}=await import('/src/core/Constants.js');
  const c=__game.jimothy,rows=[],s=VOXEL.SIZE;
  for(const grade of [.35,.95])for(const hz of [30,60,120])for(const direction of [-1,1]){
   const w=new VoxelWorld(new T.Scene()),height=(x,z)=>20+grade*z;
   w.terrain={surfaceHeight:height,topSolidVoxelY:(x,z)=>Math.floor(height(x,z)/s-.5),materialAtVoxel:(x,y,z)=>y<=Math.floor(height((x+.5)*s,(z+.5)*s)/s-.5)?8:0};
   for(let x=-2;x<=2;x++)for(let z=-8;z<=8;z++)w.generated.add(`${x},${z}`);
   c.voxels=w;c.reset();setFatness(0);c.yaw=direction>0?0:Math.PI;c.body.position.set(0,20+c.radius,0);c.postUpdate(0);
   let blocked=0,error=0,air=0,jump=0;
   for(let f=0;f<hz*3;f++){
    const previous=c.body.position.clone();c.vel.set(0,0,direction*6);c.body.position.z+=direction*6/hz;
    if(!c.grounded)c.vy-=P.HOP_GRAVITY/hz;c.body.position.y+=c.vy/hz;c.elapsed+=1/hz;c.postUpdate(1/hz);
    if(Math.abs(c.body.position.z-previous.z)<3/hz)blocked++;
    if(!c.grounded)air++;error=Math.max(error,Math.abs(c.body.position.y-c.radius-height(0,c.body.position.z)));
    jump=Math.max(jump,Math.abs(c.body.position.y-previous.y-grade*(c.body.position.z-previous.z)));
   }
   rows.push({grade,hz,direction,blocked,air,error,jump,travel:Math.abs(c.body.position.z)});w.clear();
  }return rows;
 });console.log('SLOPE_TRAVERSAL',JSON.stringify(rows));
 for(const r of rows){expect(r.blocked,JSON.stringify(r)).toBe(0);expect(r.air,JSON.stringify(r)).toBe(0);expect(r.error,JSON.stringify(r)).toBeLessThan(.03);expect(r.travel).toBeGreaterThan(17.9);}
});
