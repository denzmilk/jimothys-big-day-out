import {test,expect} from '@playwright/test';import {boot,adv,state} from './helpers.mjs';
test('the locks channel has matching excavated ground and swimmable reactive water',async({page})=>{
 await boot(page,{withRig:true});await page.waitForFunction(()=>__game.landmarks.ready);
 const r=await page.evaluate(async()=>{const g=__game,s=g.landmarks.sites.find(s=>s.id==='bandit-locks'),{VOXEL}=await import('/src/core/Constants.js'),x=s.vx*VOXEL.SIZE,z=s.vz*VOXEL.SIZE;g.military.update=()=>{};window.LOCK={x,z};teleportJimothy(x,z);advanceTime(8);return {floor:g.voxels.terrainHeightAt(x,z),water:g.water.sample(x,z),swimming:JSON.parse(render_game_to_text()).water.swimming,dry:g.water.sample(x+10,z-5),clear:!g.voxels.solidAtWorld(x,-1,z)};});
 expect(r.floor).toBeLessThan(-2);expect(r.water?.depth??0).toBeGreaterThan(2);expect(r.swimming).toBe(true);expect(r.dry).toBe(null);expect(r.clear).toBe(true);
 await page.evaluate(()=>{const {x,z}=LOCK;__game.water.react({kind:'impact',x,z,radius:1,speed:5,verticalSpeed:-5,entering:true});});await adv(page,.1);expect((await state(page)).water.ripples).toBeGreaterThan(0);
});
