import {test,expect} from '@playwright/test';
import {boot,adv} from './helpers.mjs';

for(const type of ['craftsman','apartment'])test(`${type} upper structure caves in after a thin cut through all lower supports`,async({page})=>{
 await boot(page);
 const initial=await page.evaluate(async type=>{
  const L=await import('/src/level/Layout.js'),{VOXEL:S}=await import('/src/core/Constants.js');
  const g=__game,v=g.voxels,s=S.SIZE;g.military.update=()=>{};
  const b=L.buildingsIntersecting(-160,-160,160,160).filter(b=>b.type===type).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];
  if(!b)throw new Error(`No ${type} in fixture area`);
  teleportJimothy(b.x-5,b.z-5);
  const span=s*S.CHUNK_XZ;
  for(let x=Math.floor((b.x-2)/span);x<=Math.floor((b.x+b.w+2)/span);x++)for(let z=Math.floor((b.z-2)/span);z<=Math.floor((b.z+b.d+2)/span);z++)v.ensureColumn(x,z);
  window.__collapseSamples=[];window.__collapseSpawn=[];
  const {eventBus,Events}=await import('/src/core/EventBus.js');
  eventBus.on(Events.PROP_CREATE,p=>{if(p.kind==='building')__collapseSpawn.push({id:p.id,y:p.mesh.position.y});});
  const cut=b.vy+((b.vy+1)%4===3?2:1),removed=[];
  for(let x=b.vx-2;x<b.vx+b.vw+2;x++)for(let z=b.vz-2;z<b.vz+b.vd+2;z++){
   for(let y=cut+1;y<b.vy+b.vh+30;y++)if(v.get(x,y,z))__collapseSamples.push([x,y,z]);
   const mat=v.get(x,cut,z);if(mat){v.setEdit(x,cut,z,0);removed.push({x:(x+.5)*s,y:(cut+.5)*s,z:(z+.5)*s,mat});}
  }
  g.demolitionEffects(removed,{x:b.x+b.w/2,y:cut*s,z:b.z+b.d/2});
  return {b,cut,upper:__collapseSamples.length,cutCells:removed.length};
 },type);
 expect(initial.upper).toBeGreaterThan(100);expect(initial.cutCells).toBeGreaterThan(10);
 await adv(page,10);
 const out=await page.evaluate(()=>{
  const g=__game;
  return {remaining:__collapseSamples.filter(p=>g.voxels.get(...p)).length,support:g.structuralSupport.snapshot(),pieces:g.structuralSupport.fragments.map(p=>({id:p.id,drop:(__collapseSpawn.find(s=>s.id===p.id)?.y??p.mesh.position.y)-p.mesh.position.y,physical:g.physics.props.get(p.id)?.body.type===1,registered:g.collector.entities.has(p.id)}))};
 });
 console.log(JSON.stringify({initial,...out}));
 expect(out.remaining).toBeLessThan(initial.upper*.05);
 expect(out.pieces.length).toBeGreaterThan(0);
 expect(out.pieces.every(p=>p.physical&&p.registered)).toBe(true);
 expect(out.pieces.some(p=>p.drop>.5)).toBe(true);
 await page.evaluate(()=>restartGame());
 expect(await page.evaluate(()=>__game.structuralSupport.snapshot())).toMatchObject({pending:0,pieces:0,fragments:0,attached:0});
});
