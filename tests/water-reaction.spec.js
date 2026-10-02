import {test,expect} from '@playwright/test';import {boot,adv,state} from './helpers.mjs';

async function sea(page){await boot(page);await page.evaluate(()=>{teleportJimothy(-850,0);advanceTime(2);__game.water.reset();});}
test('Jimothy makes larger surface reactions at giant size with matching rendered water',async({page})=>{
 await sea(page);
 const out=await page.evaluate(()=>{
  const g=__game,j=g.jimothy,w=g.water,result=[];
  for(const fat of [0,250,400]){
   setFatness(fat);w.reset();j.body.position.set(-850,2+j.radius,0);j.vel.set(5,0,0);j.vy=-12;
   w.update(1/60);w.afterUpdate(1/60);j.body.position.y=-j.radius*.1;w.update(1/60);w.afterUpdate(1/60);
   w.syncSurface();const s=w.snapshot();result.push({...s,error:Math.abs(w.heightAt(-846,0)-w.renderHeightAt(-846,0)),maxDrop:Math.max(0,...w.drops.map(p=>p.scale||1))});
  }return result;
 });console.log(JSON.stringify(out));
 expect(out[2].rippleSpan).toBeGreaterThan(200);expect(out[2].lastReaction.radius).toBeGreaterThan(out[0].lastReaction.radius*20);
 expect(out[2].maxDrop).toBeGreaterThan(out[0].maxDrop*3);for(const r of out){expect(r.foamRings).toBeGreaterThan(0);expect(r.error).toBeLessThan(.002);}
});
test('actual falling bodies send footprint and entry speed into water',async({page})=>{
 await sea(page);
 const out=await page.evaluate(async()=>{
  const g=__game,{eventBus,Events}=await import('/src/core/EventBus.js'),result=[];
  for(const half of [[.2,.2,.2],[1,1,2]]){
   const mesh=new g.jimothy.group.constructor();mesh.position.set(-843,5+half[1],0);g.scene.add(mesh);
   eventBus.emit(Events.PROP_CREATE,{id:'water-drop',mesh,mass:half[0]*100,half,loose:true});
   let entry=null;const off=eventBus.on(Events.WATER_DISTURB,q=>{if(q.entering&&!entry)entry={...q};});
   for(let i=0;i<120&&!entry;i++)advanceTime(1/60);off();result.push(entry);eventBus.emit(Events.PROP_REMOVE,{id:'water-drop'});mesh.removeFromParent();
  }return result;
 });expect(out[0]).not.toBeNull();expect(out[1]).not.toBeNull();expect(out[1].radius).toBeGreaterThan(out[0].radius*4);expect(out[0].verticalSpeed).toBeLessThan(-2);
});
test('submerged motion and dry impacts do not splash the surface',async({page})=>{
 await sea(page);
 const out=await page.evaluate(async()=>{
  const g=__game,w=g.water,{eventBus,Events}=await import('/src/core/EventBus.js');
  w.reset();eventBus.emit(Events.WATER_DISTURB,{id:'deep',x:-850,z:0,radius:1,halfHeight:1,fraction:1,entering:false,speed:8,verticalSpeed:-8});
  eventBus.emit(Events.WORLD_IMPACT,{x:0,y:50,z:0,radius:2});return w.snapshot();
 });expect(out.splashes).toBe(0);expect(out.ripples).toBe(0);expect(out.foamRings).toBe(0);
});
test('water effects stay bounded, expire and reuse buffers on restart',async({page})=>{
 await sea(page);const out=await page.evaluate(async()=>{
  const w=__game.water,{eventBus,Events}=await import('/src/core/EventBus.js'),texture=w.rippleTexture,geometry=w.splashMesh.geometry;
  for(let i=0;i<400;i++)eventBus.emit(Events.WATER_DISTURB,{id:i,x:-850+i%5,z:i%3,radius:4,halfHeight:2,fraction:.5,entering:true,speed:8,verticalSpeed:-10});
  const peak=w.snapshot();restartGame();return{peak,reset:w.snapshot(),reused:texture===w.rippleTexture&&geometry===w.splashMesh.geometry};
 });expect(out.peak.foamRings).toBeGreaterThan(0);expect(out.peak.foamRings).toBeLessThanOrEqual(32);expect(out.peak.splashes).toBeLessThanOrEqual(96);expect(out.reset.foamRings).toBe(0);expect(out.reset.splashes).toBe(0);expect(out.reset.ripples).toBe(0);expect(out.reused).toBe(true);
});

