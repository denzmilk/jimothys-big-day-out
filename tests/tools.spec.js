import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';
test('physical tools can be equipped, used, refuelled by eating, swapped and dropped',async({page})=>{
 await boot(page);let s=await state(page);expect(s.tools?.catalog?.length||0).toBeGreaterThanOrEqual(8);
 await page.waitForFunction(()=>__game.tools.ready);await page.evaluate(async()=>{window.__toolState=(await import('/src/core/GameState.js')).gameState;});
 await page.evaluate(()=>{const g=__game;g.military.update=()=>{};const p=g.tools.pickups[0];teleportJimothy(p.mesh.position.x,p.mesh.position.z);});await adv(page,.1);await page.keyboard.press('t');await adv(page,.05);
 s=await state(page);expect(s.tools.equipped).toBe('power-washer');expect(s.tools.heldVisible).toBe(true);const fuel=s.tools.energy;
 await page.mouse.down();await adv(page,.4);await page.mouse.up();s=await state(page);expect(s.tools.energy).toBeLessThan(fuel);const used=s.tools.energy,oldFat=s.fatness;
 await page.evaluate(()=>{const g=__game,j=g.jimothy.position;g.trashCans.spawnFood('pizza-slice',j.x,j.z);});await adv(page,.2);s=await state(page);expect(s.tools.energy).toBeGreaterThan(used);expect(s.fatness).toBeGreaterThan(oldFat);
 await page.evaluate(()=>{const g=__game,p=g.tools.pickups.find(p=>p.type==='bubble-gun');teleportJimothy(p.mesh.position.x,p.mesh.position.z);});await adv(page,.1);await page.keyboard.press('t');await adv(page,.05);expect((await state(page)).tools.equipped).toBe('bubble-gun');
 await page.keyboard.press('g');await adv(page,.1);expect((await state(page)).tools.equipped).toBe(null);
 await page.evaluate(()=>restartGame());s=await state(page);expect(s.tools.equipped).toBe(null);expect(s.tools.effects).toBe(0);expect(s.tools.statuses).toBe(0);
});
test('empty energy and suppressed input cannot use tools; models and world bodies are bounded',async({page})=>{
 await boot(page);expect((await state(page)).tools?.catalog?.length||0).toBeGreaterThanOrEqual(8);await page.waitForFunction(()=>__game.tools.ready);await page.evaluate(async()=>{window.__toolState=(await import('/src/core/GameState.js')).gameState;});
 const r=await page.evaluate(()=>{const g=__game,t=g.tools;t.equip(t.pickups[0]);__toolState.tools.energy=0;const before=t.shots;t.use(.2);return {before,after:t.shots,models:t.models.size,physical:t.pickups.every(p=>g.physics.props.has(p.id)),limit:t.snapshot().limit};});expect(r.after).toBe(r.before);expect(r.models).toBeGreaterThanOrEqual(8);expect(r.physical).toBe(true);
 await page.evaluate(()=>{__toolState.tools.energy=50;__game.input.suppressed=true;});await page.mouse.down();await adv(page,.3);await page.mouse.up();expect((await state(page)).tools.energy).toBe(50);
 const resource=await page.evaluate(()=>{const t=__game.tools;return {count:t.pickups.length,limit:t.snapshot().limit}});expect(resource.count).toBeLessThanOrEqual(resource.limit);
});
test('gamepad tool controls do not steal dive/fly controls and rolling stows equipment',async({page})=>{
 await boot(page);await page.waitForFunction(()=>__game.tools.ready);await page.evaluate(()=>{const t=__game.tools,p=t.pickups[0];teleportJimothy(p.mesh.position.x,p.mesh.position.z);window.__pad={connected:true,id:'tool-test',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[__pad];__pad.buttons[4].pressed=true;});await adv(page,.1);expect((await state(page)).tools.equipped).toBe('power-washer');
 const energy=(await state(page)).tools.energy;await page.evaluate(()=>{__pad.buttons[4].pressed=false;__pad.buttons[5].pressed=true;});await adv(page,.25);expect((await state(page)).tools.energy).toBeLessThan(energy);
 await page.evaluate(()=>{__pad.buttons[5].pressed=false;setFatness(90);});await page.keyboard.down('c');await adv(page,.25);expect((await state(page)).tools.heldVisible).toBe(false);await page.keyboard.up('c');await adv(page,1);
 await page.evaluate(()=>{__pad.buttons[1].pressed=true;});await adv(page,.1);expect((await state(page)).tools.equipped).toBe(null);
});
