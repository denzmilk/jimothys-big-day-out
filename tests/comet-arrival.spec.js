import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';
import {CAMERA} from '../src/core/Constants.js';

test('arrival descends with the loaded rig and ignores attacks',async({page})=>{
 await boot(page,{withRig:true,arrival:true});
 const first=await state(page);expect(first.arrival?.phase).toBe('falling');
 expect(first.jimothy.y-first.arrival.ground).toBeGreaterThan(50);
 expect(first.rig.loaded).toBe(true);expect(first.arrival.fire).toBeGreaterThan(0);
 await page.keyboard.down('w');await page.keyboard.down('c');await page.keyboard.down('Space');await adv(page,1);await page.keyboard.up('w');await page.keyboard.up('c');await page.keyboard.up('Space');
 const later=await state(page);expect(later.jimothy.y).toBeLessThan(first.jimothy.y-8);expect(later.arrival.phase).toBe('falling');expect(later.jimothy.move).toBeNull();expect(later.arrival.impacts).toBe(0);
 expect(later.arrival.trail).toBeGreaterThan(0);expect(later.game.isPlaying).toBe(false);
});

test('impact leaves a small crater and returns control',async({page})=>{
 await boot(page,{arrival:true});expect((await state(page)).arrival?.phase).toBe('falling');
 await page.keyboard.press('Shift');await page.waitForFunction(()=>__game.arrival.audio?.state==='running');
 await adv(page,3.15);const crash=await state(page);expect(crash.arrival.impacts).toBe(1);expect(crash.explosions.total).toBe(1);expect(crash.arrival.shockwave).toBeGreaterThan(0);expect(crash.voxels.removed).toBeGreaterThan(0);
 expect(crash.arrival.soundNodes).toBe(2);
 await adv(page,4);const end=await state(page);expect(end.arrival.phase).toBe('done');expect(end.game.isPlaying).toBe(true);expect(end.jimothy.grounded).toBe(true);expect(end.arrival.ground-end.jimothy.y).toBeGreaterThan(.45);expect(end.arrival.ground-end.jimothy.y).toBeLessThan(1.6);
 expect(end.heat.tier).toBe(0);expect(end.heat.points).toBe(0);expect(end.score).toBe(0);expect(end.arrival.fire+end.arrival.trail+end.arrival.dust).toBe(0);
 const terrain=await page.evaluate(()=>{const g=__game;return{outside:g.voxels.groundHeightAt(8,0,g.voxels.terrainHeightAt(8,0)+2),expected:g.voxels.terrainHeightAt(8,0),fov:g.camera.fov};});expect(Math.abs(terrain.outside-terrain.expected)).toBeLessThan(.25);expect(terrain.fov).toBeCloseTo(CAMERA.FOV,2);
 const before=end.jimothy;await page.keyboard.down('w');await adv(page,2);await page.keyboard.up('w');const walking=await state(page);expect(Math.hypot(walking.jimothy.x-before.x,walking.jimothy.z-before.z)).toBeGreaterThan(3);expect(walking.jimothy.grounded).toBe(true);expect(walking.arrival.impacts).toBe(1);
 await page.waitForFunction(()=>__game.arrival.soundNodes.length===0);
});

test('restart replaces an active arrival and clears its effects',async({page})=>{
 await boot(page,{arrival:true});expect((await state(page)).arrival?.phase).toBe('falling');
 await page.keyboard.press('Shift');await page.waitForFunction(()=>__game.arrival.audio?.state==='running');
 await adv(page,1);expect(await page.evaluate(()=>{restartGame();return __game.arrival.soundNodes.length;})).toBe(0);await adv(page,.1);const restart=await state(page);expect(restart.arrival.phase).toBe('falling');expect(restart.arrival.impacts).toBe(0);expect(restart.jimothy.y-restart.arrival.ground).toBeGreaterThan(50);
 await adv(page,3.2);expect((await state(page)).arrival.impacts).toBe(1);
 // Compare this feature's resources. Nearby world populations change between
 // the frozen impact and resumed gameplay and are not a spawn-effect leak.
 const resources=await page.evaluate(()=>__game.scene.children.filter(o=>o.name.startsWith('comet-')).map(o=>o.uuid));expect(resources).toHaveLength(6);
 await page.evaluate(()=>restartGame());await adv(page,7);const end=await state(page);expect(end.arrival.impacts).toBe(1);expect(end.arrival.phase).toBe('done');expect(end.arrival.fire+end.arrival.trail+end.arrival.dust).toBe(0);expect(end.explosions.total).toBe(1);
 expect(await page.evaluate(()=>__game.scene.children.filter(o=>o.name.startsWith('comet-')).map(o=>o.uuid))).toEqual(resources);
 expect(await page.locator('.comet-flash').count()).toBe(1);expect(end.arrival.wake).toBe(0);
});
