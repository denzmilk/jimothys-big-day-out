import {test,expect} from '@playwright/test';import {boot,state} from './helpers.mjs';
const errors=new WeakMap();test.beforeEach(async({page})=>{const log=[];errors.set(page,log);page.on('pageerror',e=>log.push(String(e)));page.on('console',m=>{if(m.type()==='error')log.push(m.text());});});test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

test('residents and civilians keep ragdoll, carried and swimming ownership through recovery and restart',async({page})=>{
 await boot(page);const rows=await page.evaluate(async()=>{
  const g=__game,{eventBus,Events}=await import('/src/core/EventBus.js'),T=await import('/node_modules/three/build/three.module.js'),rows=[];
  const resident=g.interiors.residents[0];resident.displaced=true;g.interiors.clock=Infinity;
  teleportJimothy(-850,0);g.voxels.processGeneration();g.pedestrians._graphAround(-850,0);g.pedestrians.populationPending=false;
  const civilian=g.pedestrians._spawn({x:-850,z:0,key:'water'},0);
  for(const p of [resident,civilian]){
   const owner=p===resident?g.interiors:g.pedestrians;
   eventBus.emit(Events.ENTITY_ATTACH,{id:p.id});g.jimothy.group.attach(p.mesh);
   const held=p.attached&&!g.physics.actors.get(p.id).active;
   g.scene.attach(p.mesh);p.mesh.quaternion.identity();eventBus.emit(Events.ENTITY_RELEASE,{id:p.id,position:new T.Vector3(-850,-1,0),ground:-10});
   for(let i=0;i<180;i++){g.ragdolls.update(1/60);owner.update(1/60);}
   const start={swimming:p.swimming,head:p.visual.getObjectByName('head').getWorldPosition(new T.Vector3()).y};
   const original=g.ragdolls.people.get(p.id);g.ragdolls.knock(original,{x:p.mesh.position.x-1,z:p.mesh.position.z,radius:1,power:.2});
   const active=g.ragdolls.active.has(p.id);let updates=0,minRecovery=Infinity;
   for(let i=0;i<720;i++){g.physics.update(1/60);g.ragdolls.update(1/60);owner.update(1/60);if(!p.ragdoll){updates++;minRecovery=Math.min(minRecovery,p.mesh.position.y);}}
   rows.push({kind:p===resident?'resident':'civilian',held,start,active,recovered:!p.ragdoll,swimming:p.swimming,head:p.visual.getObjectByName('head').getWorldPosition(new T.Vector3()).y,water:g.water.heightAt(p.mesh.position.x,p.mesh.position.z),minRecovery,updates,activeBodies:g.physics.ragdolls.size,attached:p.attached});
  }
  restartGame();return{rows,after:JSON.parse(render_game_to_text()).ragdolls,constraints:g.physics.world.constraints.length};
 });console.log('HUMAN_WATER_OWNERS',JSON.stringify(rows));for(const r of rows.rows){expect(r.held).toBe(true);expect(r.start.swimming).toBe(true);expect(r.active).toBe(true);expect(r.recovered).toBe(true);expect(r.swimming).toBe(true);expect(r.minRecovery).toBeGreaterThan(-2);expect(r.head-r.water).toBeGreaterThan(.05);expect(r.updates).toBeGreaterThan(0);expect(r.activeBodies).toBe(0);expect(r.attached).toBe(false);}expect(rows.after.count).toBe(0);expect(rows.constraints).toBe(0);
});

test('actual civilian and patrol seats eject one swimming driver each',async({page})=>{
 await boot(page);await page.waitForFunction(()=>__game.police.ready);
 const rows=await page.evaluate(async()=>{
  const g=__game,d=g.driving,T=await import('/node_modules/three/build/three.module.js'),{gameState}=await import('/src/core/GameState.js');gameState.heat.tier=4;g.police.update(1);d.syncDrivers();
  const cars=[...d.cars.values()].filter(c=>d.drivers.has(c.id));const chosen=[cars.find(c=>c.responseRole!=='police'),cars.find(c=>c.responseRole==='police')];if(chosen.some(c=>!c))throw Error('Both real driver roles required');
  teleportJimothy(-850,0);g.voxels.processGeneration();const rows=[];
  for(const [i,c] of chosen.entries()){
   const seated=d.drivers.get(c.id),id=seated.id;const p=i?g.pursuers.police.find(p=>`pursuer-${p.id}`===id):g.pedestrians.people.find(p=>p.id===id);
   c.mesh.position.set(-850,0,i*5);c.mesh.quaternion.identity();c.yaw=0;c.loose=true;d.poseDriver(seated,c);d.syncDrivers();
   for(let n=0;n<360;n++)(i?g.pursuers:g.pedestrians).update(1/60);
   const mesh=p.group||p.mesh,head=p.visual.getObjectByName('head').getWorldPosition(new T.Vector3());rows.push({id,role:i?'police':'civilian',swimming:p.swimming,attached:p.attached,seat:!!p.vehicleSeat,owned:d.drivers.has(c.id),head:head.y,water:g.water.heightAt(head.x,head.z),y:mesh.position.y});
  }return rows;
 });console.log('HUMAN_WATER_DRIVERS',JSON.stringify(rows));for(const r of rows){expect(r.swimming,r.role).toBe(true);expect(r.attached).toBe(false);expect(r.seat).toBe(false);expect(r.owned).toBe(false);expect(r.head-r.water).toBeGreaterThan(.05);expect(r.y).toBeGreaterThan(-2);}
});

