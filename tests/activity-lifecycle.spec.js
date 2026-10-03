import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('dropped activity props stay bounded, can be carried/released and disappear cleanly on restart',async({page})=>{
 await boot(page);const r=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,a=s.activities,{gameState}=await import('/src/core/GameState.js'),{eventBus,Events}=await import('/src/core/EventBus.js');gameState.player.hidden=true;a.enabled=false;
  // Keep the stress fixture inside prop streaming range throughout the run.
  const p=s.people.filter(p=>a.canStart(p,'coffee')).sort((p,q)=>p.mesh.position.distanceToSquared(g.jimothy.position)-q.mesh.position.distanceToSquared(g.jimothy.position))[0];
  const starts=[];for(let n=0;n<15;n++){starts.push(a.start(p,'coffee'));s.update(1);a.stop(p,'fright');const d=a.dropped.at(-1);d.mesh.position.x=p.x+3+n*.1;eventBus.emit(Events.PROP_POSE,{id:d.id,position:d.mesh.position,quaternion:d.mesh.quaternion});}
  const max=a.dropped.length,d=a.dropped[0],id=d.id;eventBus.emit(Events.ENTITY_ATTACH,{id});g.jimothy.group.attach(d.mesh);s.update(20);
  const carried=a.dropped.some(p=>p.id===id)&&!g.physics.props.get(id).active;
  g.scene.attach(d.mesh);const position=p.mesh.position.clone();position.x+=2;eventBus.emit(Events.ENTITY_RELEASE,{id,position});
  const released=g.physics.props.get(id).active&&g.physics.props.get(id).body.type===1&&!d.attached;
  s.reset();return{starts,max,carried,released,count:a.dropped.length,bodies:[...g.physics.props.keys()].filter(id=>id.startsWith('activity-prop:')).length,registry:[...g.collector.entities.keys()].filter(id=>id.startsWith('activity-prop:')).length};
 });expect(r.starts.every(Boolean)).toBe(true);expect(r.max).toBe(8);expect(r.carried).toBe(true);expect(r.released).toBe(true);expect(r.count).toBe(0);expect(r.bodies).toBe(0);expect(r.registry).toBe(0);
});

test('excavating the support below a meditating pedestrian cancels the routine',async({page})=>{
 await boot(page);const r=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,a=s.activities,{gameState}=await import('/src/core/GameState.js');gameState.player.hidden=true;a.enabled=false;
  const p=s.people.find(p=>a.canStart(p,'meditate')&&g.voxels.isLoadedAtWorld(p.x,p.z));a.start(p,'meditate');s.update(1);const before=p.y;
  const removed=g.voxels.damageSphere(p.x,p.y-.5,p.z,1.4,{digsTerrain:true});s.update(.1);
  return{removed:removed.length,ended:!p.activity,drop:before-p.y,upright:Math.abs(p.visual.rotation.z)<.001};
 });expect(r.removed).toBeGreaterThan(0);expect(r.ended).toBe(true);expect(r.drop).toBeGreaterThan(.3);expect(r.upright).toBe(true);
});

test('a moving routine yields to an ordinary stationary pedestrian',async({page})=>{
 await boot(page);const r=await page.evaluate(async()=>{
  const s=__game.pedestrians,a=s.activities,{gameState}=await import('/src/core/GameState.js');gameState.player.hidden=true;a.enabled=false;
  const p=s.people.find(p=>a.canStart(p,'moonwalk'));a.start(p,'moonwalk');const dir=p.activity.direction,q=s.people.find(q=>q!==p);
  q.x=p.x+dir.x*1.1;q.z=p.z+dir.z*1.1;q.y=p.y;q.mesh.position.set(q.x,q.y,q.z);q.pause=100;
  let minimum=Infinity;for(let n=0;n<240;n++){s.update(1/60);minimum=Math.min(minimum,Math.hypot(p.x-q.x,p.z-q.z));}return{minimum,stopped:!p.activity};
});expect(r.minimum).toBeGreaterThan(.5);expect(r.stopped).toBe(true);
});

test('a blocked piggyback pair waits and lowers its rider smoothly',async({page})=>{
 await boot(page);const r=await page.evaluate(async()=>{
  const s=__game.pedestrians,a=s.activities,{gameState}=await import('/src/core/GameState.js');gameState.player.hidden=true;a.enabled=false;
  const p=s.people.find(p=>a.canStart(p,'piggyback'));a.start(p,'piggyback');const rider=s.people.find(q=>q.id===p.activity.partner);
  for(let n=0;n<600;n++){s.update(1/60);if(p.activity?.phase==='perform'&&p.activity.time>1)break;}
  if(!p.activity)return{mounted:false};const q=s.people.find(q=>q!==p&&q!==rider),dir=p.activity.direction;
  q.x=p.x+dir.x*.8;q.z=p.z+dir.z*.8;q.y=p.y;q.mesh.position.set(q.x,q.y,q.z);q.pause=100;
  let last=rider.mesh.position.clone(),jump=0,waited=false,minimum=Infinity;
  for(let n=0;n<420;n++){s.update(1/60);jump=Math.max(jump,rider.mesh.position.distanceTo(last));last.copy(rider.mesh.position);minimum=Math.min(minimum,Math.hypot(p.x-q.x,p.z-q.z));waited||=!!p.activity&&p.animation==='Idle'&&p.activity.time>1.5;if(!p.activity)break;}
  return{mounted:true,jump,waited,minimum,ended:!p.activity&&!rider.activity};
});expect(r.mounted).toBe(true);expect(r.waited).toBe(true);expect(r.ended).toBe(true);expect(r.minimum).toBeGreaterThan(.5);expect(r.jump).toBeLessThan(.12);
});

test('bird chasing turns with balanced planted steps instead of stretching into splits',async({page})=>{
 await boot(page);const r=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,a=s.activities,{gameState}=await import('/src/core/GameState.js');gameState.player.hidden=true;a.enabled=false;
  const p=s.people.find(p=>a.canStart(p,'phone')),bird=g.environmentLife.animals.find(b=>b.bird),next=s.graph.get(s.graph.get(p.node).links[0]);bird.mesh.position.set(next.x,p.y+2,next.z);bird.flee=0;
  a.start(p,'bird-chase');let low=Infinity,error=0,samples=0;
  for(let n=0;n<90;n++){s.update(1/60);g.environmentLife.update(1/60);if(p.activity){low=Math.min(low,(p.visual.getObjectByName('pelvis').getWorldPosition(p.mesh.position.clone()).y-p.y)/p.height);samples++;for(const f of p.grounding.contacts)if(f.stance)error=Math.max(error,Math.abs(f.error));}}
  return{low,error,samples};
 });console.log('CHASE_GROUNDING',JSON.stringify(r));expect(r.samples).toBeGreaterThan(30);expect(r.low).toBeGreaterThan(.35);expect(r.error).toBeLessThan(.15);
});
