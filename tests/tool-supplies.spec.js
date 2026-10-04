import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

async function setup(page){
 await boot(page);await page.waitForFunction(()=>__game.tools.ready);
 await page.evaluate(async()=>{
  window.G=__game;window.T=G.tools;window.S=(await import('/src/core/GameState.js')).gameState;
  window.C=(await import('/src/core/Constants.js')).TOOLS;
  const bus=await import('/src/core/EventBus.js');window.B=bus.eventBus;window.E=bus.Events;
  window.arm=id=>{T.equip(T.pickups.find(p=>p.type===id));S.tools.energy=100;T.cooldown=0;};
  T.aimOverride={x:0,y:1,z:0};G.military.update=()=>{};
 });
}

test('all 24 tools start with finite supplies, exposed in the equipped state and HUD',async({page})=>{
 await setup(page);const rows=await page.evaluate(()=>T.catalog.map(d=>{
  arm(d.id);T.update(0);return{id:d.id,definition:d.supply,remaining:T.equipped.remaining,state:S.tools.supply,hud:T.panel.textContent};
 }));expect(rows).toHaveLength(24);
 for(const r of rows){expect(r.definition,r.id).toBeTruthy();expect(r.definition.capacity).toBeGreaterThan(0);expect(Number.isFinite(r.definition.capacity)).toBe(true);expect(r.definition.cost).toBeGreaterThan(0);expect(r.definition.unit).toBeTruthy();expect(r.remaining).toBe(r.definition.capacity);expect(r.state.remaining).toBe(r.remaining);expect(r.hud).toContain(`${r.remaining}/${r.definition.capacity}`);expect(r.hud).toContain(r.definition.unit.toUpperCase());}
});

test('an empty launcher is tossed once with its last rocket still live and cannot refill or equip',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  arm('firework-launcher');const p=T.equipped;p.remaining=1;const pos=p.mesh.position.clone();let releases=0;
  const off=B.on(E.PROP_RELEASE,e=>{if(e.id===p.id)releases++;});
  const used=T.use(.1),body=G.physics.props.get(p.id).body;
  const result={used,remaining:p.remaining,equipped:T.equipped?.type||null,held:p.held,loose:p.loose,active:G.physics.props.get(p.id).active,speed:body.velocity.length(),distance:p.mesh.position.distanceTo(pos),projectiles:T.projectiles.length,mesh:p.mesh.parent===G.scene};
  for(let i=0;i<20;i++){T.cooldown=0;T.use(.1);T.equip(p);}B.emit(E.PLAYER_PICKUP,{fat:10});
  B.emit(E.ENTITY_ATTACH,{id:p.id});const attached=!G.physics.props.get(p.id).active;
  B.emit(E.ENTITY_RELEASE,{id:p.id,position:p.mesh.position.clone(),ground:G.voxels.groundHeightAt(p.mesh.position.x,p.mesh.position.z,p.mesh.position.y+2)});
  const carriedSupply=p.remaining;T.equip(p);off();
  return{...result,releases,attached,carriedSupply,finalEquipment:T.equipped?.type||null,amount:p.remaining};
 });expect(r.used).toBe(true);expect(r.remaining).toBe(0);expect(r.equipped).toBe(null);expect(r.held).toBe(false);expect(r.loose&&r.active&&r.mesh).toBe(true);expect(r.speed).toBeGreaterThan(3);expect(r.distance).toBeLessThan(1);expect(r.projectiles).toBe(1);expect(r.releases).toBe(2);expect(r.attached).toBe(true);expect(r.carriedSupply).toBe(0);expect(r.finalEquipment).toBe(null);expect(r.amount).toBe(0);
 await adv(page,2);expect((await state(page)).tools.blasts).toBe(1);
});

