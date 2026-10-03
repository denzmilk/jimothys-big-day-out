import {test,expect} from '@playwright/test';import {boot,adv,state} from './helpers.mjs';
test('a held giant roll leaves a continuous crash channel with a physical floor',async({page})=>{
 await boot(page);await page.evaluate(()=>{setFatness(250);teleportJimothy(-2,-40);faceJimothy(0);__game.military.update=()=>{};});await adv(page,.2);
 const start=await state(page);await page.keyboard.down('c');await adv(page,1.1);await page.keyboard.up('c');const end=await state(page);await adv(page,3);
 const report=await page.evaluate(({start,end})=>{
  const v=__game.voxels,depths=[];for(let k=.1;k<.9;k+=.05){const x=start.x+(end.x-start.x)*k,z=start.z+(end.z-start.z)*k,grade=v.terrainHeightAt(x,z);depths.push(grade-v.groundHeightAt(x,z,grade+.05));}
  const s=JSON.parse(render_game_to_text());return{depths,pending:s.voxels.pendingDamage,mesh:s.voxels.pendingMeshes,removed:s.voxels.removed};
 },{start:start.jimothy,end:end.jimothy});console.log(JSON.stringify(report));
 expect(Math.hypot(end.jimothy.x-start.jimothy.x,end.jimothy.z-start.jimothy.z)).toBeGreaterThan(20);
 for(const d of report.depths){expect(d).toBeGreaterThan(.4);expect(d).toBeLessThan(7.2);}
 expect(report.pending).toBe(0);expect(report.removed).toBeGreaterThan(1000);
 await page.evaluate(()=>restartGame());await adv(page,.1);expect((await state(page)).voxels.removed).toBe(0);
});
