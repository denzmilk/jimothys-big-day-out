import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';
const shore={x:70,z:-700,ux:1/3,uz:-Math.sqrt(8/9)};
test('footsteps and rolling leave physical tracks that persist and reset',async({page})=>{
 await boot(page,{withRig:true});expect((await state(page)).sand).toBeDefined();
 await page.evaluate(p=>{teleportJimothy(p.x+p.ux*18,p.z+p.uz*18);faceJimothy(Math.atan2(p.uz,-p.ux));},shore);
 await adv(page,.3);await page.keyboard.down('w');await adv(page,1);await page.keyboard.up('w');
 const r=await page.evaluate(()=>{const g=__game,f=g.sand.field;let best=null;for(const [key,c]of f.cells){if(!best||c.depth<best.depth)best={key,...c};}if(!best)return null;const [ix,iz]=best.key.split(',').map(Number),x=ix*f.cell,z=iz*f.cell,base=g.voxels.terrainHeightAt(x,z);return{x,z,depth:best.depth,ground:g.voxels.groundHeightAt(x,z,base+.2),base,render:f.renderSample(x,z),solid:g.voxels.solidAtWorld(x,base-.001,z),cells:f.cells.size};});
 expect(r).not.toBeNull();expect(r.cells).toBeGreaterThan(0);expect(r.ground).toBeLessThan(r.base-.005);expect(Math.abs(r.ground-r.base-r.render)).toBeLessThan(.02);expect(r.solid).toBe(false);
 await page.keyboard.down('c');await adv(page,.7);await page.keyboard.up('c');expect((await state(page)).sand.stamps).toBeGreaterThan(2);
 await page.evaluate(()=>teleportJimothy(0,0));await adv(page,.1);await page.evaluate(p=>teleportJimothy(p.x,p.z),r);await adv(page,.1);expect(await page.evaluate(p=>__game.sand.field.sample(p.x,p.z),r)).toBeLessThan(-.005);
 await page.evaluate(()=>restartGame());expect((await state(page)).sand.cells).toBe(0);
});
