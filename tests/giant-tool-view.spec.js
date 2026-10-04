import {test,expect} from '@playwright/test';
import {boot,adv} from './helpers.mjs';

test('a giant camera reveals the actual nozzle path through the original skin',async({page})=>{
 await boot(page,{withRig:true});await page.waitForFunction(()=>__game.tools.ready);
 const rows=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),g=__game,j=g.jimothy,rows=[];
  for(const hz of [30,60,120]){
   restartGame();teleportJimothy(0,-16);advanceTime(.2);setFatness(250);g.tools.equip(g.tools.pickups.find(p=>p.type==='power-washer'));g.input.codes.add('KeyV');
   for(let i=0;i<hz*2;i++)g.update(1/hz);
   g.scene.updateMatrixWorld(true);const skin=j.rig.skinned;skin.skeleton.update();skin.computeBoundingSphere();skin.computeBoundingBox();
   const outlet=g.tools.muzzle(),probe=outlet.clone().addScaledVector(g.tools.direction(),3),delta=probe.clone().sub(g.camera.position),length=delta.length(),ray=new T.Raycaster(g.camera.position,delta.normalize(),0,length);
   const contacts=ray.intersectObject(skin,false),screen=probe.clone().project(g.camera);
   rows.push({hz,occluded:contacts.length>0,screen:screen.toArray(),radius:j.radius,distance:g.cameraSystem.distance,eye:g.camera.position.toArray(),outlet:outlet.toArray(),opacity:j.materials[0].opacity,depthWrite:j.materials[0].depthWrite,transparent:j.materials[0].transparent,flow:g.tools.snapshot().flow.visible});
  }return rows;
 });console.log('GIANT_TOOL_VIEW',JSON.stringify(rows));for(const row of rows){expect(row.flow).toBe(true);expect(Math.abs(row.screen[0])).toBeLessThan(1);expect(Math.abs(row.screen[1])).toBeLessThan(1);if(row.occluded){expect(row.opacity).toBeLessThanOrEqual(.35);expect(row.depthWrite).toBe(false);}}
});

test('the original skin returns opaque on release, drop and restart',async({page})=>{
 await boot(page,{withRig:true});await page.waitForFunction(()=>__game.tools.ready);const r=await page.evaluate(()=>{
  const g=__game,j=g.jimothy;teleportJimothy(0,-16);advanceTime(.2);setFatness(250);g.tools.equip(g.tools.pickups.find(p=>p.type==='power-washer'));g.input.codes.add('KeyV');advanceTime(2);
  const near=j.materials.map(m=>({opacity:m.opacity,depthWrite:m.depthWrite}));g.input.codes.delete('KeyV');advanceTime(.7);const idle=j.materials.map(m=>({opacity:m.opacity,depthWrite:m.depthWrite}));g.tools.drop();advanceTime(.1);const far=j.materials.map(m=>({opacity:m.opacity,depthWrite:m.depthWrite}));restartGame();advanceTime(.2);return{near,idle,far,reset:j.materials.map(m=>({opacity:m.opacity,depthWrite:m.depthWrite}))};
 });for(const m of r.near){expect(m.opacity).toBeLessThanOrEqual(.35);expect(m.depthWrite).toBe(false);}for(const m of [...r.idle,...r.far,...r.reset]){expect(m.opacity).toBe(1);expect(m.depthWrite).toBe(true);}
});
