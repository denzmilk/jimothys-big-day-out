import {test,expect} from '@playwright/test';import {boot,adv,state} from './helpers.mjs';
const errors=new WeakMap();test.beforeEach(async({page})=>{const log=[];errors.set(page,log);page.on('pageerror',e=>log.push(String(e)));page.on('console',m=>{if(m.type()==='error')log.push(m.text());});});test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));
async function ready(page,rig=false){await boot(page,{withRig:rig});await page.waitForFunction(()=>__game.pursuers.response.ready);}
async function tier(page,n){await page.evaluate(async n=>{const {gameState}=await import('/src/core/GameState.js'),{HEAT}=await import('/src/core/Constants.js');gameState.heat.points=HEAT.TIER_THRESHOLDS[n];__game.heat._retier();},n);}
async function stage(page,type='angry-local'){
 return page.evaluate(async type=>{
  const g=__game,ai=g.pursuers,{gameState}=await import('/src/core/GameState.js');ai.reset();gameState.heat.points=20;gameState.heat.tier=2;g.jimothy.hitCooldown=0;
  const sites=[];for(let x=-24;x<=24;x+=3)for(let z=-24;z<=24;z+=3){const h=g.voxels.terrainHeightAt(x,z),other=g.voxels.terrainHeightAt(x,z-1);if(Math.abs(h-other)<.04&&!g.voxels.physicalSolidAtWorld(x,h+1,z)&&!g.voxels.physicalSolidAtWorld(x,other+1,z-1))sites.push({x,z});}
  sites.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));if(!sites.length)throw Error('No flat open contact fixture');teleportJimothy(sites[0].x,sites[0].z);
  const pos=g.jimothy.position,id=spawnPursuerAt(type,pos.x,pos.z-1),p=ai.all.find(p=>p.id===id);p.group.position.y=ai._groundY(p.group.position.x,p.group.position.z);p.group.rotation.y=0;p.sees=true;p.state='chase';
  p.grounding.reset();window.actor=p;if(!g.voxels.hasLineOfSight(p.group.position.x,p.group.position.y+.55,p.group.position.z,pos.x,pos.y,pos.z))throw Error('Contact fixture must have clear sight');return id;
 },type);
}

test('one-star photography is visible without stun, and two-star locals have varied bounded models',async({page})=>{
 await ready(page);await tier(page,1);await adv(page,.1);let s=await state(page);expect(s.pursuers.filter(p=>p.type==='paparazzo')).toHaveLength(1);expect(s.pursuers.every(p=>p.type!=='angry-local')).toBe(true);expect(s.pursuers[0].camera).toBe(true);
 const photo=await page.evaluate(async()=>{
  const g=__game,ai=g.pursuers,p=ai.paparazzi[0],j=g.jimothy.position;p.group.position.set(j.x,j.y-g.jimothy.radius,j.z-2.5);p.group.rotation.y=0;p.grounding.reset();p.state='chase';p.sees=true;p.awareness=1;p.flashCooldown=0;
  for(let i=0;i<60&&ai.response.photos===0;i++)ai.update(1/60);
  p.camera.updateWorldMatrix(true,true);const {LOCAL_RESPONSE:C}=await import('/src/core/Constants.js'),left=p.visual.getObjectByName('hand_l').getWorldPosition(j.clone()),leftGap=left.distanceTo(p.camera.localToWorld(j.clone().fromArray(C.CAMERA_LEFT)));const camera=p.camera.getWorldPosition(j.clone()),forward=j.clone().set(0,0,1).applyQuaternion(p.camera.getWorldQuaternion(p.group.quaternion.clone())),dot=forward.dot(j.clone().sub(camera).normalize());
  return{dot,leftGap,photos:ai.response.photos,stunned:JSON.parse(render_game_to_text()).stunned,flash:p.cameraFlash.material.opacity,raised:p.responsePose.raised};
 });expect(photo.photos).toBeGreaterThan(0);expect(photo.stunned).toBe(false);expect(photo.flash).toBeGreaterThan(0);expect(photo.raised).toBeGreaterThan(.6);expect(photo.dot).toBeGreaterThan(.95);expect(photo.leftGap).toBeLessThan(.08);
 await tier(page,2);await adv(page,.1);s=await state(page);expect(s.pursuers.filter(p=>p.type==='angry-local')).toHaveLength(2);
 const r=await page.evaluate(async()=>{const ai=__game.pursuers,{eventBus,Events}=await import('/src/core/EventBus.js'),models=ai.locals.map(p=>p.model);for(const p of [...ai.paparazzi,...ai.locals])eventBus.emit(Events.ENTITY_ATTACH,{id:`pursuer-${p.id}`});for(let i=0;i<10;i++)ai.update(.1);return{models,count:ai.all.length};});expect(new Set(r.models).size).toBe(2);expect(r.count).toBe(5);
 await page.evaluate(()=>restartGame());await adv(page,.1);expect((await state(page)).pursuers).toHaveLength(0);expect((await state(page)).response).toMatchObject({photos:0,kicks:0,hits:0,particles:0});
});

