import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

async function setup(page){
 await boot(page);
 expect(await page.evaluate(()=>!!__game.pedestrians.activities)).toBe(true);
 await page.evaluate(async()=>{const {gameState}=await import('/src/core/GameState.js');gameState.player.hidden=true;__game.pedestrians.activities.enabled=false;});
}

test('street routines appear naturally with variety and bounded performers',async({page})=>{
 await setup(page);
 const result=await page.evaluate(()=>{
  const g=__game,s=g.pedestrians,a=s.activities;a.enabled=true;const seen=new Set(),last=new Map();let max=0,repeats=0;
  for(let n=0;n<1800;n++){
   s.update(.05);g.environmentLife.update(.05);
   let active=0;for(const p of s.people){const act=p.activity;if(act&&act.phase!=='approach'){active++;seen.add(act.kind);if(last.get(p.id)?.serial!==act.serial){if(last.get(p.id)?.kind===act.kind)repeats++;last.set(p.id,{serial:act.serial,kind:act.kind});}}}max=Math.max(max,active);
  }
  return {catalog:a.catalog.map(d=>d.id),seen:[...seen],max,repeats,count:s.people.length,snapshot:JSON.parse(render_game_to_text()).people.activities};
 });
 expect(result.catalog).toEqual(expect.arrayContaining(['phone','coffee','bird-chase','cartwheel','meditate','float','moonwalk','piggyback','air-guitar','robot','stretch','selfie']));
 expect(result.seen.length).toBeGreaterThanOrEqual(8);expect(result.max).toBeLessThanOrEqual(12);expect(result.max).toBeGreaterThanOrEqual(4);expect(result.repeats).toBe(0);expect(result.count).toBe(36);expect(result.snapshot).toBeDefined();
});

test('held props follow posed hands and standing habits retain planted feet',async({page})=>{
 await setup(page);
 const result=await page.evaluate(()=>{
  const s=__game.pedestrians,a=s.activities,reports=[];
  for(const kind of ['phone','coffee','selfie','air-guitar','robot','stretch']){
   const p=s.people.find(p=>a.canStart(p,kind));if(!p){reports.push({kind,started:false});continue;}
   const initial=p.visual.getObjectByName('hand_r').getWorldPosition(p.mesh.position.clone());a.start(p,kind);
   for(let n=0;n<90;n++)s.update(1/60);
   const hand=p.visual.getObjectByName('hand_r').getWorldPosition(p.mesh.position.clone());
   reports.push({kind,started:p.activity?.kind===kind,moved:hand.distanceTo(initial),feet:p.grounding.contacts.map(f=>Math.abs(f.error)),prop:p.activity?.prop?.kind,gripGap:p.activity?.prop?.mesh.getWorldPosition(p.mesh.position.clone()).distanceTo(hand)});
   a.stop(p,'finished');
  }return reports;
 });
 for(const r of result){expect(r.started,JSON.stringify(r)).toBe(true);expect(r.moved).toBeGreaterThan(.15);expect(r.feet).toHaveLength(2);expect(Math.max(...r.feet)).toBeLessThan(.16);if(['phone','coffee','selfie'].includes(r.kind)){expect(r.prop).toBe(r.kind==='coffee'?'coffee':'phone');expect(r.gripGap).toBeLessThan(.22);}}
});

test('cartwheels invert, meditation sits, levitation rises and all recover upright',async({page})=>{
 await setup(page);
 const result=await page.evaluate(()=>{
  const s=__game.pedestrians,a=s.activities,reports=[];
  for(const kind of ['cartwheel','meditate','float']){
   const p=s.people.find(p=>a.canStart(p,kind));if(!p){reports.push({kind,started:false});continue;}
   const pelvis=p.visual.getObjectByName('pelvis'),up=p.mesh.position.clone().set(0,1,0),base=pelvis.getWorldPosition(p.mesh.position.clone()).y;
   a.start(p,kind);let minUp=1,low=0,high=0,finite=true;
   for(let n=0;n<180;n++){s.update(1/60);const q=p.visual.getWorldQuaternion(p.mesh.quaternion.clone()),v=up.clone().applyQuaternion(q);minUp=Math.min(minUp,v.y);const dy=pelvis.getWorldPosition(p.mesh.position.clone()).y-base;low=Math.min(low,dy);high=Math.max(high,dy);finite&&=p.mesh.position.toArray().every(Number.isFinite);}
   a.stop(p,'finished');s.update(1/60);reports.push({kind,started:true,minUp,low,high,finite,upright:up.clone().applyQuaternion(p.visual.quaternion).y});
  }return reports;
 });
 for(const r of result){expect(r.started).toBe(true);expect(r.finite).toBe(true);expect(r.upright).toBeGreaterThan(.99);if(r.kind==='cartwheel')expect(r.minUp).toBeLessThan(-.8);if(r.kind==='meditate')expect(r.low).toBeLessThan(-.4);if(r.kind==='float')expect(r.high).toBeGreaterThan(.25);}
});

