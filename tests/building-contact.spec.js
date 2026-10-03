import {test,expect} from '@playwright/test';
import {boot,adv} from './helpers.mjs';

test('walking into a low house wall cannot step onto its roof',async({page})=>{
 await boot(page,{withRig:true});
 const start=await page.evaluate(async()=>{
  const g=__game,{buildingsIntersecting}=await import('/src/level/Layout.js'),{interiorPoint}=await import('/src/level/InteriorLayout.js');
  const b=buildingsIntersecting(-120,-120,120,120).filter(b=>b.type==='craftsman'&&b.vh<17).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0],plan=g.interiors.plan(b);
  const at=interiorPoint(b,6,1,plan.d/2);teleportJimothy(at.x,at.z);advanceTime(6);dropJimothy(at.x,at.z,at.y+g.jimothy.radius);faceJimothy(-Math.PI/2-(b.front||0)*Math.PI/2);g.jimothy.postUpdate(0);
  return {floor:at.y,b};
 });
 let maxFeet=start.floor;await page.keyboard.down('w');
 for(let n=0;n<30;n++){await adv(page,.1);maxFeet=Math.max(maxFeet,await page.evaluate(()=>__game.jimothy.position.y));}
 await page.keyboard.up('w');
 expect(maxFeet-start.floor).toBeLessThan(.5);
});

test('an upward launch hits a ceiling without changing storeys',async({page})=>{
 await boot(page);
 const result=await page.evaluate(async()=>{
  const g=__game,j=g.jimothy,{VOXEL}=await import('/src/core/Constants.js'),s=VOXEL.SIZE;
  teleportJimothy(0,10);const floor=g.voxels.groundHeightAt(0,10,g.voxels.terrainHeightAt(0,10)+1),ceiling=Math.ceil((floor+2.2)/s)*s;
  for(let x=-8;x<=8;x++)for(let z=Math.floor(10/s)-8;z<=Math.floor(10/s)+8;z++)g.voxels.set(x,Math.round(ceiling/s),z,6);
  dropJimothy(0,10,floor+j.radius);j.postUpdate(0);j.vy=10;j.grounded=false;
  let top=-Infinity;for(let n=0;n<45;n++){advanceTime(1/60);top=Math.max(top,j.body.position.y+j.radius);}
  return{ceiling,top,feet:j.position.y,floor};
 });
 expect(result.top).toBeLessThanOrEqual(result.ceiling+.03);
 expect(Math.abs(result.feet-result.floor)).toBeLessThan(.1);
});

test('a thin partition overlap recovers locally instead of selecting the roof',async({page})=>{
 await boot(page);
 const result=await page.evaluate(async()=>{
  const g=__game,j=g.jimothy,{buildingsIntersecting}=await import('/src/level/Layout.js'),{interiorPoint}=await import('/src/level/InteriorLayout.js');
  const b=buildingsIntersecting(-120,-120,120,120).find(b=>b.type==='apartment'),plan=g.interiors.plan(b),wall=plan.walls.find(w=>w.axis==='x');
  const at=interiorPoint(b,wall.at+.5,1,wall.from+1.5);teleportJimothy(at.x,at.z);advanceTime(6);dropJimothy(at.x,at.z,at.y+j.radius);j.postUpdate(0);
  return {rise:j.position.y-at.y,loaded:g.voxels.isLoadedAtWorld(at.x,at.z),blocked:g.voxels.solidAtWorld(j.body.position.x,j.body.position.y,j.body.position.z)};
 });
 expect(result.loaded).toBe(true);expect(Math.abs(result.rise)).toBeLessThan(.5);expect(result.blocked).toBe(false);
});

test('outdoor ledges remain climbable with clear space overhead',async({page})=>{
 await boot(page);const floor=await page.evaluate(async()=>{
  const g=__game,{VOXEL}=await import('/src/core/Constants.js'),s=VOXEL.SIZE;
  teleportJimothy(0,10);advanceTime(1);const base=Math.ceil((g.voxels.terrainHeightAt(0,10)+1)/s);
  for(let x=-8;x<=8;x++)for(let z=40;z<=72;z++)for(let y=base-1;y<base+22;y++)g.voxels.setEdit(x,y,z,y<base+(z>=55?4:0)?6:0);
  dropJimothy(0,10,base*s+g.jimothy.radius);g.jimothy.postUpdate(0);faceJimothy(0);return base*s;
 });
 await page.keyboard.down('w');await adv(page,.75);await page.keyboard.up('w');
 const j=await page.evaluate(()=>({feet:__game.jimothy.position.y,z:__game.jimothy.position.z}));
 expect(j.z).toBeGreaterThan(12.5);expect(j.feet-floor).toBeCloseTo(.88,1);
});
