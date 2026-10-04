import {test,expect} from '@playwright/test';import {boot,adv,state} from './helpers.mjs';
const errors=new WeakMap();test.beforeEach(async({page})=>{const list=[];errors.set(page,list);page.on('pageerror',e=>list.push(String(e)));page.on('console',m=>{if(m.type()==='error')list.push(m.text());});});test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));
async function setTier(page,tier){await page.evaluate(async tier=>{const {gameState}=await import('/src/core/GameState.js'),{HEAT}=await import('/src/core/Constants.js');gameState.heat.points=HEAT.TIER_THRESHOLDS[tier];gameState.heat.tier=tier;gameState.heat.target=tier;},tier);}

test('four stars dispatch bounded sourced police cars with visible MPFB drivers; restart clears them',async({page})=>{
 await boot(page);expect(await page.evaluate(()=>!!__game.police)).toBe(true);await page.waitForFunction(()=>__game.police.ready&&__game.pursuers.response.gunsReady);
 await setTier(page,3);await adv(page,.1);expect((await state(page)).police.cars).toHaveLength(0);
 await setTier(page,4);await adv(page,1);const s=await state(page);expect(s.police.cars.length).toBeGreaterThan(0);expect(s.police.cars.length).toBeLessThanOrEqual(2);expect(s.police.officers).toBeLessThanOrEqual(2);expect(s.police.cars[0].model).toBe('police');expect(s.driving.drivers.some(d=>d.car===s.police.cars[0].id)).toBe(true);expect(s.military.units).toHaveLength(0);
 await page.evaluate(()=>restartGame());await adv(page,.1);const reset=await state(page);expect(reset.police.cars).toHaveLength(0);expect(reset.police.officers).toBe(0);expect(reset.police.projectiles).toBe(0);
});

async function dispatch(page){await boot(page);expect(await page.evaluate(()=>!!__game.police)).toBe(true);await page.waitForFunction(()=>__game.police.ready&&__game.pursuers.response.gunsReady);await setTier(page,4);await adv(page,1);}

test('patrol cars move along real connected roads, then search a fixed last-seen area behind cover',async({page})=>{
 await dispatch(page);
 const r=await page.evaluate(()=>{const g=__game,u=g.police.units[0],p=u.car;const start=p.mesh.position.clone();for(let i=0;i<300;i++){g.streetLife.update(1/60);g.police.update(1/60);}const moved=p.mesh.position.distanceTo(start);u.lastKnown={x:12,z:6};g.voxels.hasLineOfSight=()=>false;const remembered={...u.lastKnown};teleportJimothy(30,30);for(let i=0;i<60;i++)g.police.update(1/60);return{moved,remembered,after:u.lastKnown,state:u.state,finite:p.mesh.matrixWorld.elements.every(Number.isFinite),road:p.route?.road.id};});expect(r.moved).toBeGreaterThan(3);expect(r.after).toEqual(r.remembered);expect(r.state).toBe('search');expect(r.finite).toBe(true);expect(r.road).toBeTruthy();
});

test('hijacking a stopped patrol releases one officer; destruction and restart clear every seat',async({page})=>{
 await dispatch(page);
 const entered=await page.evaluate(()=>{const g=__game,p=g.police.units[0].car;g.police.update=()=>{};p.driving=false;p.route.speed=0;const at=g.driving.exitPoint(p,g.jimothy.radius);if(!at)throw Error('Patrol must have a clear roadside doorway');teleportJimothy(at.x,at.z);return{car:p.id,driver:g.driving.drivers.get(p.id)?.id,entered:g.driving.enter(p)};});expect(entered.driver).toBeTruthy();expect(entered.entered).toBe(true);
 await adv(page,1.4);let s=await state(page);expect(s.driving.phase).toBe('driving');expect(s.driving.drivers.some(p=>p.car===entered.car)).toBe(false);expect(s.pursuers.some(p=>`pursuer-${p.id}`===entered.driver&&!p.attached)).toBe(true);
 await page.evaluate(async id=>{const {eventBus,Events}=await import('/src/core/EventBus.js');eventBus.emit(Events.VEHICLE_BREAK,{id,radius:5,instigator:'player'});},entered.car);await adv(page,.1);expect((await state(page)).driving.phase).toBe('onFoot');await page.evaluate(()=>restartGame());await adv(page,.1);s=await state(page);expect(s.police.cars).toHaveLength(0);expect(s.police.officers).toBe(0);expect(s.driving.drivers.every(p=>!p.id.startsWith('pursuer-'))).toBe(true);
});

