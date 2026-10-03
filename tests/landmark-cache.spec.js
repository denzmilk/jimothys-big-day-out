import {test,expect} from '@playwright/test';import {boot,adv} from './helpers.mjs';
test('eaten cache food stays spent across travel and returns after restart',async({page})=>{
 await boot(page);await page.waitForFunction(()=>__game.landmarks.ready);await page.evaluate(()=>{const g=__game,s=g.landmarks.sites[0];g.military.update=()=>{};teleportJimothy(s.cache.x,s.cache.z);});await adv(page,8);
 const owner=await page.evaluate(()=>{const g=__game,s=g.trashCans.snacks.find(s=>s.owner?.startsWith('landmark:space-noodle:')&&s.type!=='feast');if(!s)throw Error('No collectible cache snack');window.CACHE=s.owner;teleportJimothy(s.mesh.position.x,s.mesh.position.z);return s.owner;});await adv(page,1);
 expect(await page.evaluate(()=>__game.landmarks.eaten.has(CACHE))).toBe(true);
 await page.evaluate(()=>teleportJimothy(0,0));await adv(page,8);await page.evaluate(()=>{const s=__game.landmarks.sites[0];teleportJimothy(s.approaches[1].x,s.approaches[1].z);});await adv(page,8);
 expect(await page.evaluate(owner=>__game.trashCans.snacks.some(s=>s.owner===owner),owner)).toBe(false);
 await page.evaluate(()=>{restartGame();const s=__game.landmarks.sites[0];teleportJimothy(s.approaches[1].x,s.approaches[1].z);});await adv(page,8);
 expect(await page.evaluate(owner=>__game.trashCans.snacks.some(s=>s.owner===owner),owner)).toBe(true);
});
