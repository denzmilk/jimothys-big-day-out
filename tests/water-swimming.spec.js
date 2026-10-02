import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

test('water disturbances spread and decay and the render field matches physics sampling',async({page})=>{
 await boot(page);expect((await state(page)).water).toBeDefined();
 const r=await page.evaluate(()=>{
  const w=window.__game.water;w.field.centerAt(-850,0);w.field.disturb(-850,0,.3);
  const initial=w.field.sample(-850,0);for(let i=0;i<30;i++)w.field.update(1/60);
  const spread=w.field.sample(-848,0),peak=w.field.energy();w.syncSurface();
  const x=-850.3,z=.2,cpu=w.heightAt(x,z),render=w.renderHeightAt(x,z),uploaded=w.rippleTexture.image.data!==w.field.current;
  for(let i=0;i<900;i++)w.field.update(1/60);const after=w.field.energy();
  return {initial,spread,peak,after,uploaded,error:Math.abs(cpu-render),finite:w.field.current.every(Number.isFinite)};
 });
 expect(Math.abs(r.initial)).toBeGreaterThan(.1);expect(Math.abs(r.spread)).toBeGreaterThan(.00001);
 expect(r.after).toBeLessThan(r.peak);expect(r.error).toBeLessThan(.002);expect(r.finite).toBe(true);expect(r.uploaded).toBe(true);
});

test('Jimothy swims on the wave surface with paddling and resets cleanly',async({page})=>{
 await boot(page,{withRig:true});expect((await state(page)).water).toBeDefined();
 const r=await page.evaluate(()=>{
  const g=window.__game;window.teleportJimothy(-850,0);window.advanceTime(2);
  const wet=JSON.parse(render_game_to_text()),before=g.jimothy.rig.bones.leg_FL.quaternion.clone();window.advanceTime(.2);
  const paddle=before.angleTo(g.jimothy.rig.bones.leg_FL.quaternion);
  const error=Math.abs(g.jimothy.rig.bellyBox().getCenter(g.jimothy.group.position.clone()).y-g.water.heightAt(g.jimothy.body.position.x,g.jimothy.body.position.z)-g.jimothy.radius*.1);
  window.teleportJimothy(70,-698);window.advanceTime(2);const shallowGrounded=g.jimothy.grounded,shallowError=Math.abs(g.jimothy.rig.bellyBox().getCenter(g.jimothy.group.position.clone()).y-g.water.heightAt(70,-698)-g.jimothy.radius*.1);
  window.teleportJimothy(4,25);window.advanceTime(.2);const dry=JSON.parse(render_game_to_text());window.restartGame();return {wet,dry,paddle,error,shallowGrounded,shallowError,reset:JSON.parse(render_game_to_text()).water};
 });
 expect(r.wet.water.swimming).toBe(true);expect(r.wet.game.isPlaying).toBe(true);expect(r.paddle).toBeGreaterThan(.05);expect(r.error).toBeLessThan(.3);
 expect(r.shallowGrounded).toBe(false);expect(r.shallowError).toBeLessThan(.2);expect(r.dry.water.swimming).toBe(false);expect(r.dry.jimothy.grounded).toBe(true);expect(r.reset.swimming).toBe(false);
});

test('dynamic objects float and drag damps movement, impacts make splashes and restart clears water',async({page})=>{
 await boot(page);expect((await state(page)).water).toBeDefined();
 const r=await page.evaluate(async()=>{
  const g=window.__game,{eventBus,Events}=await import('/src/core/EventBus.js');window.teleportJimothy(-850,0);
  const mesh=new g.jimothy.group.constructor();mesh.position.set(-846,1,0);g.scene.add(mesh);
  eventBus.emit(Events.PROP_CREATE,{id:'float-test',mesh,mass:5,half:[.3,.3,.3],loose:true});
  eventBus.emit(Events.PROP_IMPULSE,{id:'float-test',velocity:[3,0,0],spin:0});window.advanceTime(1);const bodyId=g.physics.props.get('float-test').body.id,wake=g.water.bodyWakes.has(bodyId);window.advanceTime(4);
  const body=g.physics.props.get('float-test').body,depth=g.water.heightAt(body.position.x,body.position.z)-body.position.y,speed=body.velocity.length();
  g.blastAt({x:-850,y:0,z:0},2,{fatShare:0,digsTerrain:false});window.advanceTime(.1);const splashes=g.water.snapshot().splashes;
  eventBus.emit(Events.PROP_REMOVE,{id:'float-test'});mesh.removeFromParent();window.restartGame();return {depth,speed,wake,splashes,reset:g.water.snapshot()};
 });
 expect(r.wake).toBe(true);expect(Math.abs(r.depth)).toBeLessThan(.7);expect(r.speed).toBeLessThan(3);expect(r.splashes).toBeGreaterThan(0);expect(r.reset.splashes).toBe(0);
});

test('walking crosses the beach into swimming and back onto dry ground',async({page})=>{
 await boot(page,{withRig:true});
 const shore={x:70,z:-700,ux:1/3,uz:-Math.sqrt(8/9)};
 await page.evaluate(p=>{window.teleportJimothy(p.x+p.ux*15,p.z+p.uz*15);window.faceJimothy(Math.atan2(-p.ux,-p.uz));},shore);
 await adv(page,.3);expect((await state(page)).water?.swimming).toBe(false);
 await page.keyboard.down('w');await adv(page,5);await page.keyboard.up('w');
 expect((await state(page)).water.swimming).toBe(true);
 await page.evaluate(p=>window.faceJimothy(Math.atan2(p.ux,p.uz)),shore);
 await page.keyboard.down('w');await adv(page,7);await page.keyboard.up('w');await adv(page,.3);
 const s=await state(page);expect(s.water.swimming).toBe(false);expect(s.jimothy.grounded).toBe(true);expect(s.game.isPlaying).toBe(true);
});
