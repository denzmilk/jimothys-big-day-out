import{test,expect}from'@playwright/test';import{boot,adv,state}from'./helpers.mjs';
async function ocean(page,rig=false){await boot(page,{withRig:rig});expect((await state(page)).ocean).toBeDefined();await page.waitForFunction(()=>__game.ocean.ready);}
test('dive controls reach the seabed, hold depth and return to the surface',async({page})=>{
 await ocean(page,true);await page.evaluate(()=>teleportJimothy(-850,0));await adv(page,1);
 await page.keyboard.down('q');await adv(page,3);await page.keyboard.up('q');const deep=await state(page);expect(deep.water.diving).toBe(true);expect(deep.jimothy.y).toBeLessThan(-4);expect(deep.ocean.underwater).toBe(true);
 const y=deep.jimothy.y;await adv(page,.5);expect(Math.abs((await state(page)).jimothy.y-y)).toBeLessThan(.25);
 await page.keyboard.down('Space');await adv(page,5);await page.keyboard.up('Space');expect((await state(page)).water.diving).toBe(false);expect((await state(page)).water.swimming).toBe(true);
 await page.evaluate(()=>teleportJimothy(4,25));await adv(page,.3);expect((await state(page)).water.swimming).toBe(false);expect((await state(page)).ocean.underwater).toBe(false);
});
test('separate sites stream with creatures, breakable wrecks and persistent damage',async({page})=>{
 await ocean(page);const r=await page.evaluate(async()=>{const g=__game,s=g.ocean.sites.find(s=>s.kind==='wreck');teleportJimothy(s.x,s.z);advanceTime(.5);const before=g.ocean.snapshot(),part=g.ocean.parts.find(p=>p.site===s.id),id=part.id;const{eventBus,Events}=await import('/src/core/EventBus.js');eventBus.emit(Events.WORLD_IMPACT,{...part.mesh.position,radius:3});advanceTime(.2);const broken=g.ocean.snapshot();teleportJimothy(0,0);advanceTime(.5);teleportJimothy(s.x,s.z);advanceTime(.5);return{before,broken,after:g.ocean.snapshot(),original:g.ocean.parts.some(p=>p.id===id&&!p.loose)};});
 expect(r.before.sites.length).toBeGreaterThan(0);expect(r.before.fish).toBeGreaterThan(0);expect(r.before.plants).toBeGreaterThan(0);expect(r.broken.damage).toBeGreaterThan(0);expect(r.original).toBe(false);expect(r.after.damage).toBe(r.broken.damage);
 await page.evaluate(()=>restartGame());const reset=(await state(page)).ocean;expect(reset.damage).toBe(0);expect(reset.loose).toBe(0);expect(reset.bubbles).toBe(0);
});
test('underwater daylight rays fade at night and bubbles stay pooled',async({page})=>{
 await ocean(page);const r=await page.evaluate(async()=>{const g=__game;teleportJimothy(-850,0);g.jimothy.body.position.y=-5;g.jimothy.diving=true;const{gameState}=await import('/src/core/GameState.js');gameState.world.daylight=1;g.camera.position.set(-850,-3,0);g.ocean.afterCamera(.1);g.ocean.update(.3);const day=g.ocean.snapshot();gameState.world.daylight=0;g.ocean.afterCamera(.1);return{day,night:g.ocean.snapshot()};});
 expect(r.day.rays).toBeGreaterThan(0);expect(r.night.rays).toBe(0);expect(r.day.bubbles).toBeGreaterThan(0);expect(r.day.bubbles).toBeLessThanOrEqual(160);
});

test('fish schools remain continuous when the nearby plant window moves',async({page})=>{
 await ocean(page);const r=await page.evaluate(()=>{const g=__game;teleportJimothy(-850,0);advanceTime(.6);const ids=g.ocean.fish.map(f=>f.mesh.uuid);g.jimothy.body.position.x+=17;g.ocean.populateHabitat();return{before:ids,after:g.ocean.fish.map(f=>f.mesh.uuid)};});expect(r.before.length).toBeGreaterThan(0);expect(r.after.some(id=>r.before.includes(id))).toBe(true);
});

test('travelling between habitats retains all three small fish species and a larger swimmer',async({page})=>{
 await ocean(page);const samples=await page.evaluate(()=>{
  const g=__game;teleportJimothy(-850,0);advanceTime(.6);const samples=[];
  // Travel can evict one school before its neighbours. Reproduce that valid
  // streaming state so the first species cannot consume the vacated slots.
  for(const f of g.ocean.fish.filter(f=>f.kind==='fish-striped'))f.home={x:g.jimothy.position.x-70,z:g.jimothy.position.z};
  for(let i=0;i<10;i++){g.jimothy.body.position.z+=17;g.jimothy.postUpdate(0);g.ocean.populateHabitat();samples.push({small:[...new Set(g.ocean.fish.filter(f=>!f.large).map(f=>f.kind))],large:g.ocean.fish.filter(f=>f.large).length,total:g.ocean.fish.length});}
  return samples;
 });for(const s of samples){expect(s.small.sort()).toEqual(['fish-blue','fish-silver','fish-striped']);expect(s.large).toBe(1);expect(s.total).toBeLessThanOrEqual(13);}
});
