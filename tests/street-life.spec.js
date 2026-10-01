import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

test('streets contain parked cars, road-following traffic and breakable furniture',async({page})=>{
  await boot(page);
  await page.waitForFunction(()=>window.__game.streetLife.ready);
  const a=(await state(page)).streetLife;
  expect(a.models).toBe(6);
  expect(a.traffic).toBeGreaterThan(3);
  expect(a.items.filter(p=>p.driving&&Math.hypot(p.x,p.z)<45).length).toBeGreaterThanOrEqual(3);
  expect(a.parked).toBeGreaterThan(3);
  for(const kind of ['lamp','hydrant','bench','tree'])expect(a.items.some(p=>p.kind===kind)).toBe(true);
  await adv(page,4);
  const b=(await state(page)).streetLife;
  expect((await state(page)).heat.points).toBe(0);
  expect(b.items.filter(p=>p.driving&&a.items.some(o=>o.id===p.id&&Math.hypot(o.x-p.x,o.z-p.z)>3)).length).toBeGreaterThan(2);
  expect(await page.evaluate(()=>window.__game.streetLife.items.filter(p=>p.driving&&!window.__game.streetLife.roadClear(p.mesh.position.x,p.mesh.position.z)).length)).toBe(0);
  await page.evaluate(()=>window.teleportJimothy(420,-140));await adv(page,.2);
  expect((await state(page)).streetLife.traffic).toBeGreaterThan(3);
});

test('a blast breaks street furniture into physical pieces that land',async({page})=>{
  await boot(page);
  await page.waitForFunction(()=>window.__game.streetLife.ready);
  const before=await page.evaluate(()=>{const g=window.__game,p=g.streetLife.items.find(p=>p.kind==='lamp');g.blastAt(p.mesh.position,.8,{fatShare:0,digsTerrain:false});return p.id;});
  await adv(page,3);
  const s=(await state(page)).streetLife;
  expect(s.items.some(p=>p.id===before)).toBe(false);
  expect(s.fragments).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__game.streetLife.items.filter(p=>p.fragment).every(p=>p.mesh.position.y>window.__game.voxels.terrainHeightAt(p.mesh.position.x,p.mesh.position.z)-.5))).toBe(true);
});

test('large rolling collects people and props, releases survivors, and resets cleanly',async({page})=>{
  await boot(page,{withRig:true});
  await page.waitForFunction(()=>window.__game.pedestrians.ready&&window.__game.jimothy.rig?.loaded);
  const result=await page.evaluate(async()=>{
    const g=window.__game;
    const p=g.pedestrians.people[0],prop=g.streetLife.items.find(p=>p.kind==='hydrant');
    window.teleportJimothy(p.x,p.z);g.collector.update(0);
    const lean=g.collector.attached.length;
    window.setFatness(90);window.teleportJimothy(60,10);g.jimothy.postUpdate(0);
    p.x=61;p.z=10;p.y=g.voxels.terrainHeightAt(p.x,p.z);p.mesh.position.set(p.x,p.y,p.z);
    prop.mesh.position.copy(p.mesh.position);prop.mesh.position.x+=1;
    g.jimothy.move={kind:'roll',elapsed:0};g.collector.update(0);
    const ids=g.collector.attached.map(e=>e.id),count=ids.length;
    g.jimothy.group.rotation.x+=1;g.jimothy.group.updateMatrixWorld(true);
    const parent=p.mesh.parent===g.jimothy.group;
    g.jimothy.move=null;g.collector.update(0);
    return {lean,count,person:ids.includes(p.id),prop:ids.includes(prop.id),parent,released:!p.attached&&p.mesh.parent===g.scene};
  });
  expect(result.lean).toBe(0);expect(result.count).toBeGreaterThan(1);
  expect(result).toMatchObject({person:true,prop:true,parent:true,released:true});
  await page.evaluate(()=>window.restartGame());await adv(page,.1);
  const a=await page.evaluate(()=>({b:window.__game.physics.world.bodies.length,e:window.__game.collector.entities.size}));
  for(let i=0;i<3;i++){await page.evaluate(()=>window.restartGame());await adv(page,.1);}
  expect(await page.evaluate(()=>({b:window.__game.physics.world.bodies.length,e:window.__game.collector.entities.size}))).toEqual(a);
  expect((await state(page)).collection.count).toBe(0);
});

test('holding roll carries food and animal control, then releases them alive',async({page})=>{
 await boot(page,{withRig:true});await page.waitForFunction(()=>window.__game.pedestrians.ready&&window.__game.jimothy.rig.loaded);
 await page.evaluate(()=>{
  const g=window.__game;window.setFatness(90);window.teleportJimothy(60,10);window.faceJimothy(0);
  const j=g.jimothy.body.position,can=g.trashCans.cans[0];can.body.position.set(j.x+1,g.voxels.terrainHeightAt(j.x+1,j.z)+1,j.z);can.mesh.position.copy(can.body.position);g.physics.resetSweep(can.body);g.trashCans.spillFrom(can);
  window.spawnPursuerAt('animal-control',j.x+2,j.z);
 });
 await page.keyboard.down('c');await adv(page,.2);
 const carried=await state(page);
 expect(carried.collection.items.some(p=>p.kind==='food')).toBe(true);
 expect(carried.pursuers.some(p=>p.type==='animal-control'&&p.attached)).toBe(true);
 expect(carried.game.netted).toBe(false);
 await page.keyboard.up('c');await adv(page,1.2);
 const released=await state(page);
 expect(released.collection.count).toBe(0);
 expect(released.snacks.length).toBeGreaterThan(0);
 expect(released.pursuers.some(p=>p.type==='animal-control'&&!p.attached)).toBe(true);
});
