import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('breakaway pieces preserve every imported opaque triangle across all six cars',async({page})=>{
  await boot(page);
  const models=await page.evaluate(()=>{
    const s=window.__game.streetLife,triangles=m=>(m.geometry.index?.count||m.geometry.attributes.position.count)/3;
    return s.vehicles.map((_,seed)=>{
      const intact=s.template('car',seed),parts=s.carParts(seed);
      return {before:intact.children.filter(m=>m.userData.glassPane===undefined).reduce((n,m)=>n+triangles(m),0),after:parts.reduce((n,m)=>n+triangles(m),0),
        roles:[...new Set(parts.map(p=>p.userData.part))],wheels:parts.filter(p=>p.userData.part==='wheel').length};
    });
  });
  expect(models).toHaveLength(6);
  for(const model of models){
    expect(model.after).toBe(model.before);expect(model.wheels).toBeGreaterThanOrEqual(4);
    for(const role of ['roof','left-panel','right-panel','chassis'])expect(model.roles).toContain(role);
  }
});

test('only a powerful hit explodes a car and throws separate body panels and wheels',async({page})=>{
  await boot(page);
  const result=await page.evaluate(()=>{
    const g=window.__game,car=()=>g.streetLife.items.find(p=>p.kind==='car'&&!p.driving&&!p.fragment);
    const weak=car(),weakId=weak.id;g.blastAt(weak.mesh.position,.1,{fatShare:0,digsTerrain:false});
    const leanIntact=g.streetLife.items.some(p=>p.id===weakId),quiet=(JSON.parse(render_game_to_text()).explosions?.total||0)===0;
    window.setFatness(60);const target=car(),id=target.id,origin=target.mesh.position.clone();
    g.blastAt(origin,1,{digsTerrain:false});
    const first=JSON.parse(render_game_to_text()),parts=g.streetLife.items.filter(p=>p.fragment&&p.sourceId===id);
    const before=parts.map(p=>({id:p.id,position:p.mesh.position.clone()}));
    g.blastAt(origin,1,{digsTerrain:false});window.advanceTime(.25);
    const moved=parts.filter(p=>before.find(q=>q.id===p.id).position.distanceTo(p.mesh.position)>.2).length;
    return {leanIntact,quiet,destroyed:!g.streetLife.items.some(p=>p.id===id),explosions:first.explosions?.total||0,
      repeated:JSON.parse(render_game_to_text()).explosions?.total||0,parts:parts.map(p=>p.part),moved,
      fire:first.explosions?.fire||0,smoke:first.explosions?.smoke||0,sparks:first.explosions?.sparks||0};
  });
  expect(result).toMatchObject({leanIntact:true,quiet:true,destroyed:true,explosions:1,repeated:1});
  expect(result.parts.filter(p=>p==='wheel').length).toBeGreaterThanOrEqual(4);
  for(const part of ['roof','left-panel','right-panel','chassis'])expect(result.parts).toContain(part);
  expect(result.parts.length).toBeGreaterThanOrEqual(9);expect(result.moved).toBeGreaterThan(5);
  for(const key of ['fire','smoke','sparks'])expect(result[key]).toBeGreaterThan(0);
});

