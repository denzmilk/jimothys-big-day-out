import {test,expect} from '@playwright/test';import {boot,adv} from './helpers.mjs';
test('undermined street props fall and their traffic control is released',async({page})=>{
 await boot(page);const before=await page.evaluate(()=>{const g=__game,v=g.voxels;g.military.update=()=>{};const p=g.streetLife.spawn('support-fixture','hydrant',{x:-2,z:-20,seed:0},false);window.__supportProp=p;const y=v.terrainHeightAt(-2,-20);v.queueGroundChannel({x:-2,y,z:-20},{x:-2,y,z:-20},5,3);return p.mesh.position.y;});
 await adv(page,3);const after=await page.evaluate(()=>({y:__supportProp.mesh.position.y,loose:__supportProp.loose}));expect(after.loose).toBe(true);expect(before-after.y).toBeGreaterThan(2);
});
test('vegetation and ground animals follow the excavated ground',async({page})=>{
 await boot(page);const before=await page.evaluate(()=>{const g=__game,e=g.environmentLife;g.military.update=()=>{};const p=e.plants.find(p=>Math.hypot(p.x-g.jimothy.position.x,p.z-g.jimothy.position.z)<50);window.__supportPlant=p;const y=g.voxels.terrainHeightAt(p.x,p.z);g.voxels.queueGroundChannel({...p,y},{...p,y},6,3);return {x:p.x,y:p.y,z:p.z,key:p.key};});await adv(page,2);
 const after=await page.evaluate(()=>{const p=__supportPlant,v=__game.voxels;return {y:p.y,floor:v.groundHeightAt(p.x,p.z,p.y+10)};});expect(before.y-after.y).toBeGreaterThan(2);expect(Math.abs(after.y-after.floor)).toBeLessThan(.25);
});
test('an undermined house loses unsupported voxels and produces falling collectible building pieces',async({page})=>{
 await boot(page);const before=await page.evaluate(async()=>{
  const L=await import('/src/level/Layout.js'),g=__game,v=g.voxels;g.military.update=()=>{};
  const b=L.buildingsIntersecting(-45,-45,45,45).filter(b=>b.type==='craftsman').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];window.__supportBuilding=b;
  const s=.22,x=b.x+b.w/2,z=b.z+b.d/2,y=v.terrainHeightAt(x,z);window.__roofCells=[];
  for(let ix=b.vx;ix<b.vx+b.vw;ix++)for(let iz=b.vz;iz<b.vz+b.vd;iz++)for(let iy=b.vy+b.vh;iy<b.vy+b.vh+20;iy++)if(v.get(ix,iy,iz))__roofCells.push([ix,iy,iz]);
  v.queueGroundChannel({x,y,z},{x,y,z},Math.hypot(b.w,b.d)*2,6.5);return {b,roof:__roofCells.length};
 });await adv(page,10);const out=await page.evaluate(()=>({remaining:__roofCells.filter(p=>__game.voxels.get(...p)).length,ground:__game.groundChannels.snapshot(),cuts:[[0,0],[8,0],[0,9],[8,9]].map(([x,z])=>{const b=__supportBuilding,v=__game.voxels;return [v.terrainHeightAt(b.x+x,b.z+z),v.channels.sample(b.x+x,b.z+z)];}),support:__game.structuralSupport.snapshot(),fragments:__game.structuralSupport.fragments.map(p=>({y:p.mesh.position.y,kind:p.kind,registered:__game.collector.entities.has(p.id)}))}));console.log(JSON.stringify({before,...out}));expect(before.roof).toBeGreaterThan(0);expect(out.remaining).toBeLessThan(before.roof*.1);expect(out.fragments.length).toBeGreaterThan(0);expect(out.fragments.every(p=>p.registered)).toBe(true);
 await page.evaluate(()=>restartGame());expect(await page.evaluate(()=>__game.structuralSupport.snapshot())).toMatchObject({pending:0,pieces:0,fragments:0,attached:0});
});