test('officers use a held gun, swept shots stop at cover, and hostile damage does not earn wanted points',async({page})=>{
 await dispatch(page);
 const r=await page.evaluate(async()=>{const g=__game,ai=g.pursuers,{gameState}=await import('/src/core/GameState.js');ai.reset();teleportJimothy(-6,-6);const j=g.jimothy.position,id=spawnPursuerAt('police',j.x,j.z-5),p=ai.all.find(p=>p.id===id);p.group.position.y=ai._groundY(p.group.position.x,p.group.position.z);p.group.rotation.y=0;p.sees=true;p.state='chase';p.grounding.reset();const before=gameState.heat.points;let shots=0;const ray=g.voxels.raycast.bind(g.voxels);const cover=(x,y,z,dx,dy,dz,length)=>({x:x+dx/2,y:y+dy/2,z:z+dz/2,t:Math.min(length/2,.1)});for(let i=0;i<90;i++){p.sees=true;ai._animate(p,1/60,p.group.position.x,p.group.position.z);ai.response.gun(p,1/60);p.responsePose.apply(1/60,g.jimothy.position);g.voxels.raycast=cover;ai.response.update(1/60);g.voxels.raycast=ray;shots=Math.max(shots,ai.response.gunShots);}g.voxels.raycast=ray;return{gun:!!p.gun,held:p.gun?.parent.name,shots,hits:ai.response.gunHits,heatBefore:before,heatAfter:gameState.heat.points,playing:gameState.game.isPlaying,particles:ai.response.particles.length};});expect(r.gun).toBe(true);expect(r.held).toBe('hand_r');expect(r.shots).toBeGreaterThan(0);expect(r.hits).toBe(0);expect(r.heatAfter).toBe(r.heatBefore);expect(r.playing).toBe(true);expect(r.particles).toBeLessThanOrEqual(40);
});

async function officer(page){
 await dispatch(page);
 return page.evaluate(async()=>{const g=__game,ai=g.pursuers,{gameState}=await import('/src/core/GameState.js');g.police.reset();ai.reset();teleportJimothy(-6,-6);const j=g.jimothy.position,id=spawnPursuerAt('police',j.x,j.z-5),p=ai.all.find(p=>p.id===id);p.group.position.y=ai._groundY(p.group.position.x,p.group.position.z);p.group.rotation.y=0;p.sees=true;p.state='chase';p.grounding.reset();gameState.capture.phase='idle';gameState.heat.tier=4;g.jimothy.hitCooldown=0;window.actor=p;
  if(!g.voxels.hasLineOfSight(p.group.position.x,p.group.position.y+1.8,p.group.position.z,j.x,j.y,j.z))throw Error('Gun fixture requires open sight');
  window.gunTick=(dt=1/60)=>{p.sees=true;ai._animate(p,dt,p.group.position.x,p.group.position.z);p.responsePose.apply(dt,p.fire.target||j);ai.response.gun(p,dt);ai.response.update(dt);};return id;
 });
}

