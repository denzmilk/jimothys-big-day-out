import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';
const descend=async page=>{await boot(page);await page.evaluate(()=>window.teleportJimothy(69,-3));await adv(page,3);};

test('underground has three connected chamber families and a readable arched bore',async({page})=>{
 await descend(page);
 const plan=await page.evaluate(()=>window.__game.sewerLife?.snapshot());
 expect(plan,'no chamber or fixture system').toBeTruthy();
 expect(new Set(plan.rooms.map(r=>r.kind)).size).toBe(3);
 expect(plan.rooms.length).toBeGreaterThanOrEqual(15);
 const layout=await page.evaluate(async()=>{const {rooms,profile}=await import('/src/level/SewerLayout.js');return rooms().map(r=>({id:r.id,core:profile(r.x,r.z),exit:r.exit}));});
 expect(layout.every(r=>r.core.inside&&r.core.height>=4&&r.exit)).toBe(true);
 expect(plan.fixtures).toBeGreaterThan(0);expect(plan.lights).toBeGreaterThan(0);
 expect(await page.evaluate(()=>window.sewerEscapeRoute(69,-3))).toBeTruthy();
});

test('crab people have articulated anatomy, variants and grounded movement',async({page})=>{
 await descend(page);await page.waitForFunction(()=>window.__game.crabs.ready);await adv(page,1);
 const sample=()=>page.evaluate(()=>window.__game.crabs.crabs.map(c=>({id:c.id,kind:c.kind,x:c.x,y:c.y,z:c.z,parts:c.mesh?(()=>{let n=[];c.mesh.traverse(o=>{if(o.name)n.push(o.name);});return n;})():[]})));
 const before=await sample();expect(before.length).toBeGreaterThan(2);expect(new Set(before.map(c=>c.kind)).size).toBe(3);
 for(const c of before){for(const name of ['carapace','leg_0','leg_3','claw_L','claw_R','pincer_L','pincer_R'])expect(c.parts).toContain(name);}
 await adv(page,2);const after=await sample();expect(after.some(c=>{const a=before.find(a=>a.id===c.id);return a&&Math.hypot(a.x-c.x,a.z-c.z)>.5;})).toBe(true);
 const errors=await page.evaluate(()=>window.__game.crabs.crabs.filter(c=>!c.attached).map(c=>c.y-window.__game.voxels.groundHeightAt(c.x,c.z,c.y+.5)));
 expect(Math.max(...errors.map(Math.abs))).toBeLessThan(.1);
});

test('sewer fixtures react to demolition, detach and stop emitting light',async({page})=>{
 await descend(page);
 const r=await page.evaluate(async()=>{const s=window.__game.sewerLife;if(!s)return null;const p=s.items.find(p=>p.lamp);if(!p)return null;const {eventBus,Events}=await import('/src/core/EventBus.js');const before={loose:p.loose,light:p.lamp.intensity};eventBus.emit(Events.WORLD_IMPACT,{...p.mesh.position,radius:2,source:'headbutt'});return {before,after:{loose:p.loose,light:p.lamp.intensity},id:p.id};});
 expect(r).toBeTruthy();expect(r.before.light).toBeGreaterThan(0);expect(r.after.loose).toBe(true);expect(r.after.light).toBe(0);
 await adv(page,1);expect((await state(page)).underground.below).toBe(true);
});

test('underground resets its bounded actors and fixtures when restarting',async({page})=>{
 await descend(page);
 const result=await page.evaluate(()=>{const g=window.__game;if(!g.sewerLife)return null;const before=g.sewerLife.items.length;g.sewerLife.reset();g.crabs.reset();return {before,fixtures:g.sewerLife.items.length,crabs:g.crabs.crabs.length};});
 expect(result).toBeTruthy();expect(result.before).toBeGreaterThan(0);expect(result.fixtures).toBe(0);expect(result.crabs).toBe(0);
});

test('a rolling passenger released underground stays underground and alive',async({page})=>{
 await descend(page);await page.waitForFunction(()=>window.__game.crabs.ready);await adv(page,.5);
 const result=await page.evaluate(()=>{const g=window.__game,c=g.crabs.crabs[0],e=g.collector.entities.get(c.id);g.collector.drop(e);return {alive:g.crabs.crabs.includes(c),depth:g.voxels.terrainHeightAt(c.x,c.z)-c.y,attached:c.attached};});
 expect(result.alive).toBe(true);expect(result.attached).toBe(false);expect(result.depth).toBeGreaterThan(3);
});