test('invalid uses reserve neither supply nor energy; a valid miss spends both',async({page})=>{
 await setup(page);const rows=await page.evaluate(()=>{
  const rows=[];const check=(id,prepare=()=>{},restore=()=>{})=>{arm(id);prepare();const p=T.equipped,before=p.remaining,energy=S.tools.energy,shots=T.shots;const used=T.use(.1);rows.push({id,used,before,after:p.remaining,energy:S.tools.energy-energy,shots:T.shots-shots,reason:T.snapshot().notice});restore();};
  check('rocket-skates',()=>{setFatness(15000);if(G.jimothy.radius<=C.MOTION_RADIUS)throw Error('Fixture did not grow Jimothy');},()=>setFatness(0));
  check('umbrella-glider',()=>G.jimothy.grounded=true);
  check('pogo-stick',()=>G.jimothy.grounded=false,()=>G.jimothy.grounded=true);
  const startY=G.jimothy.body.position.y;const sky=()=>{G.jimothy.body.position.y=startY+1000;},back=()=>{G.jimothy.body.position.y=startY;};
  check('suction-grappler',sky,back);check('tow-reel',sky,back);
  check('power-washer',()=>S.tools.energy=0);check('power-washer',()=>T.cooldown=1);check('power-washer',()=>G.input.suppressed=true,()=>G.input.suppressed=false);
  arm('firework-launcher');for(let i=0;i<C.PROJECTILE_LIMIT;i++){S.tools.energy=100;T.cooldown=0;T.use(.1);}check('firework-launcher');
  arm('foam-cannon');T.aimOverride={x:0,y:-1,z:0};const j=G.jimothy.body.position,sz=.22;
  for(let x=-3;x<=3;x++)for(let y=-2;y<=10;y++)for(let z=-3;z<=3;z++)G.voxels.set(Math.floor(j.x/sz)+x,Math.floor(j.y/sz)+y,Math.floor(j.z/sz)+z,1);
  check('foam-cannon');T.aimOverride={x:0,y:1,z:0};arm('power-washer');const p=T.equipped,before=p.remaining,energy=S.tools.energy,used=T.use(.1);
  return{rows,miss:{used,spent:before-p.remaining,energy:energy-S.tools.energy,cost:T.catalog[0].supply?.cost}};
 });console.log('TOOL_VALIDATION',JSON.stringify(rows));for(const r of rows.rows){expect(r.used,JSON.stringify(r)).toBe(false);expect(r.after,r.id).toBe(r.before);expect(r.energy,r.id).toBe(0);expect(r.shots,r.id).toBe(0);}expect(rows.miss.used).toBe(true);expect(rows.miss.spent).toBe(rows.miss.cost);expect(rows.miss.energy).toBeGreaterThan(0);
});

test('partial supply survives swapping, physical drops, eating and clean restarts',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  arm('power-washer');const p=T.equipped,start=p.remaining;T.use(.12);const used=p.remaining;T.drop();arm('bubble-gun');T.drop();T.equip(p);B.emit(E.PLAYER_PICKUP,{fat:10});T.update(0);
  const retained={start,used,remaining:p.remaining,state:S.tools.supply?.remaining,energy:S.tools.energy};
  const counts=[];for(let i=0;i<3;i++){restartGame();counts.push({pickups:T.pickups.length,props:G.physics.props.size,full:T.pickups.every(p=>p.remaining===T.catalog.find(d=>d.id===p.type).supply?.capacity),equipped:S.tools.equipped,supply:S.tools.supply,notice:T.snapshot().notice});}
  return{retained,counts};
 });expect(r.retained.used).toBeLessThan(r.retained.start);expect(r.retained.remaining).toBe(r.retained.used);expect(r.retained.state).toBe(r.retained.used);expect(r.retained.energy).toBe(100);for(const c of r.counts){expect(c.pickups).toBe(24);expect(c.full).toBe(true);expect(c.equipped).toBe(null);expect(c.supply).toBe(null);expect(c.notice).toBe('');}expect(new Set(r.counts.map(c=>c.props)).size).toBe(1);
});