test('an aimed shot has a readable two-hand grip, launches small Jimothy, then permits recovery',async({page})=>{
 await officer(page);
 const r=await page.evaluate(async()=>{const g=__game,ai=g.pursuers,p=actor,{POLICE:C}=await import('/src/core/Constants.js'),before=JSON.parse(render_game_to_text()).heat.points;let windup=null;
  for(let i=0;i<120&&!ai.response.gunHits;i++){gunTick();if(p.fire.phase==='aim'&&!windup){const left=p.visual.getObjectByName('hand_l').getWorldPosition(g.jimothy.position.clone()),grip=p.gun.localToWorld(left.clone().fromArray(C.GUN_LEFT));windup={gap:left.distanceTo(grip),cap:!!p.cap,shots:ai.response.gunShots,held:p.gun.parent.name};}}
  const s=JSON.parse(render_game_to_text());ai.update=()=>{};return{windup,hits:ai.response.gunHits,shots:ai.response.gunShots,dynamic:g.jimothy.body.type===1,vy:g.jimothy.body.velocity.y,before,after:s.heat.points,playing:s.game.isPlaying};
 });expect(r.windup.held).toBe('hand_r');expect(r.windup.cap).toBe(true);expect(r.windup.gap).toBeLessThan(.08);expect(r.windup.shots).toBe(0);expect(r.hits).toBe(1);expect(r.dynamic).toBe(true);expect(r.vy).toBeGreaterThan(0);expect(r.after).toBe(r.before);expect(r.playing).toBe(true);
 await adv(page,5);expect(await page.evaluate(()=>__game.jimothy.body.type)).toBe(4);expect((await state(page)).game.netted).toBe(false);
});

test('a committed shot misses a sideways dodge; net, shield, riding, collection and ragdoll cancel windup',async({page})=>{
 await officer(page);
 const r=await page.evaluate(async()=>{const g=__game,p=actor,ai=g.pursuers,{gameState}=await import('/src/core/GameState.js'),{eventBus,Events}=await import('/src/core/EventBus.js');
  for(let i=0;i<120&&p.fire.phase!=='aim';i++)gunTick();if(p.fire.phase!=='aim')throw Error('Officer failed to start an aimed shot');const locked={...p.fire.target};g.jimothy.body.position.x+=3;for(let i=0;i<100;i++)gunTick();const dodge={hits:ai.response.gunHits,shots:ai.response.gunShots,locked};g.jimothy.body.position.x-=3;
  const starts=[],ends=[];const start=()=>{p.fire.phase='idle';p.fire.time=0;p.fire.target=null;p.responsePose.raised=1;p.sees=true;ai.response.gun(p,.1);starts.push(p.fire.phase);};
  start();gameState.capture.phase='windup';ai.response.gun(p,.1);ends.push(p.fire.phase);gameState.capture.phase='idle';
  start();gameState.tools.shield=1;ai.response.gun(p,.1);ends.push(p.fire.phase);gameState.tools.shield=0;
  start();gameState.vehicle.phase='driving';ai.response.gun(p,.1);ends.push(p.fire.phase);gameState.vehicle.phase='onFoot';
  start();eventBus.emit(Events.HUMAN_DOWN,{id:`pursuer-${p.id}`,active:true});ends.push(p.fire.phase);p.ragdoll=false;
  start();eventBus.emit(Events.ENTITY_ATTACH,{id:`pursuer-${p.id}`});ends.push(p.fire.phase);p.attached=false;
  setFatness(250);g.jimothy.move={kind:'roll',elapsed:0};g.jimothy.hitCooldown=0;eventBus.emit(Events.PLAYER_HIT,{source:'police',velocity:[0,3.5,7]});return{dodge,starts,ends,move:g.jimothy.move?.kind,physical:g.jimothy.ragdoll.physical};
 });expect(r.dodge.shots).toBe(1);expect(r.dodge.hits).toBe(0);expect(r.starts).toEqual(Array(5).fill('aim'));expect(r.ends).toEqual(Array(5).fill('recover'));expect(r.move).toBe('roll');expect(r.physical).toBe(false);
});

test('a real voxel wall intercepts an already-fired shot',async({page})=>{
 await officer(page);
 const r=await page.evaluate(async()=>{const g=__game,ai=g.pursuers,{VOXEL}=await import('/src/core/Constants.js');for(let i=0;i<120&&!ai.response.bullets.length;i++)gunTick();if(!ai.response.bullets.length)throw Error('Officer failed to fire');const b=ai.response.bullets[0],from=b.mesh.position.clone(),j=g.jimothy.position,mid=from.clone().lerp(j,.5),s=VOXEL.SIZE;
  for(let x=Math.floor((mid.x-.8)/s);x<=Math.ceil((mid.x+.8)/s);x++)for(let y=Math.floor((mid.y-.8)/s);y<=Math.ceil((mid.y+.8)/s);y++)g.voxels.setEdit(x,y,Math.floor(mid.z/s),6);
  const before=ai.response.gunHits;let particles=0;for(let i=0;i<20;i++){ai.response.update(1/60);particles=Math.max(particles,ai.response.particles.length);}return{before,after:ai.response.gunHits,bullets:ai.response.bullets.length,blocks:ai.response.gunBlocks,particles};
 });expect(r.after).toBe(r.before);expect(r.bullets).toBe(0);expect(r.particles).toBeGreaterThan(0);expect(r.blocks).toBe(1);
});

