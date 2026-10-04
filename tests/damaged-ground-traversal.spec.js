import {test,expect} from '@playwright/test';import {boot} from './helpers.mjs';
test('the loaded raccoon crosses an excavated slope both ways without voxel ledges',async({page})=>{
 test.setTimeout(180000);await boot(page,{withRig:true});
 const rows=await page.evaluate(async baseline=>{
  const {VoxelWorld}=await import(baseline?'/output/iterate/VoxelWorld-baseline.js':'/src/level/VoxelWorld.js'),T=await import('/node_modules/three/build/three.module.js'),{VOXEL,PLAYER_CONFIG:P}=await import('/src/core/Constants.js'),s=VOXEL.SIZE,g=__game,c=g.jimothy,w=new VoxelWorld(new T.Scene()),top=90;
  w.terrain={surfaceHeight:()=> (top+.5)*s,topSolidVoxelY:()=>top,materialAtVoxel:(x,y,z)=>y<=top?8:0};
  for(let x=-1;x<=1;x++)for(let z=-1;z<=3;z++)w.generated.add(`${x},${z}`);
  for(let x=-5;x<=5;x++)for(let z=-5;z<=90;z++){const floor=Math.floor((3+.35*(z+.5)*s)/s)-1;for(let y=floor+1;y<=top;y++)w.setEdit(x,y,z,0);}
  const rows=[];for(const hz of [30,60,120])for(const direction of [-1,1]){
   c.voxels=w;c.reset();setFatness(0);const z=direction>0?0:18;c.body.position.set(0,w.groundHeightAt(0,z,12)+c.radius,z);c.yaw=direction>0?0:Math.PI;c.legs.reset();c.postUpdate(0);
   let blocked=0,air=0,error=0,pose=0,correction=0;
   for(let i=0;i<3*hz;i++){
    const prev=c.body.position.clone();c.vel.set(0,0,direction*6);c.body.position.z+=direction*6/hz;if(!c.grounded)c.vy-=P.HOP_GRAVITY/hz;c.body.position.y+=c.vy/hz;c.elapsed+=1/hz;c.postUpdate(1/hz);
    if(Math.abs(c.body.position.z-prev.z)<3/hz)blocked++;if(!c.grounded)air++;
    error=Math.max(error,Math.abs(c.position.y-w.groundHeightAt(c.position.x,c.position.z,c.position.y+.5)));
    correction=Math.max(correction,Math.abs(c.body.position.y-prev.y-.35*(c.body.position.z-prev.z)));
    pose=Math.max(pose,Math.abs(c.rig.root.position.y-c.rig.baseY));
   }
   rows.push({hz,direction,blocked,air,error,pose,correction,travel:Math.abs(c.body.position.z-z)});
  }w.clear();return rows;
 },process.env.GROUND_BASELINE==='1');console.log('DUG_SLOPE_WALK',JSON.stringify(rows));
 for(const r of rows){expect(r.blocked,JSON.stringify(r)).toBe(0);expect(r.air,JSON.stringify(r)).toBe(0);expect(r.error,JSON.stringify(r)).toBeLessThan(.06);expect(r.pose,JSON.stringify(r)).toBeLessThan(.5);expect(r.correction,JSON.stringify(r)).toBeLessThan(.08);expect(r.travel).toBeGreaterThan(17.9);}
});
