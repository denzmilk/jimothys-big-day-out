import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';
test.describe.configure({mode:'serial'});
for(const fat of [250,400])test(`an actual headbutt at fatness ${fat} reaches buildings and spares the road`,async({page})=>{
 await boot(page);const wall=await page.evaluate(()=>window.findWallTarget());
 await page.evaluate(([w,f])=>{window.setFatness(f);window.teleportJimothy(w.x,w.z);window.faceJimothy(w.yaw);},[wall,fat]);
 await adv(page,.3);const before=await state(page);
 const ground=async()=>page.evaluate(w=>{const v=window.__game.voxels,s=.22;return [-10,0,10].flatMap(dx=>[-10,0,10].map(dz=>{const [x,,z]=v.worldToVoxel(w.x+dx,0,w.z+dz),y=v.terrain.topSolidVoxelY((x+.5)*s,(z+.5)*s);return v.get(x,y,z);}));},wall);
 const floor=await ground();
 await page.keyboard.press('e');await adv(page,2);
 const after=await state(page);expect(after.voxels.removed-before.voxels.removed).toBeGreaterThan(100);
 // Raised building foundations can break; the authored ground itself survives.
 expect(await ground()).toEqual(floor);
 expect(after.voxels.pendingDamage).toBe(0);
});
test('sustained giant rolling damages buildings with bounded work and clears pending damage on restart',async({page})=>{
 await boot(page);const wall=await page.evaluate(()=>window.findWallTarget());
 await page.evaluate(w=>{window.setFatness(250);window.teleportJimothy(w.x,w.z);window.faceJimothy(w.yaw);},wall);await adv(page,.3);
 await page.keyboard.down('c');await adv(page,2);await page.keyboard.up('c');
 const s=await state(page);expect(s.voxels.removed).toBeGreaterThan(100);expect(s.voxels.pendingDamage).toBeLessThanOrEqual(4);
 await page.evaluate(()=>window.restartGame());await adv(page,.1);expect((await state(page)).voxels.pendingDamage).toBe(0);
});
