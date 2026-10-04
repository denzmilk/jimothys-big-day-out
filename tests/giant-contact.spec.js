import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

for(const fat of [250,400])test(`closed-door contact cannot cancel the giant ${fat} demolition wind-up`,async({page})=>{
 await boot(page);await page.evaluate(fat=>{
  const g=__game,w=findWallTarget();setFatness(fat);teleportJimothy(w.x,w.z);faceJimothy(w.yaw);
  window.__contactImpacts=0;const impact=g.jimothy.onImpact;g.jimothy.onImpact=(...args)=>{__contactImpacts++;impact(...args);};
 },fat);
 await adv(page,.3);await page.keyboard.press('e');await adv(page,.4);
 expect(await page.evaluate(()=>__contactImpacts)).toBe(1);
 await adv(page,1);expect((await state(page)).voxels.removed).toBeGreaterThan(100);
});
