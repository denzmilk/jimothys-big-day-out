import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

test('vegetation is populated on clear ground and reacts to Jimothy and impacts',async({page})=>{
 await boot(page);
 let s=await state(page);expect(s.environment?.plants).toBeGreaterThan(300);
 const r=await page.evaluate(async()=>{
  const g=window.__game,e=g.environmentLife,L=await import('/src/level/Layout.js');
  const invalid=e.plants.filter(p=>L.roadAtWorld(p.x,p.z)||L.isFootpathAtWorld(p.x,p.z)||L.Masterplan.buildingsIn(p.x,p.z,p.x,p.z).some(b=>p.x>=b.x&&p.x<=b.x+b.w&&p.z>=b.z&&p.z<=b.z+b.d));
  const p=e.plants[0];window.teleportJimothy(p.x,p.z);window.advanceTime(.2);
  const bent=e.snapshot().bent;g.blastAt({x:p.x,y:p.y,z:p.z},2,{fatShare:0,digsTerrain:false});window.advanceTime(.1);
  return {invalid:invalid.length,bent,flattened:e.snapshot().flattened};
 });
 expect(r.invalid).toBe(0);expect(r.bent).toBeGreaterThan(0);expect(r.flattened).toBeGreaterThan(0);
});

test('wind moves particles, wildlife flees, and streaming and restart are bounded',async({page})=>{
 await boot(page);expect((await state(page)).environment?.animals).toBeGreaterThan(0);
 const r=await page.evaluate(()=>{
  const g=window.__game,e=g.environmentLife,a=e.animals[0],before=a.mesh.position.clone();
  window.teleportJimothy(before.x,before.z);window.advanceTime(1);
  const fled=a.mesh.position.distanceTo(before),snapshot=e.snapshot();
  window.teleportJimothy(220,220);window.advanceTime(.2);const far=e.snapshot();
  window.restartGame();window.advanceTime(.1);const reset=e.snapshot();
  return {fled,snapshot,far,reset};
 });
 expect(r.fled).toBeGreaterThan(1);expect(r.snapshot.wind.length).toBe(2);expect(r.snapshot.particles).toBeGreaterThan(20);
 expect(r.far.plants).toBeLessThanOrEqual(2400);expect(r.far.animals).toBeLessThanOrEqual(10);expect(r.reset.flattened).toBe(0);
});

test('day night clock changes sun sky and light, advances continuously and resets',async({page})=>{
 await boot(page);expect((await state(page)).dayNight).toBeDefined();
 const r=await page.evaluate(()=>{
  const g=window.__game,read=()=>({lamps:g.streetLife.streetLights.map(l=>l.intensity),sun:g.sun.intensity,exposure:g.renderer.toneMappingExposure,sky:g.level.sky.material.uniforms.topColor.value.getHex(),state:JSON.parse(render_game_to_text()).dayNight});
  window.setTimeOfDay(12);window.advanceTime(.1);const day=read();
  window.setTimeOfDay(0);window.advanceTime(.1);const night=read();
  window.advanceTime(1);const later=read();window.restartGame();window.advanceTime(.1);return {day,night,later,reset:read()};
 });
 expect(r.day.sun).toBeGreaterThan(r.night.sun*5);expect(r.day.sky).not.toBe(r.night.sky);
 expect(r.night.state.moon).toBeGreaterThan(0);expect(Math.max(...r.night.lamps)).toBeGreaterThan(0);expect(Math.max(...r.day.lamps)).toBe(0);expect(r.later.state.hour).toBeGreaterThan(r.night.state.hour);
 expect(r.reset.state.hour).toBeGreaterThan(16);expect(r.reset.state.hour).toBeLessThan(19);
});