test('swimming interrupts coffee and five-star attacks while finite perception and cleanup remain active',async({page})=>{
 await boot(page);await page.waitForFunction(()=>__game.pursuers.response.infantryReady);
 const r=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,ai=g.pursuers,{gameState}=await import('/src/core/GameState.js');gameState.player.hidden=true;s.activities.enabled=false;
  const p=s.people.find(p=>s.activities.canStart(p,'coffee'));if(!s.activities.start(p,'coffee'))throw Error('Coffee must start');
  teleportJimothy(-850,0);p.x=-850;p.y=-1;p.z=0;p.mesh.position.set(p.x,p.y,p.z);s.update(1/60);const activity={stopped:!p.activity,dropped:s.activities.dropped.length,swimming:p.swimming};
  ai.reset();gameState.heat.tier=5;gameState.capture.progress=.3;gameState.player.hidden=false;
  for(const [i,type] of ['paparazzo','angry-local','animal-control','police','infantry'].entries()){const id=spawnPursuerAt(type,-850+i*.1,1),q=ai.all.find(q=>q.id===id);q.group.position.y=-1;q.group.rotation.y=Math.PI;q.sees=true;q.state='chase';q.lastKnown={x:-850,y:0,z:0};}
  const originals=ai.all.slice();g.jimothy.body.position.set(-850,0,0);g.jimothy.postUpdate(0);
  for(let n=0;n<360;n++)ai.update(1/60);const fighting=ai.response.snapshot(),allSwim=originals.every(p=>p.swimming),bar=gameState.capture.progress;
  gameState.player.hidden=true;g.jimothy.body.position.set(-1000,0,0);g.jimothy.postUpdate(0);for(let n=0;n<2400;n++)ai.update(1/60);
  const seen=originals.map(p=>({type:p.type,sees:p.sees,state:p.state})),count=ai.all.length;restartGame();return{activity,fighting,allSwim,bar,seen,count,after:ai.all.length,playing:gameState.game.isPlaying};
 });console.log('HUMAN_WATER_ATTACKS',JSON.stringify(r));expect(r.activity.stopped).toBe(true);expect(r.activity.dropped).toBeGreaterThan(0);expect(r.activity.swimming).toBe(true);expect(r.allSwim).toBe(true);expect(r.fighting.gunShots+r.fighting.photos+r.fighting.kicks).toBe(0);expect(r.bar).toBe(0);expect(r.seen.every(p=>!p.sees&&p.state!=='chase')).toBe(true);expect(r.count).toBeLessThanOrEqual(14);expect(r.after).toBe(0);expect(r.playing).toBe(true);
});

test('swimmers route around a submerged wall without pushing their heads through it',async({page})=>{
 await boot(page);const rows=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,T=await import('/node_modules/three/build/three.module.js'),rows=[],v=.22;
  teleportJimothy(-850,0);g.voxels.processGeneration();for(const p of [...s.people])s._remove(p);s._graphAround(-850,0);s.populationPending=false;
  for(let y=Math.floor(-5/v);y<=Math.ceil(2/v);y++)for(let z=Math.floor(-2/v);z<=Math.ceil(2/v);z++)g.voxels.setEdit(Math.floor(-848/v),y,z,6);
  for(const hz of [30,60,120]){
   const p=s._spawn({x:-851,z:0,key:'wall'},0);p.y=-1;p.mesh.position.set(p.x,p.y,p.z);p.mesh.rotation.y=Math.PI/2;let hits=0;
   for(let i=0;i<hz*20;i++){s.update(1/hz);for(const name of ['head','spine_03','pelvis']){const at=p.visual.getObjectByName(name).getWorldPosition(new T.Vector3());if(g.voxels.physicalSolidAtWorld(at.x,at.y,at.z))hits++;}}
   rows.push({hz,hits,x:p.x,z:p.z,swimming:p.swimming});s._remove(p);
  }return rows;
 });console.log('HUMAN_SWIM_WALL',JSON.stringify(rows));for(const r of rows){expect(r.hits).toBe(0);expect(r.x).toBeGreaterThan(-846);expect(r.swimming).toBe(true);}
});

test('a full civilian population swims with bounded proxies and reset counts',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,{PEDESTRIANS}=await import('/src/core/Constants.js'),times=[],resets=[];
  teleportJimothy(-850,0);g.voxels.processGeneration();for(const p of [...s.people])s._remove(p);s._graphAround(-850,0);s.populationPending=false;
  for(let i=0;i<PEDESTRIANS.COUNT;i++){const p=s._spawn({x:-850+i%6*2,z:Math.floor(i/6)*2,key:'stress'},i);p.y=-1;p.mesh.position.set(p.x,p.y,p.z);}
  for(let i=0;i<600;i++){const t=performance.now();s.update(1/60);times.push(performance.now()-t);g.physics.update(1/60);}
  const all=s.people.every(p=>p.swimming&&p.mesh.matrixWorld.elements.every(Number.isFinite)),count=s.people.length,old=s.people.map(p=>p.mesh);s.reset();const oldMeshes=old.some(mesh=>mesh.parent);
  for(let i=0;i<3;i++){restartGame();advanceTime(.2);resets.push({people:s.people.length,actors:g.physics.actors.size,bodies:g.physics.world.bodies.length,constraints:g.physics.world.constraints.length});}
  times.sort((a,b)=>a-b);return{all,count,cap:PEDESTRIANS.COUNT,oldMeshes,median:times[300],p95:times[570],p99:times[594],max:times.at(-1),resets};
 });console.log('HUMAN_SWIM_CAPACITY',JSON.stringify(result));expect(result.all).toBe(true);expect(result.count).toBe(result.cap);expect(result.oldMeshes).toBe(false);expect(result.resets[1]).toEqual(result.resets[2]);expect(result.resets[2].constraints).toBe(0);
});
