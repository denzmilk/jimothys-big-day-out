import {test,expect} from '@playwright/test';import {boot,adv,state} from './helpers.mjs';
async function scene(page){await boot(page,{withRig:true});await page.evaluate(()=>{const g=__game;g.pursuers.update=()=>{};g.military.update=()=>{};teleportJimothy(0,10);g.jimothy.postUpdate(0);});}
test('a strong launch articulates original Jimothy and returns control without leaked bodies',async({page})=>{
 await scene(page);const out=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js'),g=__game,j=g.jimothy,r=j.rig,rows=[];
  for(const hz of [30,60,120]){
   restartGame();teleportJimothy(0,10);j.postUpdate(0);const before=g.physics.world.constraints.length,skin=r.skinned;
   eventBus.emit(Events.PLAYER_LAUNCHED,{velocity:[6,9,2],seconds:1.5,mass:35});
   const rag=g.physics.ragdolls.get('jimothy'),started={bodies:rag?.bodies.length||0,joints:rag?.constraints.length||0,sharedRoot:rag?.bodies[0]===j.body};
   let limbMotion=0,spin=0,finite=true;for(let i=0;i<hz*5;i++){g.update(1/hz);for(const n of ['leg_FL','shin_FR','head','tail'])limbMotion=Math.max(limbMotion,r.bones[n].quaternion.angleTo(r.rest[n]));spin=Math.max(spin,Math.abs(j.body.quaternion.x)+Math.abs(j.body.quaternion.z));finite&&=j.group.matrixWorld.elements.every(Number.isFinite);}
   rows.push({hz,...started,limbMotion,spin,finite,sameSkin:r.skinned===skin,remaining:g.physics.ragdolls.has('jimothy'),constraints:g.physics.world.constraints.length-before,launched:j.launched,stunned:JSON.parse(render_game_to_text()).stunned,grounded:j.grounded});
  }return rows;
 });console.log('PLAYER_RAGDOLL',JSON.stringify(out));for(const r of out){expect(r.bodies).toBe(11);expect(r.joints).toBe(10);expect(r.sharedRoot).toBe(true);expect(r.limbMotion).toBeGreaterThan(.2);expect(r.spin).toBeGreaterThan(.1);expect(r.finite&&r.sameSkin).toBe(true);expect(r.remaining).toBe(false);expect(r.constraints).toBe(0);expect(r.launched).toBe(0);expect(r.stunned).toBe(false);expect(r.grounded).toBe(true);}
});

test('car explosions knock small Jimothy away and heavier bodies resist',async({page})=>{
 await scene(page);const out=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js'),g=__game,j=g.jimothy,rows=[];
  for(const fat of [0,90,400]){
   restartGame();setFatness(fat);teleportJimothy(0,10);j.postUpdate(0);const p=j.body.position;
   eventBus.emit(Events.CAR_EXPLODED,{id:'test-car',x:p.x-2,y:p.y,z:p.z,radius:4.5});
   rows.push({fat,speed:j.body.velocity.length(),launched:j.launched,bodies:g.physics.ragdolls.get('jimothy')?.bodies.length||0,playing:JSON.parse(render_game_to_text()).game.isPlaying});
  }return rows;
 });console.log('PLAYER_BLAST',JSON.stringify(out));expect(out[0].speed).toBeGreaterThan(5);expect(out[0].bodies).toBe(11);expect(out[1].speed).toBeLessThan(out[0].speed*.5);expect(out[2].speed).toBeLessThan(out[1].speed);expect(out[2].bodies).toBe(0);for(const r of out)expect(r.playing).toBe(true);
});