test('patrol dismount uses one grounded human owner and a stolen police car makes a broad water splash',async({page})=>{
 await dispatch(page);
 const r=await page.evaluate(async()=>{const g=__game,u=g.police.units[0],p=u.car,d=g.driving,driver=d.drivers.get(p.id)?.id;if(!driver)throw Error('Missing patrol driver');p.driving=false;p.route.speed=0;
  if(!g.police.dismount(u))throw Error('Patrol has no safe exit');const human=g.pursuers.all.find(p=>`pursuer-${p.id}`===driver),ground=g.pursuers._groundY(human.group.position.x,human.group.position.z,human.group.position.y),released={attached:human.attached,seat:human.vehicleSeat,driver:d.drivers.has(p.id),groundError:Math.abs(human.group.position.y-ground)};
  const at=d.exitPoint(p,g.jimothy.radius);teleportJimothy(at.x,at.z);if(!d.enter(p))throw Error('Patrol hijack failed');for(let i=0;i<90;i++)d.update(1/60);
  const w=g.water,body=g.physics.props.get(p.id).body,stream=g.streetLife.update;g.streetLife.update=()=>{};g.voxels.streamAround(-850,0);p.yaw=0;p.mesh.rotation.set(0,0,0);p.grounding={pitch:0,bank:0};p.mesh.position.set(-850,w.heightAt(-850,0)+p.half[1]-.3,0);d.playerPose();w.reset();w.update(0);d.speed=14;d.update(1/60);const velocity=body.velocity.z;advanceTime(.15);g.streetLife.update=stream;
  return{released,velocity,phase:d.phase,splash:w.drops.length,rings:w.snapshot().foamRings,type:body.type,police:g.police.units.length};
 });expect(r.released).toMatchObject({attached:false,seat:null,driver:false});expect(r.released.groundError).toBeLessThan(.05);expect(r.velocity).toBeGreaterThan(12);expect(r.phase).toBe('onFoot');expect(r.splash).toBeGreaterThanOrEqual(24);expect(r.rings).toBeGreaterThan(0);expect(r.type).toBe(1);expect(r.police).toBe(0);
});

test('parked police variants survive streaming; active patrol seats and far officers cannot accumulate',async({page})=>{
 await dispatch(page);
 const r=await page.evaluate(()=>{const g=__game,u=g.police.units[0],p=u.car,id=p.id,at=p.mesh.position.clone();if(!g.police.dismount(u))throw Error('No safe patrol dismount');p.driving=false;teleportJimothy(200,200);g.streetLife.populate();g.pursuers.update(0);const away={driver:g.driving.drivers.has(id),officers:g.pursuers.police.length,car:g.streetLife.items.some(q=>q.id===id)};teleportJimothy(at.x,at.z);g.streetLife.populate();const restored=g.streetLife.items.find(q=>q.id===id);return{away,restored:!!restored,model:restored?.model,driving:restored?.driving,windows:restored?.mesh.children.filter(m=>m.userData.glassPane!==undefined).length};
 });expect(r.away).toEqual({driver:false,officers:0,car:false});expect(r.restored).toBe(true);expect(r.model).toBe('police');expect(r.driving).toBe(false);expect(r.windows).toBeGreaterThan(0);
});