test('held continuous tools consume at the same rate at 30/60/120 Hz and stop during interruption',async({page})=>{
 await setup(page);const rows=await page.evaluate(()=>{
  const rows=[];for(const hz of [30,60,120]){T.reset();arm('power-washer');G.input.toolUse=true;const p=T.equipped,start=p.remaining;
   for(let i=0;i<hz*6;i++){S.tools.energy=100;T.update(1/hz);}
   const spent=start-p.remaining,shots=T.shots;S.game.paused=true;T.update(3);S.game.paused=false;G.input.suppressed=true;T.update(3);G.input.suppressed=false;G.input.toolUse=false;
   rows.push({hz,spent,shots,unchanged:start-p.remaining===spent});
  }return rows;
 });console.log('TOOL_SUPPLY_RATES',JSON.stringify(rows));for(const r of rows){expect(r.spent).toBeGreaterThanOrEqual(49);expect(r.spent).toBeLessThanOrEqual(51);expect(r.unchanged).toBe(true);}expect(Math.max(...rows.map(r=>r.spent))-Math.min(...rows.map(r=>r.spent))).toBeLessThanOrEqual(1);
});

test('the last movement charge has a finite effect even after the empty tool is thrown',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{arm('rocket-skates');T.aimOverride={x:0,y:0,z:1};T.equipped.remaining=1;T.use(.1);const held=T.equipped?.type||null;advanceTime(.1);const speed=G.jimothy.vel.length();advanceTime(.5);return{held,speed,motion:G.jimothy.toolMotion};});expect(r.held).toBe(null);expect(r.speed).toBeGreaterThan(8);expect(r.motion).toBe(null);
});

test('keyboard and gamepad exhaust the same item; focus loss and capture preserve unused supplies',async({page})=>{
 await setup(page);await page.evaluate(()=>{arm('bubble-gun');T.equipped.remaining=2;});
 await page.keyboard.down('v');await adv(page,.1);await page.keyboard.up('v');
 expect((await state(page)).tools.supply.remaining).toBe(1);await adv(page,.8);
 await page.evaluate(()=>{window.pad={connected:true,id:'supplies',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[pad];pad.buttons[5].pressed=true;});await adv(page,.1);
 expect((await state(page)).tools.equipped).toBe(null);const shots=(await state(page)).tools.shots;await adv(page,1);expect((await state(page)).tools.shots).toBe(shots);
 const r=await page.evaluate(()=>{pad.buttons[5].pressed=false;arm('power-washer');const p=T.equipped,before=p.remaining;window.dispatchEvent(new Event('blur'));T.update(1);const focus=p.remaining;B.emit(E.GAME_OVER,{});T.update(1);return{before,focus,remaining:p.remaining,held:p.held,equipped:T.equipped?.type||null};});expect(r.focus).toBe(r.before);expect(r.remaining).toBe(r.before);expect(r.held).toBe(false);expect(r.equipped).toBe(null);
});

test('supply cues produce audio and stay bounded on repeated use, blur, pause and reset',async({page})=>{
 await setup(page);await page.keyboard.press('Shift');
 const r=await page.evaluate(async()=>{
  const sound=T.sound;await sound.unlock();const rows=[];
  for(const kind of ['pickup','dry','empty']){sound.stop();sound.play(kind,G.jimothy.body.position);let rms=0;for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,10));rms=Math.max(rms,sound.snapshot().rms);}rows.push({kind,rms});}
  for(let i=0;i<50;i++)sound.play('empty',G.jimothy.body.position);const peak=sound.snapshot().voices;window.dispatchEvent(new Event('blur'));const blur=sound.snapshot().voices;
  sound.play('empty',G.jimothy.body.position);S.game.paused=true;T.update(.1);const pause=sound.snapshot().voices;S.game.paused=false;T.reset();return{rows,peak,blur,pause,reset:sound.snapshot().voices};
 });console.log('TOOL_SUPPLY_AUDIO',JSON.stringify(r));for(const row of r.rows)expect(row.rms,row.kind).toBeGreaterThan(.001);expect(r.peak).toBeLessThanOrEqual(8);expect(r.blur).toBe(0);expect(r.pause).toBe(0);expect(r.reset).toBe(0);
});
