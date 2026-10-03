import {test,expect} from '@playwright/test';
import * as THREE from 'three';
import {VoxelWorld} from '../src/level/VoxelWorld.js';
import {GLAZING,VOXEL} from '../src/core/Constants.js';
import {boot,adv,state} from './helpers.mjs';

test('a tiny strike clears the connected pane across a chunk seam but preserves its frame',()=>{
  const world=new VoxelWorld(new THREE.Scene()),edge=VOXEL.CHUNK_XZ-1;
  world.generator=(w)=>{
    for(let x=edge-2;x<=edge+2;x++)for(let y=10;y<=13;y++)w.set(x,y,0,GLAZING.MATERIAL_ID);
    for(let y=10;y<=13;y++){w.set(edge+3,y,0,1);w.set(edge+4,y,0,GLAZING.MATERIAL_ID);}
  };
  world.ensureColumn(0,0);world.ensureColumn(1,0);
  const s=VOXEL.SIZE,removed=world.damageSphere((edge+.5)*s,11.5*s,.5*s,.02);
  expect(removed).toHaveLength(20);
  expect(world.get(edge+3,11,0)).toBe(1);
  expect(world.get(edge+4,11,0)).toBe(GLAZING.MATERIAL_ID);
  world.unloadColumn(0,0);world.unloadColumn(1,0);
  world.ensureColumn(0,0);world.ensureColumn(1,0);
  expect(world.get(edge,11,0)).toBe(0);
  expect(world.get(edge+2,13,0)).toBe(0);
  world.clear();
});

test('car panes break independently, persist through streaming, and reset intact',async({page})=>{
  await boot(page);
  const result=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const g=window.__game,p=g.streetLife.items.find(p=>p.kind==='car'&&!p.driving);
    const panes=p.mesh.children.filter(m=>m.material?.transmission>0);
    const target=panes[0],v=new THREE.Vector3();target.geometry.computeBoundingBox();
    target.geometry.boundingBox.getCenter(v);target.localToWorld(v);
    const intact=panes.length;g.blastAt(v,.04/g.blastRadius(0),{fatShare:0,digsTerrain:false});
    const remaining=p.mesh.children.filter(m=>m.material?.transmission>0).length;
    window.__glassCar={id:p.id,x:p.mesh.position.x,z:p.mesh.position.z,intact};
    return {intact,remaining,body:g.streetLife.items.includes(p),fragments:g.streetLife.items.filter(q=>q.fragment).length};
  });
  expect(result.intact).toBeGreaterThan(2);
  expect(result.remaining).toBe(result.intact-1);expect(result.body).toBe(true);expect(result.fragments).toBe(0);
  expect((await state(page)).glass.shards).toBeGreaterThan(0);
  await page.evaluate(()=>window.teleportJimothy(450,-150));await adv(page,.1);
  await page.evaluate(()=>window.teleportJimothy(window.__glassCar.x,window.__glassCar.z));await adv(page,.1);
  expect(await page.evaluate(()=>window.__game.streetLife.items.find(p=>p.id===window.__glassCar.id).mesh.children.filter(m=>m.material?.transmission>0).length)).toBe(result.remaining);
  await page.evaluate(()=>window.restartGame());await adv(page,.1);
  expect(await page.evaluate(()=>window.__game.streetLife.items.find(p=>p.id===window.__glassCar.id).mesh.children.filter(m=>m.material?.transmission>0).length)).toBe(result.intact);
  expect((await state(page)).glass.shards).toBe(0);
});

test('a lean hit shatters car glazing while a heavy hit breaks the body',async({page})=>{
  await boot(page);
  const result=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const g=window.__game,p=g.streetLife.items.find(p=>p.kind==='car'&&!p.driving);
    const pane=p.mesh.children.find(m=>m.material?.transmission>0),point=new THREE.Vector3();
    pane.geometry.computeBoundingBox();pane.geometry.boundingBox.getCenter(point);pane.localToWorld(point);
    g.blastAt(point,1,{fatShare:0,digsTerrain:false});
    const lean={body:g.streetLife.items.includes(p),shards:g.glassShards.items.length};
    g.blastAt(p.mesh.position,2/g.blastRadius(0),{fatShare:0,digsTerrain:false});
    return {lean,heavy:!g.streetLife.items.includes(p)};
  });
  expect(result.lean.body).toBe(true);expect(result.lean.shards).toBeGreaterThan(0);expect(result.heavy).toBe(true);
});

