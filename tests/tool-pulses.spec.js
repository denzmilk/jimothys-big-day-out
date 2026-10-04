import {test,expect} from '@playwright/test';
import {boot,adv} from './helpers.mjs';
async function setup(page){
 await boot(page);await page.waitForFunction(()=>__game.tools.ready);
 await page.evaluate(async()=>{
  window.G=__game;window.T=G.tools;window.S=(await import('/src/core/GameState.js')).gameState;window.TH=await import('/node_modules/three/build/three.module.js');
  const bus=await import('/src/core/EventBus.js');window.B=bus.eventBus;window.E=bus.Events;window.V=(await import('/src/core/Constants.js')).VOXEL;
  window.arm=id=>{T.equip(T.pickups.find(p=>p.type===id));S.tools.energy=100;T.cooldown=0;G.jimothy.launched=0;G.jimothy.body.position.y=200;T.aimOverride={x:0,y:0,z:1};T.pose();};
  window.placePerson=(index,point)=>{const p=G.pedestrians.people.filter(p=>!p.attached&&!p.ragdoll&&!p.vehicleSeat)[index];G.pedestrians.activities.stop(p,'fixture');p.x=point.x;p.y=point.y-.8;p.z=point.z;p.mesh.position.set(p.x,p.y,p.z);p.mesh.updateMatrixWorld(true);return p;};
  window.wall=(point,right=false)=>{for(let x=right?0:-16;x<=16;x++)for(let y=-16;y<=16;y++)G.voxels.set(Math.floor(point.x/V.SIZE)+x,Math.floor(point.y/V.SIZE)+y,Math.floor(point.z/V.SIZE),1);};
 });
}

test('sonic and status deliveries begin at measured outlets and visibly finish misses',async({page})=>{
 await setup(page);const rows=await page.evaluate(()=>{
  const outlets={'air-horn':[0,.53,.51],'disco-ray':[0,.32,.56],'sick-ray':[0,.32,.393]},rows=[];
  for(const fat of [0,90])for(const [id,outlet]of Object.entries(outlets)){
   setFatness(fat);arm(id);T.aimOverride={x:.2,y:.25,z:1};T.pose();const expected=T.equipped.mesh.children[0].localToWorld(new TH.Vector3(...outlet));T.use(.1);
   rows.push({id,fat,expected:expected.toArray(),pulse:T.snapshot().pulses?.items?.at(-1)});T.update(1);
  }return{rows,remaining:T.snapshot().pulses?.count};
 });for(const r of rows.rows){expect(r.pulse,r.id).toBeTruthy();expect(r.pulse.id).toBe(r.id);expect(Math.hypot(...r.pulse.origin.map((v,i)=>v-r.expected[i]))).toBeLessThan(.02);expect(r.pulse.paths.length).toBeGreaterThan(0);}expect(rows.remaining).toBe(0);
});

for(const id of ['disco-ray','sick-ray'])test(`${id} hits the person on its beam and respects physical and voxel cover`,async({page})=>{
 await setup(page);const r=await page.evaluate(id=>{
  arm(id);const origin=T.muzzle(),on=placePerson(0,origin.clone().add(new TH.Vector3(0,0,5))),off=placePerson(1,origin.clone().add(new TH.Vector3(2,0,4)));T.use(.1);
  const hit={on:on.attached,off:off.attached,kind:T.statuses.get(on.id)?.kind,pulse:T.snapshot().pulses?.items?.at(-1)};T.clearStatuses();placePerson(0,origin.clone().add(new TH.Vector3(0,0,5)));placePerson(1,origin.clone().add(new TH.Vector3(2,0,4)));
  const prop=T.pickups.find(p=>p.type==='bubble-gun'),at=origin.clone().add(new TH.Vector3(0,0,2));prop.mesh.position.copy(at);B.emit(E.PROP_RELEASE,{id:prop.id,position:at});T.cooldown=0;T.use(.1);const physical={on:on.attached,hit:T.snapshot().pulses?.items?.at(-1)?.paths[0].hit};
  prop.mesh.position.x+=20;wall(origin.clone().add(new TH.Vector3(0,0,1.5)));T.cooldown=0;T.use(.1);const blocked={on:on.attached,hit:T.snapshot().pulses?.items?.at(-1)?.paths[0].hit};
  return{hit,physical,blocked,id:on.id,prop:prop.id};
 },id);expect(r.hit.on).toBe(true);expect(r.hit.off).toBe(false);expect(r.hit.kind).toBe(id==='disco-ray'?'dance':'sick');expect(r.hit.pulse.paths[0].hit).toBe(r.id);expect(r.physical.on).toBe(false);expect(r.physical.hit).toBe(r.prop);expect(r.blocked.on).toBe(false);expect(r.blocked.hit).toBe('world');
});