test('moonwalking moves backwards along safe pavement and stops at a blocked route',async({page})=>{
 await setup(page);
 const result=await page.evaluate(()=>{
  const s=__game.pedestrians,a=s.activities,p=s.people.find(p=>a.canStart(p,'moonwalk'));if(!p)return {started:false};
  a.start(p,'moonwalk');const from=p.mesh.position.clone();for(let n=0;n<120;n++)s.update(1/60);
  const delta=p.mesh.position.clone().sub(from),facing=p.mesh.position.clone().set(Math.sin(p.mesh.rotation.y),0,Math.cos(p.mesh.rotation.y));
  const backwards=delta.dot(facing),distance=delta.length();const clear=s._clear;s._clear=()=>false;for(let n=0;n<120;n++)s.update(1/60);s._clear=clear;
  return {started:true,backwards,distance,stopped:!p.activity,finite:p.mesh.position.toArray().every(Number.isFinite)};
 });expect(result.started).toBe(true);expect(result.distance).toBeGreaterThan(.5);expect(result.backwards).toBeLessThan(-.5);expect(result.stopped).toBe(true);expect(result.finite).toBe(true);
});

test('piggyback pairs existing people, mounts, travels, dismounts and cancels both on collection',async({page})=>{
 await setup(page);
 const result=await page.evaluate(async()=>{
  const s=__game.pedestrians,a=s.activities,p=s.people.find(p=>a.canStart(p,'piggyback'));if(!p)return {started:false};
  const count=s.people.length;a.start(p,'piggyback');const other=s.people.find(q=>q.id===p.activity.partner),start=p.mesh.position.clone();let mounted=false,maxHeight=0;
  for(let n=0;n<600;n++){s.update(1/60);if(p.activity?.phase==='perform'){mounted=true;maxHeight=Math.max(maxHeight,other.mesh.position.y-p.mesh.position.y);}if(mounted&&!p.activity)break;}
  const normalEnd=!p.activity&&!other.activity,travel=p.mesh.position.distanceTo(start);
  p.activityWait=0;other.activityWait=0;const again=a.start(p,'piggyback',{partner:other});const {eventBus,Events}=await import('/src/core/EventBus.js');eventBus.emit(Events.ENTITY_ATTACH,{id:p.id});
  return {started:true,count:s.people.length,original:count,mounted,maxHeight,normalEnd,travel,again,bothClear:!p.activity&&!other.activity};
 });expect(result.started).toBe(true);expect(result.count).toBe(result.original);expect(result.mounted).toBe(true);expect(result.maxHeight).toBeGreaterThan(.3);expect(result.normalEnd).toBe(true);expect(result.travel).toBeGreaterThan(.25);expect(result.again).toBe(true);expect(result.bothClear).toBe(true);
});

test('bird chasing targets real wildlife and startles it away',async({page})=>{
 await setup(page);
 const result=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,a=s.activities,p=s.people.find(p=>a.canStart(p,'phone')),bird=g.environmentLife.animals.find(a=>a.bird);
  if(!p||!bird)return {started:false};const node=s.graph.get(p.node),next=s.graph.get(node.links[0]);bird.mesh.position.set(next.x,p.y+2,next.z);bird.flee=0;
  const started=a.start(p,'bird-chase'),target=p.activity?.bird,from=p.mesh.position.clone();
  for(let n=0;n<90;n++){s.update(1/60);g.environmentLife.update(1/60);}
  return {started,target,expected:bird.id,travel:p.mesh.position.distanceTo(from),reacted:bird.startledBy===p.id};
 });expect(result.started).toBe(true);expect(result.target).toBe(result.expected);expect(result.travel).toBeGreaterThan(.1);expect(result.reacted).toBe(true);
});

test('scares and ragdolls cancel routines, drop physical props, and restart removes activity bodies',async({page})=>{
 await setup(page);
 const result=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,a=s.activities,{eventBus,Events}=await import('/src/core/EventBus.js'),{gameState}=await import('/src/core/GameState.js');
  const p=s.people.find(p=>a.canStart(p,'coffee'));a.start(p,'coffee');for(let n=0;n<60;n++)s.update(1/60);
  eventBus.emit(Events.HUMAN_IMPACT,{id:p.id,x:p.x-1,y:p.y,z:p.z,radius:1.5});
  const cancelled=!p.activity,ragdoll=!!p.ragdoll,dropped=a.dropped.map(d=>({id:d.id,dynamic:g.physics.props.get(d.id)?.body.type===1}));
  const q=s.people.find(p=>!p.ragdoll&&a.canStart(p,'float'));a.start(q,'float');gameState.player.hidden=false;g.jimothy.body.position.set(q.x,q.y+g.jimothy.radius,q.z);s.update(.1);const scared=!q.activity&&q.flee>0;
  restartGame();return {cancelled,ragdoll,dropped,scared,props:a.dropped.length,active:s.people.filter(p=>p.activity).length,bodies:[...g.physics.props.keys()].filter(k=>k.startsWith('activity-prop:')).length,count:s.people.length};
 });expect(result.cancelled).toBe(true);expect(result.ragdoll).toBe(true);expect(result.dropped.length).toBeGreaterThan(0);expect(result.dropped.every(p=>p.dynamic)).toBe(true);expect(result.scared).toBe(true);expect(result.props).toBe(0);expect(result.active).toBe(0);expect(result.bodies).toBe(0);expect(result.count).toBe(36);
});

