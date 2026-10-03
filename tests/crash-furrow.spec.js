import {test,expect} from '@playwright/test';import {boot,adv} from './helpers.mjs';
test('maximum-size rolling immediately leaves a broad gouge and raised dirt banks',async({page})=>{
 await boot(page);await page.evaluate(()=>{setFatness(400);teleportJimothy(-2,-40);faceJimothy(0);__game.military.update=()=>{};});await adv(page,.2);
 await page.keyboard.down('c');await adv(page,.8);await page.keyboard.up('c');
 const report=await page.evaluate(()=>{
  const g=__game,v=g.voxels,z=-20,points=[-2,13,31].map(x=>{const grade=v.terrainHeightAt(x,z);return {x,offset:v.groundHeightAt(x,z,grade+8)-grade,render:g.groundChannels?.field.renderSample(x,z)??0};});
  return {points,voxels:v.stats(),ground:g.groundChannels?.snapshot()};
 });console.log(JSON.stringify(report));
 expect(report.points[0].offset).toBeLessThan(-3);expect(report.points[1].offset).toBeLessThan(-1);expect(report.points[2].offset).toBeGreaterThan(.4);
 for(const p of report.points)expect(Math.abs(p.offset-p.render)).toBeLessThan(.25);
});
test('a crash furrow survives travel and clears on restart without millions of voxel edits',async({page})=>{
 await boot(page);const report=await page.evaluate(()=>{
  const g=__game,v=g.voxels;setFatness(400);teleportJimothy(-2,-40);const y=v.terrainHeightAt(-2,-40);
  for(let z=-40;z<40;z+=4)v.queueGroundChannel({x:-2,y:v.terrainHeightAt(-2,z),z},{x:-2,y:v.terrainHeightAt(-2,z+4),z:z+4},28,6);advanceTime(4);
  const x=-2,z=-20,grade=v.terrainHeightAt(x,z),before=v.groundHeightAt(x,z,grade+1)-grade,edits=v.stats().edits;
  teleportJimothy(800,500);advanceTime(1);teleportJimothy(x,z);advanceTime(1);const after=v.groundHeightAt(x,z,grade+1)-grade;
  restartGame();return{before,after,edits,reset:v.groundHeightAt(x,z,grade+1)-grade};
 });expect(report.before).toBeLessThan(-3);expect(Math.abs(report.after-report.before)).toBeLessThan(.01);expect(report.edits).toBeLessThan(20000);expect(Math.abs(report.reset)).toBeLessThan(.25);
});
test('a live maximum-size roll keeps carving along the whole travelled path',async({page})=>{
 await boot(page);await page.evaluate(()=>{setFatness(400);teleportJimothy(-2,-40);faceJimothy(0);__game.military.update=()=>{};});await adv(page,.2);await page.keyboard.down('c');await adv(page,2);await page.keyboard.up('c');
 const out=await page.evaluate(()=>({z:__game.jimothy.position.z,cuts:[-30,-10,10,30].map(z=>__game.groundChannels.field.sample(-2,z))}));console.log(JSON.stringify(out));expect(out.z).toBeGreaterThan(60);for(const d of out.cuts)expect(d).toBeLessThan(-3);
});