test('a moving car hits an on-foot player across a frame while a parked car stays quiet',async({page})=>{
 await scene(page);const out=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js'),T=await import('/node_modules/three/build/three.module.js'),g=__game,j=g.jimothy,rows=[];
  g.streetLife.update=()=>{};
  for(const speed of [0,2,14]){
   restartGame();teleportJimothy(0,10);j.postUpdate(0);const car={id:'impact-car',kind:'car',mesh:new T.Group(),mass:1100,half:[.85,.7,1.6],size:3.2,loose:false};
   car.mesh.position.set(j.body.position.x,j.body.position.y, j.body.position.z-1.6-j.radius-.05);eventBus.emit(Events.PROP_CREATE,car);
   const before=j.body.position.clone(),to=car.mesh.position.clone();to.z+=speed/30;eventBus.emit(Events.PROP_POSE,{id:car.id,position:to,quaternion:car.mesh.quaternion});g.physics.update(1/30);
   rows.push({speed,launched:j.launched,velocity:j.body.velocity.length(),bodies:g.physics.ragdolls.get('jimothy')?.bodies.length||0});eventBus.emit(Events.PROP_REMOVE,{id:car.id});
  }return rows;
 });console.log('PLAYER_CAR_HIT',JSON.stringify(out));expect(out[0].launched).toBe(0);expect(out[1].launched).toBe(0);expect(out[2].launched).toBeGreaterThan(0);expect(out[2].velocity).toBeGreaterThan(4);expect(out[2].bodies).toBe(11);
});

test('ragdoll ownership clears on repeated hits, water, riding, growth and restart',async({page})=>{
 await scene(page);const out=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js'),g=__game,j=g.jimothy,rows=[];
  const launch=()=>eventBus.emit(Events.PLAYER_LAUNCHED,{velocity:[3,8,1],seconds:1.5,mass:35});
  for(const kind of ['repeat','water','ride','growth','restart','spawn']){
   restartGame();teleportJimothy(0,10);j.postUpdate(0);launch();const started=g.physics.ragdolls.has('jimothy');
   if(kind==='repeat'){for(let i=0;i<8;i++)launch();}
   else if(kind==='water'){const off=eventBus.on(Events.WATER_SAMPLE,q=>q.receive({height:j.body.position.y+2,depth:10}));advanceTime(.5);off();}
   else if(kind==='ride')eventBus.emit(Events.PLAYER_RIDE,{active:true});
   else if(kind==='growth'){setFatness(250);advanceTime(.1);}
   else if(kind==='spawn')eventBus.emit(Events.SPAWN_POSE,{position:{x:0,y:42,z:10},grounded:true});
   else restartGame();
   const rag=g.physics.ragdolls.get('jimothy');rows.push({kind,started,bodies:rag?.bodies.length||0,finite:j.group.matrixWorld.elements.every(Number.isFinite)});
  }return rows;
 });console.log('PLAYER_RAGDOLL_LIFECYCLE',JSON.stringify(out));for(const r of out){expect(r.started).toBe(true);expect(r.bodies).toBe(r.kind==='repeat'?11:0);expect(r.finite).toBe(true);}
});

test('giant rolling absorbs a nearby car blast without losing the held move',async({page})=>{
 await scene(page);await page.evaluate(()=>{setFatness(250);teleportJimothy(-2,-40);faceJimothy(0);});await page.keyboard.down('c');await adv(page,.2);
 const out=await page.evaluate(async()=>{const {eventBus,Events}=await import('/src/core/EventBus.js'),j=__game.jimothy,p=j.body.position;const before=j.move?.kind;eventBus.emit(Events.CAR_EXPLODED,{id:'blast-car',x:p.x-2,y:p.y,z:p.z,radius:4.5});return{before,after:j.move?.kind,ragdoll:j.ragdoll.snapshot(),speed:j.speed};});
 expect(out.before).toBe('roll');expect(out.after).toBe('roll');expect(out.ragdoll.bodies).toBe(0);expect(out.speed).toBeGreaterThan(0);
});

test('direct controller reset clears a launched or seated pose and restores collisions',async({page})=>{
 await scene(page);const out=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js'),j=__game.jimothy,rows=[];for(const kind of ['launch','ride']){
   if(kind==='launch')eventBus.emit(Events.PLAYER_LAUNCHED,{velocity:[3,8,1],seconds:1.5,mass:35});else eventBus.emit(Events.PLAYER_RIDE,{active:true});
   j.reset();rows.push({kind,riding:!!j.riding,stunned:JSON.parse(render_game_to_text()).stunned,mask:j.body.collisionFilterMask,bodies:__game.physics.ragdolls.get('jimothy')?.bodies.length||0});
  }return rows;
 });console.log('PLAYER_RESET',JSON.stringify(out));for(const r of out){expect(r.riding||r.stunned).toBe(false);expect(r.mask).not.toBe(0);expect(r.bodies).toBe(0);}
});