test('phone reaches the ear, coffee reaches the mouth, and piggyback hands reach the carrier',async({page})=>{
 await setup(page);const result=await page.evaluate(()=>{
  const s=__game.pedestrians,a=s.activities,out={};
  for(const kind of ['phone','coffee']){
   const p=s.people.find(p=>a.canStart(p,kind));a.start(p,kind);for(let n=0;n<115;n++)s.update(1/60);
   const head=p.visual.getObjectByName('head').getWorldPosition(p.mesh.position.clone()),prop=p.activity.prop.mesh.getWorldPosition(p.mesh.position.clone());
   if(kind==='coffee')prop.y+=.085;out[kind]=prop.distanceTo(head);a.stop(p);
  }
  const p=s.people.find(p=>a.canStart(p,'piggyback'));a.start(p,'piggyback');const q=s.people.find(q=>q.id===p.activity.partner);
  for(let n=0;n<600;n++){s.update(1/60);if(p.activity?.phase==='perform'&&p.activity.time>1.5)break;}
  const neck=p.visual.getObjectByName('neck_01').getWorldPosition(p.mesh.position.clone());out.piggyback=['l','r'].map(side=>q.visual.getObjectByName(`hand_${side}`).getWorldPosition(p.mesh.position.clone()).distanceTo(neck));return out;
 });expect(result.phone).toBeLessThan(.19);expect(result.coffee).toBeLessThan(.18);expect(Math.max(...result.piggyback)).toBeLessThan(.4);
});

test('ordinary walkers stop before passing through a performing pedestrian',async({page})=>{
 await setup(page);const result=await page.evaluate(()=>{
  const s=__game.pedestrians,a=s.activities,p=s.people.find(p=>a.canStart(p,'phone'));a.start(p,'phone');
  const q=s.people.find(q=>q!==p&&!q.activity),dir=a.direction(p);if(!dir)return{setup:false};
  q.x=p.x-dir.x*1.5;q.z=p.z-dir.z*1.5;q.y=p.y;q.mesh.position.set(q.x,q.y,q.z);q.mesh.rotation.y=Math.atan2(dir.x,dir.z);q.grounding.reset();q.target={x:p.x+dir.x,z:p.z+dir.z};q.pause=0;q.flee=0;
  let minimum=Infinity;for(let n=0;n<90;n++){s.update(1/60);minimum=Math.min(minimum,Math.hypot(q.x-p.x,q.z-p.z));}return{setup:true,minimum};
 });expect(result.setup).toBe(true);expect(result.minimum).toBeGreaterThan(.5);
});

test('piggyback mounting and dismounting have continuous root movement',async({page})=>{
 await setup(page);const result=await page.evaluate(()=>{
  const s=__game.pedestrians,a=s.activities,p=s.people.find(p=>a.canStart(p,'piggyback'));a.start(p,'piggyback');const q=s.people.find(q=>q.id===p.activity.partner);let last=q.mesh.position.clone(),jump=0,mounted=false;
  for(let n=0;n<900;n++){s.update(1/60);jump=Math.max(jump,q.mesh.position.distanceTo(last));last.copy(q.mesh.position);mounted||=p.activity?.phase==='perform';if(mounted&&!p.activity)break;}return{jump,mounted,ended:!p.activity};
 });expect(result.mounted).toBe(true);expect(result.ended).toBe(true);expect(result.jump).toBeLessThan(.12);
});

test('every MPFB body can hold a drink without losing its planted feet',async({page})=>{
 await setup(page);const reports=await page.evaluate(()=>{
  const s=__game.pedestrians,a=s.activities,spot=s.people.find(p=>a.canStart(p,'coffee')),at={x:spot.x,y:spot.y,z:spot.z},out=[];
  for(const model of new Set(s.people.map(p=>p.model))){
   const p=s.people.find(p=>p.model===model);p.x=at.x;p.y=at.y;p.z=at.z;p.mesh.position.set(p.x,p.y,p.z);p.mesh.rotation.set(0,0,0);p.grounding.reset();a.start(p,'coffee');
   for(let n=0;n<115;n++){a.prepare(p);a.update(p,1/60);}
   const cup=p.activity.prop.mesh.getWorldPosition(p.mesh.position.clone());cup.y+=.085;const head=p.visual.getObjectByName('head').getWorldPosition(p.mesh.position.clone());out.push({model,gap:cup.distanceTo(head),feet:p.grounding.contacts.map(f=>Math.abs(f.error))});a.stop(p);
  }return out;
 });expect(reports).toHaveLength(12);for(const r of reports){expect(r.gap,JSON.stringify(r)).toBeLessThan(.18);expect(r.feet).toHaveLength(2);expect(Math.max(...r.feet),JSON.stringify(r)).toBeLessThan(.16);}
});