test('wreckage lands, is collectable, stays destroyed after streaming, and resets cleanly',async({page})=>{
  await boot(page,{withRig:true});
  const result=await page.evaluate(()=>{
    const g=window.__game,p=g.streetLife.items.find(p=>p.kind==='car'&&!p.driving),id=p.id,x=p.mesh.position.x,z=p.mesh.position.z;
    window.setFatness(60);g.blastAt(p.mesh.position,1,{digsTerrain:false});window.advanceTime(4);
    const parts=g.streetLife.items.filter(q=>q.fragment&&q.sourceId===id);
    if(!parts.length)return {parts:0};
    const landed=parts.every(q=>q.mesh.position.y>=g.voxels.terrainHeightAt(q.mesh.position.x,q.mesh.position.z)-.22&&Math.abs(g.physics.props.get(q.id).body.velocity.y)<1);
    const piece=parts.find(q=>q.part==='wheel');
    window.setFatness(90);window.teleportJimothy(piece.mesh.position.x,piece.mesh.position.z);g.jimothy.postUpdate(0);
    g.jimothy.move={kind:'roll',elapsed:0};g.collector.update(0);
    const collected=parts.some(q=>q.attached);g.jimothy.move=null;g.collector.update(0);
    const released=parts.every(q=>!q.attached&&g.physics.props.get(q.id).active);
    window.teleportJimothy(450,-150);window.advanceTime(.1);window.teleportJimothy(x,z);window.advanceTime(.1);
    const persisted=!g.streetLife.items.some(q=>q.id===id);
    window.restartGame();window.advanceTime(.1);
    const baseline={b:g.physics.world.bodies.length,e:g.collector.entities.size};
    for(let i=0;i<3;i++){window.setFatness(60);const car=g.streetLife.items.find(q=>q.kind==='car'&&!q.driving);g.blastAt(car.mesh.position,1,{digsTerrain:false});window.restartGame();window.advanceTime(.1);}
    return {parts:parts.length,landed,collected,released,persisted,restored:g.streetLife.items.some(q=>q.id===id),
      clean:JSON.parse(render_game_to_text()).explosions?.active===0&&g.streetLife.items.every(q=>!q.fragment),
      stable:baseline.b===g.physics.world.bodies.length&&baseline.e===g.collector.entities.size};
  });
  expect(result.parts).toBeGreaterThan(8);
  expect(result).toMatchObject({landed:true,collected:true,released:true,persisted:true,restored:true,clean:true,stable:true});
});

test('many car explosions respect fragment and effect caps and effects expire',async({page})=>{
  await boot(page);
  const result=await page.evaluate(async()=>{
    const {STREET:C,CAR_EXPLOSION:E}=await import('/src/core/Constants.js');
    const {gameState}=await import('/src/core/GameState.js');
    const g=window.__game;window.setFatness(90);
    const cars=g.streetLife.items.filter(p=>p.kind==='car'&&!p.fragment);
    for(const car of cars)g.blastAt(car.mesh.position,1,{digsTerrain:false});
    const s=JSON.parse(render_game_to_text());
    if(!E)return {explosions:0};
    const allGone=cars.every(p=>!g.streetLife.items.includes(p));
    // This isolates elapsed cleanup time: the mass blast also destroys nearby
    // walls and summons a net, which correctly freezes every lifetime on loss.
    gameState.heat.points=0;gameState.heat.tier=0;g.pursuers.reset();
    window.advanceTime(E.SMOKE_LIFE+1);
    const ended=JSON.parse(render_game_to_text()).explosions;
    window.advanceTime(C.FRAGMENT_LIFE+1);
    return {explosions:s.explosions.total,allGone,fragments:s.streetLife.fragments,cap:C.FRAGMENT_LIMIT,
      effects:s.explosions.active,effectCap:E.MAX,ended:ended.active===0&&ended.fire===0&&ended.smoke===0&&ended.sparks===0,
      fragmentsExpired:g.streetLife.items.every(p=>!p.fragment),playing:gameState.game.isPlaying};
  });
  expect(result.explosions).toBeGreaterThan(5);expect(result.allGone).toBe(true);
  expect(result.fragments).toBeLessThanOrEqual(result.cap);expect(result.effects).toBeLessThanOrEqual(result.effectCap);
  expect(result.playing).toBe(true);expect(result.ended).toBe(true);expect(result.fragmentsExpired).toBe(true);
});

test('small attacks leave a car usable, medium attacks break it, and large attacks still explode it',async({page})=>{
 await boot(page);
 const rows=await page.evaluate(()=>{
  const g=__game,rows=[];
  for(const fatness of [5,25,60]){
   const p=g.streetLife.items.find(p=>p.kind==='car'&&!p.driving&&!p.fragment&&!p.loose);
   const before=JSON.parse(render_game_to_text()).explosions.total;setFatness(fatness);g.blastAt(p.mesh.position,1,{digsTerrain:false});
   rows.push({fatness,intact:g.streetLife.items.includes(p),explosions:JSON.parse(render_game_to_text()).explosions.total-before,parts:g.streetLife.items.filter(q=>q.sourceId===p.id).length});
  }return rows;
 });console.log('CAR_STRENGTH_TIERS',rows);expect(rows[0].intact).toBe(true);expect(rows[0].explosions).toBe(0);expect(rows[1].intact).toBe(false);expect(rows[1].explosions).toBe(0);expect(rows[2].intact).toBe(false);expect(rows[2].explosions).toBe(1);expect(rows[2].parts).toBeGreaterThan(8);
});