test('police siren and gun produce audio samples, stay bounded, and silence on reset',async({page})=>{
 await dispatch(page);await page.keyboard.press('h');await page.waitForFunction(()=>__game.police.audio?.currentTime>.1&&__game.pursuers.response.audio?.currentTime>.1);
 await page.evaluate(()=>{const g=__game;g.police.sound();g.pursuers.response.cue('gun',g.jimothy.position);});
 let siren=0,gun=0;await expect.poll(async()=>{const s=await state(page);siren=Math.max(siren,s.police.rms);gun=Math.max(gun,s.response.rms);return Math.min(siren,gun);},{timeout:1500,intervals:[20]}).toBeGreaterThan(.00001);let s=await state(page);expect(s.response.voices).toBeLessThanOrEqual(4);console.log('POLICE_AUDIO',JSON.stringify({siren,gun}));
 await page.evaluate(()=>restartGame());await page.waitForTimeout(80);s=await state(page);expect(s.police.rms).toBeLessThan(.00001);expect(s.response.voices).toBe(0);
});

test('a patrol that sees Jimothy stops and dismounts; its officer resumes ground animation',async({page})=>{
 await dispatch(page);
 const r=await page.evaluate(()=>{const g=__game,u=g.police.units[0],p=u.car,id=g.driving.drivers.get(p.id)?.id,dir=p.route.road.dir;teleportJimothy(p.mesh.position.x+dir.x*8,p.mesh.position.z+dir.z*8);const visible=g.police.canSee(u);g.police.update(1/60);const actor=g.pursuers.police.find(p=>`pursuer-${p.id}`===id);g.pursuers._animate(actor,.1,actor.group.position.x,actor.group.position.z);return{visible,parked:u.parked,driving:p.driving,speed:p.route.speed,attached:actor.attached,seat:actor.vehicleSeat,animation:actor.animation,actionRunning:actor.actions[actor.animation].isRunning(),driver:g.driving.drivers.has(p.id),bodyActive:g.physics.actors.get(id).active};
 });expect(r).toMatchObject({visible:true,parked:true,driving:false,speed:0,attached:false,seat:null,animation:'Idle',actionRunning:true,driver:false,bodyActive:true});
});

test('the combined four-star response still lets animal control finish a stationary capture',async({page})=>{
 await dispatch(page);let s=await state(page);for(let i=0;i<30&&!s.game.netted;i++){await adv(page,1);s=await state(page);}expect(s.game.netted).toBe(true);expect(s.game.isPlaying).toBe(false);expect(s.response.gunHits).toBeLessThan(12);
});

test('the sourced police car crosses the steep road both ways at 30/60/120 Hz after hijacking',async({page})=>{
 await dispatch(page);
 const rows=await page.evaluate(()=>{const g=__game,d=g.driving,p=g.police.units[0].car,s=g.streetLife;g.police.update=()=>{};p.driving=false;p.route.speed=0;const at=d.exitPoint(p,g.jimothy.radius);if(!at)throw Error('No patrol doorway');teleportJimothy(at.x,at.z);if(!d.enter(p))throw Error('Patrol boarding failed');for(let i=0;i<90;i++)d.update(1/60);const original=d.contacts;d.contacts=()=>[];const rows=[];
  for(const hz of [30,60,120])for(const direction of [1,-1]){p.mesh.position.set(67.35,0,direction>0?40:88);p.yaw=direction>0?0:Math.PI;p.mesh.rotation.set(0,p.yaw,0);s.poseVehicle(p);d.lastContact=null;const start=p.mesh.position.clone();let wheelGap=0,maxStep=0;for(let i=0;i<hz*6&&d.car;i++){const oldY=p.mesh.position.y;d.speed=8;d.move(1/hz);wheelGap=Math.max(wheelGap,...p.grounding.wheelGaps.map(Math.abs));maxStep=Math.max(maxStep,Math.abs(p.mesh.position.y-oldY));if(d.speed===0)break;}rows.push({hz,direction,distance:(p.mesh.position.z-start.z)*direction,wheelGap,maxStep,phase:d.phase,contact:d.lastContact,wheels:p.grounding.wheelGaps.length});}d.contacts=original;return rows;
 });console.log('POLICE_GRADE',JSON.stringify(rows));for(const r of rows){expect(r.phase).toBe('driving');expect(r.wheels).toBe(4);expect(r.distance,JSON.stringify(r)).toBeGreaterThan(45);expect(r.wheelGap).toBeLessThan(.2);expect(r.maxStep).toBeLessThan(.45);}
});
