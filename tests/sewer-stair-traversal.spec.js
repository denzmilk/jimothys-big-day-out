import {test,expect} from '@playwright/test';import {boot,adv} from './helpers.mjs';
test('the loaded raccoon walks down and back up every generated sewer stairwell',async({page})=>{
 test.setTimeout(180000);await boot(page,{withRig:true});
 const rows=await page.evaluate(async()=>{
  const {planSewerStairs}=await import('/src/level/SewerStairs.js'),{PLAYER_CONFIG:P,VOXEL}=await import('/src/core/Constants.js'),g=__game,c=g.jimothy;
  const rows=[];for(const e of sewerEntrances()){const plan=planSewerStairs(e,g.voxels.terrain);
  teleportJimothy(e.x,e.z);g.voxels.processGeneration();
  const span=VOXEL.SIZE*VOXEL.CHUNK_XZ;for(let x=Math.floor((e.x-5)/span);x<=Math.floor((e.x+5)/span);x++)for(let z=Math.floor((e.z-5)/span);z<=Math.floor((e.z+5)/span);z++)g.voxels.ensureColumn(x,z);
  for(const reverse of [false,true]){
   const path=reverse?[...plan.route].reverse():plan.route,first=path[0];dropJimothy(first.x,first.z,first.y+c.radius);c.postUpdate(0);let blocked=0,air=0,error=0,frames=0;
   for(const target of path.slice(1)){
    let limit=0;
    while(Math.hypot(c.position.x-target.x,c.position.z-target.z)>.05&&limit++<120){
     const dx=target.x-c.position.x,dz=target.z-c.position.z,length=Math.hypot(dx,dz),travel=Math.min(length,6/60),previous=c.body.position.clone();c.yaw=Math.atan2(dx,dz);c.vel.set(dx/length*6,0,dz/length*6);c.body.position.x+=dx/length*travel;c.body.position.z+=dz/length*travel;
     if(!c.grounded)c.vy-=P.HOP_GRAVITY/60;c.body.position.y+=c.vy/60;c.elapsed+=1/60;c.postUpdate(1/60);frames++;
     if(Math.hypot(c.body.position.x-previous.x,c.body.position.z-previous.z)<travel*.5)blocked++;if(!c.grounded)air++;
    }
    error=Math.max(error,Math.abs(c.position.y-target.y));
   }
   rows.push({e,reverse,blocked,air,error,frames,depth:g.voxels.terrainHeightAt(c.position.x,c.position.z)-c.position.y,at:c.position.toArray()});
  }}return rows;
 });console.log('SEWER_STAIR_WALK',JSON.stringify(rows));
 for(const r of rows){expect(r.blocked,JSON.stringify(r)).toBe(0);expect(r.error,JSON.stringify(r)).toBeLessThan(.25);expect(r.frames).toBeLessThan(700);}
 for(const r of rows){if(r.reverse)expect(r.depth,JSON.stringify(r)).toBeLessThan(.5);else expect(r.depth,JSON.stringify(r)).toBeGreaterThan(6);}
});

test('a severed sewer tread becomes physical rubble and stays removed across travel',async({page})=>{
 await boot(page);
 const sample=await page.evaluate(async()=>{
  const {planSewerStairs}=await import('/src/level/SewerStairs.js'),{eventBus,Events}=await import('/src/core/EventBus.js'),{VOXEL}=await import('/src/core/Constants.js'),g=__game,s=VOXEL.SIZE;
  const e=sewerEntrances().sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0],p=planSewerStairs(e,g.voxels.terrain);teleportJimothy(e.x,e.z);g.voxels.processGeneration();
  const slab=p.slabs.find(t=>!t.landing&&t.y<p.top-10&&t.y>p.floor+5),center=[slab.x,slab.y,slab.z];
  for(let x=slab.x-1;x<=slab.x+slab.dx;x++)for(let z=slab.z-1;z<=slab.z+slab.dz;z++)for(let y=slab.y-2;y<=slab.y+1;y++)if(x<slab.x||x>=slab.x+slab.dx||z<slab.z||z>=slab.z+slab.dz||y<slab.y-1||y>slab.y)g.voxels.setEdit(x,y,z,0);
  eventBus.emit(Events.WORLD_DEMOLISHED,{bounds:{min:[(slab.x-1)*s,(slab.y-2)*s,(slab.z-1)*s],max:[(slab.x+slab.dx+1)*s,(slab.y+2)*s,(slab.z+slab.dz+1)*s]}});
  return {e,center,before:g.voxels.get(...center),queued:g.structuralSupport.pending.size};
 });expect(sample.before).toBe(36);expect(sample.queued).toBeGreaterThan(0);
 await adv(page,3);
 const r=await page.evaluate(center=>({mat:__game.voxels.get(...center),pieces:__game.structuralSupport.fragments.filter(p=>p.mesh.position.y<__game.voxels.terrainHeightAt(p.mesh.position.x,p.mesh.position.z)).length}),sample.center);
 expect(r.mat).toBe(0);expect(r.pieces).toBeGreaterThan(0);
 await page.evaluate(()=>teleportJimothy(500,400));await adv(page,3);await page.evaluate(e=>teleportJimothy(e.x,e.z),sample.e);await adv(page,3);
 expect(await page.evaluate(c=>__game.voxels.get(...c),sample.center)).toBe(0);
 await page.evaluate(()=>restartGame());await adv(page,.2);expect(await page.evaluate(()=>__game.structuralSupport.fragments.length)).toBe(0);expect(await page.evaluate(c=>__game.voxels.get(...c),sample.center)).toBe(36);
});
