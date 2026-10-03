import {test,expect} from '@playwright/test';import {boot,adv,state} from './helpers.mjs';
test('opening the map releases mouse capture and selecting a site returns keyboard control',async({page})=>{
 await boot(page);await page.waitForFunction(()=>__game.landmarks.ready);
 await page.evaluate(()=>{window.unlocks=0;document.exitPointerLock=()=>{window.unlocks++;};});await page.keyboard.press('m');expect(await page.evaluate(()=>window.unlocks)).toBe(1);
 await page.locator('#landmark-destinations button').first().click();await expect(page.locator('canvas').first()).toBeFocused();const before=(await state(page)).jimothy;await page.keyboard.down('w');await adv(page,.4);await page.keyboard.up('w');const after=(await state(page)).jimothy;expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeGreaterThan(.1);
});
