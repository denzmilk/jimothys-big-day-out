import {test,expect} from '@playwright/test';
import {boot,adv} from './helpers.mjs';

test('restart cancels an active roll and its cooldown',async({page})=>{
  await boot(page);
  await page.keyboard.down('c');await adv(page,.2);await page.keyboard.up('c');
  expect(await page.evaluate(()=>window.__game.jimothy.move?.kind)).toBe('roll');
  await page.evaluate(()=>window.restartGame());
  expect(await page.evaluate(()=>({move:window.__game.jimothy.move,cooldown:window.__game.jimothy.moveCooldown}))).toEqual({move:null,cooldown:0});
  await adv(page,.2);
  expect(await page.evaluate(()=>Math.hypot(window.__game.jimothy.body.position.x,window.__game.jimothy.body.position.z))).toBeLessThan(.01);
});
