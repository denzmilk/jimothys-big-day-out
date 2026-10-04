import {test,expect} from '@playwright/test';import {boot,state} from './helpers.mjs';
for(const borrower of ['bubble gun','giant roll'])test(`${borrower} releases a swimmer near the surface instead of dropping them onto the seabed`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));await boot(page);await page.waitForFunction(()=>__game.tools.ready);
 const r=await page.evaluate(async borrower=>{
  const g=__game,s=g.pedestrians,{eventBus,Events}=await import('/src/core/EventBus.js');teleportJimothy(-850,0);g.voxels.processGeneration();s._graphAround(-850,0);s.populationPending=false;
  const p=s._spawn({x:-850,z:0,key:'release'},0);p.y=-1;p.mesh.position.set(p.x,p.y,p.z);for(let i=0;i<120;i++)s.update(1/60);
  const e=g.collector.entities.get(p.id);let borrowed;
  if(borrower==='bubble gun'){
   borrowed=g.tools.bubble(e);for(let i=0;i<60;i++)g.tools.update(1/60);g.tools.releaseStatus(p.id);
  }else{
   setFatness(120);g.jimothy.body.position.y=0;g.jimothy.diving=true;g.jimothy.postUpdate(0);
   eventBus.emit(Events.ENTITY_ATTACH,{id:p.id});g.jimothy.group.attach(e.mesh);g.collector.attached.push(e);borrowed=p.attached;g.collector.release(1);
  }
  const released=p.mesh.position.y;for(let i=0;i<240;i++)s.update(1/60);
  return{borrowed,released,swimming:p.swimming,attached:p.attached,statuses:g.tools.statuses.size,collected:g.collector.attached.length,y:p.mesh.position.y};
 },borrower);console.log('HUMAN_BORROWER_RELEASE',borrower,JSON.stringify(r));expect(r.borrowed).toBe(true);expect(r.released).toBeGreaterThan(-2);expect(r.swimming).toBe(true);expect(r.attached).toBe(false);expect(r.statuses+r.collected).toBe(0);expect((await state(page)).people.items.some(p=>p.swimming)).toBe(true);expect(errors).toEqual([]);
});
