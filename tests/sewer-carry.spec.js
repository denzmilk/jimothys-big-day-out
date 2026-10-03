import {test,expect} from '@playwright/test';import {boot,adv} from './helpers.mjs';
test('sewer passengers released on the surface remain visible and equipment keeps its displaced position',async({page})=>{
 await boot(page);await page.evaluate(()=>window.teleportJimothy(69,-3));await adv(page,3);await page.waitForFunction(()=>window.__game.crabs.ready&&window.__game.sewerLife.ready);
 const r=await page.evaluate(async()=>{const g=window.__game,{eventBus,Events}=await import('/src/core/EventBus.js'),c=g.crabs.crabs[0],p=g.sewerLife.items[0];
  eventBus.emit(Events.ENTITY_ATTACH,{id:c.id});eventBus.emit(Events.ENTITY_ATTACH,{id:p.id});window.teleportJimothy(0,0);const ground=g.voxels.groundHeightAt(3,0,g.voxels.terrainHeightAt(3,0)+1),position={x:3,y:ground+1,z:0};
  eventBus.emit(Events.ENTITY_RELEASE,{id:c.id,position,ground});eventBus.emit(Events.ENTITY_RELEASE,{id:p.id,position,ground});g.crabs.update(.1);g.sewerLife.update(.1);
  return {crab:g.crabs.crabs.includes(c)&&c.mesh.parent===g.scene,prop:g.sewerLife.items.includes(p)&&g.physics.props.has(p.id)};
 });expect(r.crab).toBe(true);expect(r.prop).toBe(true);
});