test('glass shards are physical, bounded, collectable and removed on expiry or restart',async({page})=>{
  await boot(page,{withRig:true});
  const result=await page.evaluate(async()=>{
    const {eventBus,Events}=await import('/src/core/EventBus.js');
    const {GLASS_SHARDS:C}=await import('/src/core/Constants.js');
    const g=window.__game,p=g.streetLife.items.find(p=>p.kind==='car'&&!p.driving),origin=p.mesh.position.clone();
    g.blastAt(origin,2/g.blastRadius(0),{fatShare:0,digsTerrain:false});
    const shards=g.glassShards?.items||[],physical=shards.length>0&&shards.every(s=>g.physics.props.has(s.id));
    const noGlassChunks=g.streetLife.items.filter(p=>p.fragment).every(p=>p.mesh.children.every(m=>!m.material?.transmission));
    if(!C)return {physical,noGlassChunks,count:0};
    window.advanceTime(3);
    // M52 allows shards to stack on wreckage. Bare terrain is no longer the only support;
    // require a nearby physical surface or an actual contact, as well as low fall speed.
    const carSettled=shards.every(s=>{
      const b=g.physics.props.get(s.id).body,p=s.mesh.position;
      const floor=g.voxels.physicalGroundHeightAt(p.x,p.z,p.y+.5,0);
      const contact=g.physics.world.contacts.some(c=>c.enabled&&(c.bi===b||c.bj===b));
      return Math.abs(b.velocity.y)<1&&(p.y<floor+.5||contact);
    });
    const points=[{x:60,y:g.voxels.terrainHeightAt(60,10)+2,z:10}];
    for(let i=0;i<C.MAX*2;i++)eventBus.emit(Events.GLASS_SHATTER,{points,origin:points[0]});
    window.advanceTime(3);
    const settled=g.glassShards.items.every(s=>s.mesh.position.y>=g.voxels.terrainHeightAt(s.mesh.position.x,s.mesh.position.z)-.22);
    const falling=g.glassShards.items.every(s=>Math.abs(g.physics.props.get(s.id).body.velocity.y)<1);
    const unsettled=g.glassShards.items.filter(s=>Math.abs(g.physics.props.get(s.id).body.velocity.y)>=1).map(s=>({id:s.id,y:s.mesh.position.y,ground:g.voxels.terrainHeightAt(s.mesh.position.x,s.mesh.position.z),velocity:g.physics.props.get(s.id).body.velocity.toArray()}));
    const thin=g.glassShards.items.every(s=>s.half[2]<s.half[0]/4);
    window.setFatness(90);window.teleportJimothy(60,10);g.jimothy.postUpdate(0);
    g.jimothy.move={kind:'roll',elapsed:0};g.collector.update(0);
    const attached=g.glassShards.items.some(s=>s.attached&&!g.physics.props.get(s.id).active);
    g.jimothy.move=null;g.collector.update(0);
    const released=g.glassShards.items.every(s=>!s.attached&&g.physics.props.get(s.id).active);
    const count=g.glassShards.items.length;window.advanceTime(C.LIFETIME+1);
    const expired=g.glassShards.items.length===0;
    eventBus.emit(Events.GLASS_SHATTER,{points,origin:points[0]});window.restartGame();
    return {physical,noGlassChunks,carSettled,settled,falling,unsettled,thin,attached,released,count,cap:C.MAX,expired,
      clean:g.glassShards.items.length===0&&![...g.physics.props.keys(),...g.collector.entities.keys()].some(id=>id.startsWith('glass-'))};
  });
  expect(result,JSON.stringify(result.unsettled)).toMatchObject({physical:true,noGlassChunks:true,carSettled:true,settled:true,falling:true,thin:true,attached:true,released:true,expired:true,clean:true});
  expect(result.count).toBeGreaterThan(0);expect(result.count).toBeLessThanOrEqual(result.cap);
});