test('one falling Jimothy produces one entry burst, then quiet water at rest',async({page})=>{
 await sea(page);const out=await page.evaluate(()=>{
  const g=__game,w=g.water;setFatness(250);dropJimothy(-850,100,g.jimothy.radius+8);w.reset();
  let entries=0;const react=w.react.bind(w);w.react=q=>{const ok=react(q);if(ok&&q.kind==='jimothy'&&q.entering)entries++;return ok;};
  advanceTime(4);const hit=w.snapshot();advanceTime(22);return{entries,hit,rest:w.snapshot()};
 });expect(out.entries).toBe(1);expect(out.hit.lastReaction.entering).toBe(true);expect(out.rest.foamRings).toBe(0);expect(out.rest.splashes).toBe(0);expect(out.rest.ripples).toBe(0);
});

test('imported cars, MPFB ragdolls and pooled rubble all disturb water on entry',async({page})=>{
 await boot(page);const out=await page.evaluate(async()=>{
  const g=__game,{eventBus,Events}=await import('/src/core/EventBus.js');
  g.streetLife.update=()=>{};g.pedestrians.update=()=>{};g.interiors.update=()=>{};
  const person=g.ragdolls.people.get(g.pedestrians.people[0].id);person.group.position.set(-841,5,7);person.group.updateMatrixWorld(true);
  g.ragdolls.knock(person,{x:-842,z:7,radius:1});
  const rag=g.ragdolls.active.get(person.id);for(const b of rag.physics.bodies)b.velocity.set(0,-3,0);
  const car=g.streetLife.items.find(p=>p.kind==='car'),body=g.physics.props.get(car.id).body;
  eventBus.emit(Events.PROP_IMPULSE,{id:car.id,velocity:[0,-3,0],spin:0});body.position.set(-841,6,-7);g.physics.resetSweep(body);
  g.debris.spawnBurst([{x:-841,y:4,z:0,mat:3}]);const rubble=g.debris.slots.find(s=>s.alive).body;rubble.velocity.set(0,-3,0);
  const ids=new Map([[body.id,'car'],[rubble.id,'rubble'],...rag.physics.bodies.map(b=>[b.id,'ragdoll'])]),seen=new Set();
  const off=eventBus.on(Events.WATER_DISTURB,q=>{if(q.entering&&ids.has(q.id))seen.add(ids.get(q.id));});
  teleportJimothy(-850,0);advanceTime(2.5);off();return{seen:[...seen],water:g.water.snapshot()};
 });expect(out.seen.sort()).toEqual(['car','ragdoll','rubble']);expect(out.water.foamRings).toBeGreaterThan(0);
});
test('surface swimming leaves wakes and submerged swimming stops emitting them',async({page})=>{
 await sea(page);await page.evaluate(()=>faceJimothy(0));await page.keyboard.down('w');await adv(page,1);await page.keyboard.up('w');
 const moving=(await state(page)).water;expect(moving.foamRings).toBeGreaterThan(0);expect(moving.lastReaction.entering).toBe(false);expect(moving.ripples).toBeGreaterThan(0);expect(moving.splashes).toBeGreaterThan(0);
 await page.keyboard.down('q');await adv(page,2);await page.keyboard.up('q');await adv(page,6);
 const deep=(await state(page)).water;expect(deep.diving).toBe(true);expect(deep.foamRings).toBe(0);expect(deep.splashes).toBe(0);
});
