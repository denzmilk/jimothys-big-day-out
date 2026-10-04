import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

async function setup(page){
 await boot(page);await page.waitForFunction(()=>__game.tools.ready);
 await page.evaluate(async()=>{
  window.G=__game;window.T=G.tools;window.S=(await import('/src/core/GameState.js')).gameState;window.TH=await import('/node_modules/three/build/three.module.js');
  const bus=await import('/src/core/EventBus.js');window.B=bus.eventBus;window.E=bus.Events;window.V=(await import('/src/core/Constants.js')).VOXEL;
  window.arm=id=>{T.equip(T.pickups.find(p=>p.type===id));T.cooldown=0;S.tools.energy=100;S.player.stunned=false;G.jimothy.launched=0;T.aimOverride={x:0,y:0,z:1};T.pose();};
  window.wall=(z,at)=>{const cell=V.SIZE;for(let x=-12;x<=12;x++)for(let y=-12;y<=12;y++)G.voxels.set(Math.floor(at.x/cell)+x,Math.floor(at.y/cell)+y,Math.floor(z/cell),1);};
  window.place=(p,at)=>{p.mesh.position.copy(at);B.emit(E.PROP_RELEASE,{id:p.id,position:at});return G.physics.props.get(p.id).body;};
 });
}

test('four flows start at the measured Blender outlets through growth, aim and movement',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  // Independent Blender source measurements from tools/measure-tool-outlets.py.
  const outlets={'power-washer':[-.13,.17,.94],'leaf-blower':[0,.23,.85],'vacuum':[.2,.065,.895],'fire-extinguisher':[.18,.14,.63]},rows=[];
  for(const fat of [0,90])for(const [id,outlet]of Object.entries(outlets)){
   setFatness(fat);arm(id);G.jimothy.body.position.y=200;T.aimOverride={x:.2,y:.3,z:1};T.pose();const p=T.equipped;
   const expected=p.mesh.children[0].localToWorld(new TH.Vector3(...outlet));T.use(.1);const flow=T.snapshot().flow;
   rows.push({id,fat,expected:expected.toArray(),flow});
  }return rows;
 });for(const row of r){expect(row.flow,row.id).toBeTruthy();expect(row.flow.tool).toBe(row.id);expect(Math.hypot(...row.flow.origin.map((v,i)=>v-row.expected[i]))).toBeLessThan(.02);expect(row.flow.paths.length).toBeGreaterThan(0);expect(row.flow.visible).toBe(true);}
});

test('a narrow washer jet hits its first physical target and stops at a real wall',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  arm('power-washer');G.jimothy.body.position.y+=20;T.pose();const start=T.muzzle(),a=T.pickups.find(p=>p.type==='bubble-gun'),b=T.pickups.find(p=>p.type==='air-horn');
  const first=place(a,start.clone().add(new TH.Vector3(0,0,4))),second=place(b,start.clone().add(new TH.Vector3(0,0,7)));
  T.use(.12);const hit={first:first.velocity.length(),second:second.velocity.length(),flow:T.snapshot().flow};first.velocity.setZero();second.velocity.setZero();
  wall(start.z+2,start);T.cooldown=0;T.use(.12);const blocked={first:first.velocity.length(),second:second.velocity.length(),flow:T.snapshot().flow};
  return{hit,blocked,start:start.toArray(),a:a.id};
 });expect(r.hit.first).toBeGreaterThan(0);expect(r.hit.second).toBe(0);expect(r.hit.flow.paths[0].hit).toBe(r.a);expect(r.blocked.first).toBe(0);expect(r.blocked.second).toBe(0);expect(r.blocked.flow.paths[0].end[2]).toBeLessThan(r.start[2]+2.2);
});

test('a wall between Jimothy and the nozzle prevents firing from its far side',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  arm('power-washer');G.jimothy.body.position.y+=20;T.pose();const muzzle=T.muzzle(),j=G.jimothy.body.position,wallZ=(j.z+muzzle.z)/2;
  const target=T.pickups.find(p=>p.type==='bubble-gun'),body=place(target,muzzle.clone().add(new TH.Vector3(0,0,4)));wall(wallZ,muzzle);T.use(.12);
  return{wall:wallZ,speed:body.velocity.length(),flow:T.snapshot().flow};
 });expect(r.speed).toBe(0);expect(r.flow.blockedMuzzle).toBe(true);expect(r.flow.paths.every(p=>p.end[2]<r.wall+.25)).toBe(true);
});

test('broad gusts and inward suction have distinct paths and move actual props and food',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  arm('leaf-blower');G.jimothy.body.position.y+=20;T.pose();const origin=T.muzzle(),p=T.pickups.find(p=>p.type==='air-horn'),body=place(p,origin.clone().add(new TH.Vector3(2,0,4)));T.use(.12);const air={speed:body.velocity.length(),flow:T.snapshot().flow};
  teleportJimothy(0,-16);advanceTime(.1);arm('vacuum');const j=G.jimothy.position,food=G.trashCans.spawnFood('whole-pizza',j.x,j.z+4),before=food.mesh.position.distanceTo(j);T.use(.12);const obstructed=food.mesh.position.distanceTo(j);
  // Swapping dropped the blower directly across the intake-to-food path.
  // Keep that occlusion assertion, then clear the real prop for the pull.
  const blower=T.pickups.find(p=>p.type==='leaf-blower');place(blower,blower.mesh.position.clone().add(new TH.Vector3(10,0,0)));T.cooldown=0;T.use(.12);const suction={before,obstructed,after:food.mesh.position.distanceTo(j),flow:T.snapshot().flow};
  arm('fire-extinguisher');T.use(.2);const extinguisher={vy:G.jimothy.vy,flow:T.snapshot().flow};return{air,suction,extinguisher};
 });console.log('TOOL_FLOW_MODES',JSON.stringify(r));expect(r.air.speed).toBeGreaterThan(0);expect(r.air.flow.style).toBe('gust');expect(r.air.flow.paths.length).toBeGreaterThan(1);expect(r.suction.obstructed).toBe(r.suction.before);expect(r.suction.after).toBeLessThan(r.suction.before);expect(r.suction.flow.style).toBe('suction');expect(r.extinguisher.vy).toBeGreaterThan(0);expect(r.extinguisher.flow.style).toBe('foam');
});

