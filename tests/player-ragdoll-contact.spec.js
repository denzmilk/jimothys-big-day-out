import {test,expect} from '@playwright/test';import {boot,adv,state} from './helpers.mjs';

test('a loaded ragdoll meets a low ceiling and recovers on the original floor',async({page})=>{
 await boot(page,{withRig:true});const out=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js'),{VOXEL}=await import('/src/core/Constants.js'),g=__game,j=g.jimothy,s=VOXEL.SIZE;g.pursuers.update=()=>{};g.military.update=()=>{};teleportJimothy(0,10);
  // A level floor isolates recovery from the original street's grade: a
  // tumbling torso can move sideways even with an initially vertical hit.
  const floor=Math.ceil((j.position.y+1)/s)*s,ceiling=floor+10*s;
  for(let x=-10;x<=10;x++)for(let z=Math.floor(10/s)-10;z<=Math.floor(10/s)+10;z++){g.voxels.set(x,Math.round(floor/s)-1,z,6);g.voxels.set(x,Math.round(ceiling/s),z,6);}
  dropJimothy(0,10,floor+j.radius);j.postUpdate(0);
  eventBus.emit(Events.PLAYER_LAUNCHED,{velocity:[0,10,0],seconds:1.5,mass:35});let top=-Infinity;for(let i=0;i<240;i++){g.update(1/60);top=Math.max(top,j.body.position.y+j.radius);}
  return{ceiling,top,feet:j.position.y,floor,physical:g.physics.ragdolls.has('jimothy'),stunned:JSON.parse(render_game_to_text()).stunned};
 });console.log('RAGDOLL_CEILING',JSON.stringify(out));expect(out.top).toBeLessThanOrEqual(out.ceiling+.03);expect(Math.abs(out.feet-out.floor)).toBeLessThan(.1);expect(out.physical||out.stunned).toBe(false);
});

test('firework blasts share player knockback while harmless distant explosions stay quiet',async({page})=>{
 await boot(page,{withRig:true});const out=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js'),g=__game,j=g.jimothy;teleportJimothy(0,10);const p=j.body.position;
  eventBus.emit(Events.EXPLOSION_SPAWN,{x:p.x+100,y:p.y,z:p.z,radius:2,source:'firework'});const quiet=j.launched;
  eventBus.emit(Events.EXPLOSION_SPAWN,{x:p.x+1,y:p.y,z:p.z,radius:2,source:'firework'});
  return{quiet,launched:j.launched,bodies:g.physics.ragdolls.get('jimothy')?.bodies.length||0};
 });expect(out.quiet).toBe(0);expect(out.launched).toBeGreaterThan(0);expect(out.bodies).toBe(11);
});

test('net capture removes an active player ragdoll and restart restores on-foot control',async({page})=>{
 await boot(page,{withRig:true});const captured=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js'),j=__game.jimothy;eventBus.emit(Events.PLAYER_LAUNCHED,{velocity:[2,8,2],seconds:1.5,mass:35});const started=__game.physics.ragdolls.has('jimothy');eventBus.emit(Events.PLAYER_NETTED);return{started,remaining:__game.physics.ragdolls.has('jimothy'),type:j.body.type,game:JSON.parse(render_game_to_text()).game};
 });expect(captured.started).toBe(true);expect(captured.remaining).toBe(false);expect(captured.type).toBe(4);expect(captured.game.netted).toBe(true);
 await page.evaluate(()=>restartGame());await adv(page,.1);const z=(await state(page)).jimothy.z;await page.keyboard.down('w');await adv(page,.5);await page.keyboard.up('w');expect(Math.abs((await state(page)).jimothy.z-z)).toBeGreaterThan(.5);
});

test('repeated impacts cannot restart the tumble clock and army blasts launch only once',async({page})=>{
 await boot(page,{withRig:true});const out=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js'),g=__game,j=g.jimothy;g.pursuers.update=()=>{};g.military.update=()=>{};teleportJimothy(0,10);let launches=0;const off=eventBus.on(Events.PLAYER_LAUNCHED,()=>launches++);
  const p=j.body.position;g.military.explode({x:p.x-1,y:p.y,z:p.z},3);const armyLaunches=launches,first=j.launched;g.update(.1);
  for(let n=0;n<10;n++)eventBus.emit(Events.PLAYER_LAUNCHED,{velocity:[2,6,0],seconds:30,mass:35});
  const after=j.launched,count=g.physics.ragdolls.get('jimothy')?.bodies.length;for(let i=0;i<300;i++)g.update(1/60);off();
  return{armyLaunches,first,after,count,ragdoll:j.ragdoll.snapshot(),stunned:JSON.parse(render_game_to_text()).stunned};
 });expect(out.armyLaunches).toBe(1);expect(out.after).toBeLessThan(out.first);expect(out.count).toBe(11);expect(out.ragdoll.phase).toBe('idle');expect(out.stunned).toBe(false);
});

test('extinguisher propulsion keeps the held tool and animated limbs',async({page})=>{
 await boot(page,{withRig:true});await page.waitForFunction(()=>__game.tools.ready);const out=await page.evaluate(()=>{
  const g=__game,t=g.tools,p=t.pickups.find(p=>p.type==='fire-extinguisher');t.equip(p);t.use(.2);return{equipped:t.snapshot().equipped,launched:g.jimothy.launched,ragdoll:g.jimothy.ragdoll.snapshot()};
 });expect(out.equipped).toBe('fire-extinguisher');expect(out.launched).toBeGreaterThan(0);expect(out.ragdoll.phase).toBe('idle');
});
