import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

test('headbutts give civilians and pursuers jointed knockdowns, then recovery and clean restart',async({page})=>{
  await boot(page);
  const ids=await page.evaluate(()=>{
    const g=window.__game,p=g.pedestrians.people[0];
    window.teleportJimothy(p.x-8,p.z);
    const id=window.spawnPursuerAt('paparazzo',p.x+1,p.z);
    const ac=window.spawnPursuerAt('animal-control',p.x-1,p.z);
    g.blastAt({x:p.x,y:p.y+1,z:p.z},2,{fatShare:0,digsTerrain:false});
    return [p.id,`pursuer-${id}`,`pursuer-${ac}`];
  });
  await adv(page,.25);
  let s=await state(page);
  expect(s.ragdolls?.items.map(p=>p.id)).toEqual(expect.arrayContaining(ids));
  expect(s.ragdolls.bodies).toBeGreaterThanOrEqual(30);
  expect(s.ragdolls.constraints).toBeGreaterThanOrEqual(27);
  expect(s.ragdolls.items.every(p=>p.speed>0)).toBe(true);
  await page.evaluate(()=>window.teleportJimothy(0,0));
  await adv(page,12);
  s=await state(page);expect(s.ragdolls.count).toBe(0);
  expect(s.people.items.some(p=>p.id===ids[0]&&!p.ragdoll)).toBe(true);
  await page.evaluate(()=>window.restartGame());
  s=await state(page);expect(s.ragdolls.bodies).toBe(0);expect(s.ragdolls.constraints).toBe(0);
});

test('net swing is telegraphed, escapable and slower to capture a larger Jimothy',async({page})=>{
  await boot(page);
  const setup=async fat=>page.evaluate(f=>{
    window.restartGame();window.setFatness(f);const g=window.__game,j=g.jimothy.group.position;
    window.spawnPursuerAt('animal-control',j.x,j.z+1);
  },fat);
  await setup(0);await adv(page,.3);
  let s=await state(page);expect(s.game.netted).toBe(false);expect(s.capture?.progress).toBe(0);
  expect(s.pursuers.find(p=>p.type==='animal-control').netPhase).toBe('windup');
  await adv(page,1.2);s=await state(page);const lean=s.capture.progress;
  expect(lean).toBeGreaterThan(0);expect(lean).toBeLessThan(1);
  await expect(page.locator('#capture-meter')).toBeVisible();
  await page.evaluate(()=>{const j=window.__game.jimothy.group.position;window.teleportJimothy(j.x+15,j.z);});
  await adv(page,1);expect((await state(page)).capture.progress).toBeLessThan(lean);
  await setup(90);await adv(page,1.5);s=await state(page);
  expect(s.capture.progress).toBeGreaterThan(0);expect(s.capture.progress).toBeLessThan(lean);
  await page.evaluate(()=>{const g=window.__game,p=g.pursuers.animalControl.group.position;g.blastAt({x:p.x,y:p.y+1,z:p.z},2,{fatShare:0,digsTerrain:false});});
  await adv(page,.2);s=await state(page);expect(s.capture.holding).toBe(false);expect(s.game.netted).toBe(false);
  await setup(0);await adv(page,4);expect((await state(page)).game.netted).toBe(true);
});

test('rolling knocks people down and ragdoll capacity remains bounded through collection and restart',async({page})=>{
  await boot(page);
  await page.evaluate(()=>{const g=window.__game,p=g.pedestrians.people[0];window.teleportJimothy(p.x,p.z-1);window.faceJimothy(0);});
  await page.keyboard.down('c');await adv(page,.3);await page.keyboard.up('c');
  expect((await state(page)).ragdolls?.count).toBeGreaterThan(0);
  const result=await page.evaluate(()=>{
    const g=window.__game;
    for(const p of g.pedestrians.people)g.blastAt({x:p.x,y:p.y+1,z:p.z},1,{fatShare:0,digsTerrain:false});
    return g.ragdolls.snapshot();
  });
  expect(result.count).toBeLessThanOrEqual(6);
  const held=await page.evaluate(async()=>{
    const g=window.__game,id=g.ragdolls.snapshot().items[0].id,e=g.collector.entities.get(id);
    const {eventBus,Events}=await import('/src/core/EventBus.js');
    eventBus.emit(Events.ENTITY_ATTACH,{id});g.jimothy.group.attach(e.mesh);
    const removed=!g.physics.ragdolls.has(id)&&!g.ragdolls.active.has(id);
    g.scene.attach(e.mesh);const position=g.jimothy.group.position.clone();position.x+=3;
    const ground=g.voxels.terrainHeightAt(position.x,position.z);
    eventBus.emit(Events.ENTITY_RELEASE,{id,position,ground});
    window.advanceTime(.1);return {removed,attached:g.ragdolls.people.get(id).attached};
  });
  expect(held).toEqual({removed:true,attached:false});
  await page.evaluate(()=>window.restartGame());
  expect((await state(page)).ragdolls.count).toBe(0);
  expect(await page.evaluate(()=>({bodies:window.__game.physics.ragdolls.size,constraints:window.__game.physics.world.constraints.length}))).toEqual({bodies:0,constraints:0});
});