test('held flow produces a real loop signal then stops on release, empty, blur, pause, ride and reset',async({page})=>{
 await setup(page);await page.keyboard.press('Shift');await page.evaluate(()=>arm('power-washer'));
 await page.keyboard.down('v');await adv(page,.25);
 const on=await page.evaluate(async()=>{let rms=0;for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,10));rms=Math.max(rms,T.sound.snapshot().rms);}return{rms,flow:T.snapshot().flow,audio:T.sound.snapshot()};});expect(on.rms).toBeGreaterThan(.001);expect(on.audio.loops).toBe(1);expect(on.flow.visible).toBe(true);
 await page.keyboard.up('v');await adv(page,.6);let s=await state(page);expect(s.tools.audio.loops).toBe(0);expect(s.tools.flow.visible).toBe(false);
 const r=await page.evaluate(()=>{
  const rows=[];for(const action of ['empty','blur','pause','ride','reset']){T.reset();arm('power-washer');G.input.toolUse=true;if(action==='empty')T.equipped.remaining=1;T.update(.12);
   if(action==='blur')window.dispatchEvent(new Event('blur'));if(action==='pause')S.game.paused=true;if(action==='ride')B.emit(E.PLAYER_RIDE,{active:true});if(action==='reset')T.reset();
   T.update(.6);rows.push({action,audio:T.sound.snapshot(),flow:T.snapshot().flow});S.game.paused=false;G.input.toolUse=false;if(action==='ride')B.emit(E.PLAYER_RIDE,{active:false});}
  return rows;
 });for(const row of r){expect(row.audio.loops,row.action).toBe(0);expect(row.flow.visible,row.action).toBe(false);}
});

test('sustained spray resources remain bounded at 30/60/120 Hz and restart clears them',async({page})=>{
 await setup(page);const rows=await page.evaluate(()=>{
  const rows=[];for(const hz of [30,60,120]){T.reset();arm('power-washer');G.input.toolUse=true;let peak=0,paths=0;const samples=[];
   for(let i=0;i<hz*8;i++){S.tools.energy=100;const now=performance.now();T.update(1/hz);samples.push(performance.now()-now);const f=T.snapshot().flow;peak=Math.max(peak,f.particles);paths=Math.max(paths,f.paths.length);}
   samples.sort((a,b)=>a-b);rows.push({hz,peak,paths,p95:samples[Math.floor(samples.length*.95)],models:T.models.size,pickups:T.pickups.length});G.input.toolUse=false;T.reset();
  }return{rows,flow:T.snapshot().flow,audio:T.sound.snapshot()};
 });console.log('TOOL_FLOW_BUDGET',JSON.stringify(rows));for(const row of rows.rows){expect(row.peak).toBeLessThanOrEqual(96);expect(row.paths).toBeLessThanOrEqual(16);expect(row.models).toBe(24);expect(row.pickups).toBe(24);expect(row.p95).toBeLessThan(12);}expect(rows.flow.particles).toBe(0);expect(rows.flow.visible).toBe(false);expect(rows.audio.loops).toBe(0);
});

test('an outlet beyond the bounded query range declines without spending or marching across the island',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  setFatness(15000);arm('power-washer');let queries=0;const original=G.voxels.solidAtWorld;G.voxels.solidAtWorld=function(...args){queries++;return original.apply(this,args);};
  const p=T.equipped,energy=S.tools.energy,remaining=p.remaining,used=T.use(.12);G.voxels.solidAtWorld=original;
  return{used,queries,energy:S.tools.energy-energy,spent:remaining-p.remaining,notice:T.snapshot().notice};
 });console.log('TOOL_EXTREME_SIZE',JSON.stringify(r));expect(r.used).toBe(false);expect(r.queries).toBeLessThanOrEqual(512);expect(r.energy).toBe(0);expect(r.spent).toBe(0);expect(r.notice).toBeTruthy();
});

test('a jet knocks down a real pedestrian while cover protects the next person',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  arm('power-washer');G.jimothy.body.position.y=200;T.pose();const start=T.muzzle(),rows=[];
  const people=G.pedestrians.people.filter(p=>!p.attached&&!p.ragdoll&&!p.vehicleSeat).slice(0,2);
  for(const [index,p]of people.entries()){
   G.pedestrians.activities.stop(p,'test');p.x=start.x;p.z=start.z+4;p.y=start.y-.8;p.mesh.position.set(p.x,p.y,p.z);p.mesh.updateMatrixWorld(true);
   if(index)wall(start.z+2,start);T.cooldown=0;T.use(.12);rows.push({id:p.id,down:!!p.ragdoll,hit:T.snapshot().flow.paths[0].hit});
   if(!index){B.emit(E.HUMAN_UNREGISTER,{id:p.id});p.mesh.position.x+=20;}
  }return rows;
 });expect(r).toHaveLength(2);expect(r[0].hit).toBe(r[0].id);expect(r[0].down).toBe(true);expect(r[1].hit).toBe('world');expect(r[1].down).toBe(false);
});