test('a close kick launches small Jimothy through shared ragdoll physics and he gets up',async({page})=>{
 await ready(page,true);await stage(page);
 const r=await page.evaluate(()=>{
  const g=__game,p=actor,ai=g.pursuers;for(let i=0;i<60;i++){p.sees=true;ai.response.update(1/60);ai._animate(p,1/60,p.group.position.x,p.group.position.z);ai.response.kick(p,1/60);p.responsePose.apply(1/60);if(ai.response.hits)break;}
  const s=JSON.parse(render_game_to_text());ai.update=()=>{};return{response:s.response,ragdoll:s.jimothy.ragdoll,dynamic:g.jimothy.body.type===1,vy:g.jimothy.body.velocity.y,playing:s.game.isPlaying};
 });expect(r.response.hits).toBe(1);expect(r.dynamic).toBe(true);expect(r.vy).toBeGreaterThan(0);expect(r.playing).toBe(true);expect(r.ragdoll.phase).toBe('physical');expect(r.ragdoll.bodies).toBe(11);
 await adv(page,5);expect((await state(page)).jimothy.ragdoll.phase).toBe('idle');expect((await state(page)).game.netted).toBe(false);
});

test('a locked kick misses a sideways dodge and a wall, and has a readable moving leg',async({page})=>{
 await ready(page);await stage(page);
 const r=await page.evaluate(()=>{
  const g=__game,p=actor,ai=g.pursuers,foot=p.visual.getObjectByName('foot_r'),support=p.visual.getObjectByName('foot_l'),v=p.group.position.clone();
  const read=()=>({foot:foot.getWorldPosition(v.clone()).toArray(),support:support.getWorldPosition(v.clone()).toArray()});ai._animate(p,0,p.group.position.x,p.group.position.z);const before=read();
  for(let i=0;i<30;i++){ai._animate(p,1/60,p.group.position.x,p.group.position.z);ai.response.kick(p,1/60);p.responsePose.apply(1/60);}const windup=read(),heading=p.kick.heading;
  g.jimothy.body.position.x+=4;
  for(let i=0;i<100;i++){p.sees=true;ai._animate(p,1/60,p.group.position.x,p.group.position.z);ai.response.kick(p,1/60);p.responsePose.apply(1/60);}
  const dodgeHits=ai.response.hits;g.jimothy.body.position.x-=4;p.kick.cooldown=0;ai.response.cooldown=0;const sight=ai.voxels.hasLineOfSight;ai.voxels.hasLineOfSight=()=>false;
  for(let i=0;i<90;i++)ai.response.kick(p,1/60);ai.voxels.hasLineOfSight=sight;
  return{before,windup,heading,dodgeHits,wallHits:ai.response.hits,phase:p.kick.phase};
 });expect(r.windup.foot[1]-r.before.foot[1]).toBeGreaterThan(.2);expect(Math.hypot(...r.windup.support.map((v,i)=>v-r.before.support[i]))).toBeLessThan(.12);expect(r.heading).toBe(0);expect(r.dodgeHits).toBe(0);expect(r.wallHits).toBe(0);expect(r.phase).toBe('idle');
});

test('net attempts, shield, riding, ragdoll and collection cancel a pending kick; giant rolls resist it',async({page})=>{
 await ready(page);await stage(page);
 const r=await page.evaluate(async()=>{
  const g=__game,p=actor,ai=g.pursuers,{gameState}=await import('/src/core/GameState.js'),{eventBus,Events}=await import('/src/core/EventBus.js');
  const starts=[];const start=()=>{p.kick.cooldown=0;ai.response.cooldown=0;p.sees=true;ai.response.kick(p,.2);starts.push(p.kick.phase);};
  start();gameState.capture.phase='windup';ai.response.kick(p,.1);const net=p.kick.phase;gameState.capture.phase='idle';
  start();gameState.tools.shield=1;ai.response.kick(p,.1);const shield=p.kick.phase;gameState.tools.shield=0;
  start();gameState.vehicle.phase='driving';ai.response.kick(p,.1);const riding=p.kick.phase;gameState.vehicle.phase='onFoot';
  start();eventBus.emit(Events.HUMAN_DOWN,{id:`pursuer-${p.id}`,active:true});const ragdoll=p.kick.phase;p.ragdoll=false;
  start();eventBus.emit(Events.ENTITY_ATTACH,{id:`pursuer-${p.id}`});const attached=p.kick.phase;p.attached=false;
  setFatness(250);g.jimothy.move={kind:'roll',elapsed:0};g.jimothy.vel.set(0,0,3);g.jimothy.hitCooldown=0;
  eventBus.emit(Events.PLAYER_HIT,{source:'kick',velocity:[0,3.4,6]});return{starts,net,shield,riding,ragdoll,attached,move:g.jimothy.move?.kind,physical:g.jimothy.ragdoll.physical,playing:gameState.game.isPlaying};
 });expect(r.starts).toEqual(['windup','windup','windup','windup','windup']);expect(r).toMatchObject({net:'idle',shield:'idle',riding:'idle',ragdoll:'idle',attached:'idle',move:'roll',physical:false,playing:true});
});

test('shutter and kick sounds produce audio and response effects remain bounded and reset',async({page})=>{
 await ready(page);await page.keyboard.press('h');await stage(page,'paparazzo');
 await page.evaluate(()=>{const r=__game.pursuers.response;r.photo(actor,false);r.cue('hit',actor.group.position);});await page.waitForTimeout(35);const audio=(await state(page)).response;expect(audio.rms).toBeGreaterThan(.00001);expect(audio.voices).toBeLessThanOrEqual(4);
 const r=await page.evaluate(()=>{const ai=__game.pursuers;for(let i=0;i<100;i++)ai.response.photo(actor,false);ai.response.update(1);return ai.response.snapshot();});expect(r.particles).toBeLessThanOrEqual(40);expect(r.voices).toBeLessThanOrEqual(4);
 await page.evaluate(()=>restartGame());await page.waitForTimeout(80);expect((await state(page)).response).toMatchObject({photos:0,kicks:0,hits:0,particles:0,voices:0});
});
