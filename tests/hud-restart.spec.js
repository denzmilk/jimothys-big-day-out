import {test,expect} from '@playwright/test';
import {boot,state} from './helpers.mjs';

test('restart clears displayed score fatness combo and wanted level before the next pickup',async({page})=>{
 await boot(page);
 await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js');
  eventBus.emit(Events.PLAYER_PICKUP,{name:'Test snack',points:25,fat:2});
  eventBus.emit(Events.PLAYER_PICKUP,{name:'Test snack',points:25,fat:2});
  eventBus.emit(Events.TOOL_CHAOS,{points:60});
 });
 const before=await state(page);
 expect(before.score).toBeGreaterThan(0);expect(before.heat.tier).toBeGreaterThan(0);
 await expect(page.locator('#score')).toHaveText(`SCORE ${before.score}`);
 await expect(page.locator('#combo')).toContainText('x2');
 await page.evaluate(()=>restartGame());
 const after=await state(page);
 expect(after.score).toBe(0);expect(after.heat.tier).toBe(0);
 await expect(page.locator('#score')).toHaveText('SCORE 0');
 await expect(page.locator('#fat')).toHaveText('FAT 0');
 await expect(page.locator('#combo')).toHaveText('');
 await expect(page.locator('#heat')).toContainText('☆☆☆☆☆');
});
