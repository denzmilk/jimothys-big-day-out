import {test,expect} from '@playwright/test';import {boot,adv} from './helpers.mjs';
test('each chamber family has a real voxel escape route and damage persists across travel',async({page})=>{
 await boot(page);await page.waitForFunction(()=>window.__game.sewerLife.ready);
 const settle=async()=>{for(let i=0;i<20;i++){await adv(page,.5);if(await page.evaluate(()=>window.__game.voxels.stats().pendingColumns===0))return;}throw new Error('streaming did not settle');};
 const rooms=await page.evaluate(()=>window.__game.sewerLife.snapshot().rooms.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).filter((r,i,a)=>a.findIndex(q=>q.kind===r.kind)===i));
 for(const r of rooms){await page.evaluate(r=>window.teleportJimothy(r.x,r.z),r);await settle();const exit=await page.evaluate(r=>window.sewerEscapeRoute(r.x,r.z),r);expect(exit,`${r.kind} chamber has no escape`).toBeTruthy();}
 const r=rooms[0];await page.evaluate(r=>window.teleportJimothy(r.x,r.z),r);await settle();
 const hole=await page.evaluate(r=>{const v=window.__game.voxels,p=v.raycast(r.x,r.y+1.5,r.z,1,0,0,r.radius+3);if(!p)return null;const before=v.removedCount;v.damageSphere(p.x,p.y,p.z,1.2,{digsTerrain:true});return {p,removed:v.removedCount-before,solid:v.solidAtWorld(p.x,p.y,p.z)};},r);
 expect(hole).toBeTruthy();expect(hole.removed).toBeGreaterThan(0);expect(hole.solid).toBe(false);
 await page.evaluate(()=>window.teleportJimothy(500,400));await settle();await page.evaluate(r=>window.teleportJimothy(r.x,r.z),r);await settle();
 expect(await page.evaluate(p=>window.__game.voxels.solidAtWorld(p.x,p.y,p.z),hole.p)).toBe(false);
});
