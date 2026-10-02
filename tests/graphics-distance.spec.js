import {test,expect}from '@playwright/test';import{boot,adv,state}from './helpers.mjs';
test('quality presets change real view/shadow/detail budgets and survive restart',async({page})=>{
 await boot(page);expect(await page.evaluate(()=>!!window.__game.quality)).toBe(true);
 await page.locator('#graphics-panel').evaluate(e=>e.open=true);await page.selectOption('#graphics-quality','high');await adv(page,.1);
 const high=await page.evaluate(()=>({q:__game.quality.snapshot(),far:__game.camera.far,shadow:__game.sun.shadow.mapSize.x}));
 await page.selectOption('#graphics-quality','low');await adv(page,.1);const low=await page.evaluate(()=>({q:__game.quality.snapshot(),far:__game.camera.far,shadow:__game.sun.shadow.mapSize.x}));
 expect(low.far).toBeLessThan(high.far);expect(low.shadow).toBeLessThan(high.shadow);expect(low.q.columns).toBeLessThan(high.q.columns);expect(low.q.pixelRatio).toBeLessThanOrEqual(high.q.pixelRatio);
 await page.evaluate(()=>window.restartGame());await adv(page,.1);expect((await state(page)).render.quality.preset).toBe('low');expect((await state(page)).voxels.columns).toBeLessThanOrEqual(25);
});
test('distant buildings retain varied footprints and cannot heal after local destruction',async({page})=>{
 await boot(page);const lod=await page.evaluate(()=>{const g=__game,f=g.farBuildings;if(!f)return null;return{state:f.snapshot(),bad:f.entries.filter(e=>{const b=e.building;return Math.abs((e.box.max.x-e.box.min.x)-b.vw*.22)>.1||Math.abs((e.box.max.z-e.box.min.z)-b.vd*.22)>.1;}).length};});
 expect(lod).not.toBeNull();expect(lod.state.buildings).toBeGreaterThan(100);expect(lod.state.styles.length).toBeGreaterThanOrEqual(8);expect(lod.bad).toBe(0);expect(lod.state.capacity).toBeLessThan(lod.state.vertices*1.2);
 const removed=await page.evaluate(()=>{
  const g=__game,entries=[...g.farBuildings.entries].sort((a,b)=>a.box.distanceToPoint(g.jimothy.position)-b.box.distanceToPoint(g.jimothy.position));
  // The den found by findWallTarget is bespoke and has no distant counterpart.
  for(const {box}of entries.slice(0,8))for(let x=box.min.x+.11;x<box.max.x;x+=.44)for(let z=box.min.z+.11;z<box.max.z;z+=.44){
   const y=box.min.y+2;if(g.voxels.solidAtWorld(x,y,z)&&y>g.voxels.terrainHeightAt(x,z)+.44)return g.blastAt({x,y,z},1,{digsTerrain:false});
  }return 0;
 });expect(removed).toBeGreaterThan(0);await adv(page,.2);
 const before=(await state(page)).render.farBuildings.damaged;expect(before).toBeGreaterThan(0);
 await page.evaluate(()=>window.teleportJimothy(450,-150));await adv(page,.2);expect((await state(page)).render.farBuildings.damaged).toBe(before);
 await page.evaluate(()=>window.restartGame());await adv(page,.1);expect((await state(page)).render.farBuildings.damaged).toBe(0);
});