test('the horn cone reaches an uncovered person and a near-muzzle wall blocks all delivery',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  arm('air-horn');const origin=T.muzzle(),left=placePerson(0,origin.clone().add(new TH.Vector3(-1,0,4))),right=placePerson(1,origin.clone().add(new TH.Vector3(1,0,4)));
  wall(origin.clone().add(new TH.Vector3(.1,0,2)),true);T.use(.1);const cone={left:left.attached,right:right.attached,pulse:T.snapshot().pulses?.items?.at(-1)};T.clearStatuses();
  placePerson(0,origin.clone().add(new TH.Vector3(-1,0,4)));placePerson(1,origin.clone().add(new TH.Vector3(1,0,4)));const body=G.jimothy.body.position;wall(origin.clone().setZ((body.z+origin.z)/2));T.cooldown=0;T.use(.1);return{cone,blocked:{left:left.attached,right:right.attached,pulse:T.snapshot().pulses?.items?.at(-1)}};
 });expect(r.cone.left).toBe(true);expect(r.cone.right).toBe(false);expect(r.cone.pulse.paths.length).toBeGreaterThan(1);expect(r.blocked.left).toBe(false);expect(r.blocked.right).toBe(false);expect(r.blocked.pulse.blockedMuzzle).toBe(true);
});

test('the final charge keeps its visible pulse and living status; expiry and reset release ownership',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  arm('disco-ray');const p=placePerson(0,T.muzzle().add(new TH.Vector3(0,0,4))),item=T.equipped;item.remaining=1;T.use(.1);T.update(.1);
  const last={remaining:item.remaining,equipped:T.equipped?.type||null,attached:p.attached,pulses:T.snapshot().pulses};T.update(.7);const active={attached:p.attached,marks:T.snapshot().pulses?.marks};T.update(5);
  const released={attached:p.attached,statuses:T.statuses.size,marks:T.snapshot().pulses?.marks};restartGame();return{last,active,released,reset:T.snapshot().pulses};
 });expect(r.last.remaining).toBe(0);expect(r.last.equipped).toBe(null);expect(r.last.attached).toBe(true);expect(r.last.pulses.count).toBeGreaterThan(0);expect(r.active.attached).toBe(true);expect(r.active.marks).toBeGreaterThan(0);expect(r.released).toEqual({attached:false,statuses:0,marks:0});expect(r.reset.count).toBe(0);expect(r.reset.marks).toBe(0);
});

test('distinct sonic and ray cues produce bounded audio and stop on blur',async({page})=>{
 await setup(page);await page.keyboard.press('Shift');const rows=[];
 for(const id of ['air-horn','disco-ray','sick-ray']){
  await page.evaluate(async id=>{arm(id);T.sound.stop();await new Promise(r=>setTimeout(r,80));T.use(.1);},id);
  rows.push(await page.evaluate(async()=>{let rms=0,voices=0;for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,10));const s=T.sound.snapshot();rms=Math.max(rms,s.rms);voices=Math.max(voices,s.voices);}return{rms,voices};}));
 }console.log('TOOL_PULSE_AUDIO',JSON.stringify(rows));for(const r of rows){expect(r.rms).toBeGreaterThan(.001);expect(r.voices).toBeLessThanOrEqual(8);}await page.evaluate(()=>window.dispatchEvent(new Event('blur')));expect(await page.evaluate(()=>T.sound.snapshot().voices)).toBe(0);
});

