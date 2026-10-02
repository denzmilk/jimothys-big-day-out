import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';
import {SNACKS,FOODS} from '../src/core/Constants.js';

test('spilled food has a persistent model identity and a matching pickup payout',async({page})=>{
 await boot(page);
 const foods=await page.evaluate(()=>{const t=window.__game.trashCans;t.clearSnacks();t.spillFrom(t.cans[0]);return t.snacks.map(s=>({name:s.name,foodId:s.foodId,type:s.type}));});
 expect(foods.length).toBeGreaterThan(0);
 for(const f of foods){expect([...SNACKS.NAMES,...FOODS.FEAST.NAMES]).toContain(f.name);expect(f.foodId).toBeTruthy();}
 const result=await page.evaluate(async()=>{const {eventBus,Events}=await import('/src/core/EventBus.js');const g=window.__game,t=g.trashCans,s=t.snacks.find(s=>s.type==='scrap');let payout;eventBus.on(Events.PLAYER_PICKUP,e=>payout=e);const name=s.name;g.jimothy.body.position.copy(s.mesh.position);g.jimothy.body.position.y+=g.jimothy.radius;t.update(.01);return {name,payout};});
 expect(result.payout.name).toBe(result.name);expect(result.payout.points).toBe(FOODS.SCRAP.POINTS);
});

test('food on another floor is not collected and feast interruption resets the channel',async({page})=>{
 await boot(page);
 const result=await page.evaluate(()=>{const g=window.__game,t=g.trashCans,j=g.jimothy;t.clearSnacks();const x=j.body.position.x,z=j.body.position.z,vy=Math.ceil((j.body.position.y+4)/.22);g.voxels.set(Math.floor(x/.22),vy,Math.floor(z/.22),6);const s=t.spawnFood('whole-pizza',x,z,(vy+1)*.22+.035);j.vel.set(0,0,0);t.update(2);const retained=t.snacks.includes(s);g.voxels.set(Math.floor(x/.22),vy,Math.floor(z/.22),0);s.baseY=j.body.position.y-j.radius;t.update(.4);const partial=s.progress;j.vel.set(4,0,0);t.update(.1);const reset=s.progress;j.vel.set(0,0,0);t.update(.4);return {retained,partial,reset,retainedAfter:t.snacks.includes(s)};});
 expect(result.retained).toBe(true);expect(result.partial).toBeGreaterThan(0);expect(result.reset).toBe(0);expect(result.retainedAfter).toBe(true);
});