test('pulse and marker pools remain bounded at every simulation rate',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  const rows=[];for(const hz of [30,60,120]){T.reset();arm('sick-ray');G.input.toolUse=true;let peak=0,marks=0;const times=[];for(let i=0;i<hz*8;i++){S.tools.energy=100;T.equipped.remaining=12;const start=performance.now();T.update(1/hz);times.push(performance.now()-start);const s=T.snapshot().pulses;peak=Math.max(peak,s?.count||0);marks=Math.max(marks,s?.marks||0);}times.sort((a,b)=>a-b);rows.push({hz,peak,marks,shots:T.shots,p95:times[Math.floor(times.length*.95)]});G.input.toolUse=false;}T.reset();return{rows,reset:T.snapshot().pulses};
 });console.log('TOOL_PULSE_RATES',JSON.stringify(r));for(const r0 of r.rows){expect(r0.peak).toBeGreaterThan(0);expect(r0.peak).toBeLessThanOrEqual(4);expect(r0.marks).toBeLessThanOrEqual(18);expect(r0.p95).toBeLessThan(12);}expect(Math.max(...r.rows.map(r=>r.shots))-Math.min(...r.rows.map(r=>r.shots))).toBeLessThanOrEqual(1);expect(r.reset.count).toBe(0);
});

test('a full pulse pool rejects before spending and becomes usable after expiry',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{arm('sick-ray');const p=T.equipped,rows=[];for(let i=0;i<5;i++){T.cooldown=0;const energy=S.tools.energy,remaining=p.remaining,used=T.use(.1);rows.push({used,spent:remaining-p.remaining,energy:energy-S.tools.energy});}const count=T.snapshot().pulses?.count;T.update(1);T.cooldown=0;const recovered=T.use(.1);return{rows,count,recovered};});
 expect(r.count).toBe(4);expect(r.rows.slice(0,4).every(r=>r.used&&r.spent===1)).toBe(true);expect(r.rows[4]).toEqual({used:false,spent:0,energy:0});expect(r.recovered).toBe(true);
});


test('a dancing person still stops a later beam before someone behind them',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{arm('disco-ray');const origin=T.muzzle(),front=placePerson(0,origin.clone().add(new TH.Vector3(0,0,4))),back=placePerson(1,origin.clone().add(new TH.Vector3(0,0,7)));T.use(.1);T.cooldown=0;T.use(.1);return{id:front.id,front:front.attached,back:back.attached,hit:T.snapshot().pulses?.items?.at(-1)?.paths[0].hit,statuses:T.statuses.size};});
 expect(r.front).toBe(true);expect(r.back).toBe(false);expect(r.hit).toBe(r.id);expect(r.statuses).toBe(1);
});


test('six actual human statuses fill the marker pool and reject a seventh before spending',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  arm('disco-ray');const d=T.catalog.find(d=>d.id==='disco-ray'),people=G.pedestrians.people.filter(p=>!p.attached&&!p.ragdoll&&!p.vehicleSeat).slice(0,6);
  for(const p of people)T.interrupt(T.entities.get(p.id),'dance',d);T.update(.1);const markers=T.snapshot().pulses.marks,item=T.equipped,before={energy:S.tools.energy,supply:item.remaining};
  const used=T.use(.1),after={energy:S.tools.energy,supply:item.remaining},statuses=T.statuses.size;T.clearStatuses();T.update(.1);
  return{markers,statuses,used,before,after,released:people.every(p=>!p.attached&&!!p.mesh.parent),remaining:T.snapshot().pulses.marks};
 });expect(r.statuses).toBe(6);expect(r.markers).toBe(18);expect(r.used).toBe(false);expect(r.after).toEqual(r.before);expect(r.released).toBe(true);expect(r.remaining).toBe(0);
});
