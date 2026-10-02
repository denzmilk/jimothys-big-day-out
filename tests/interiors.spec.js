import{test,expect}from'@playwright/test';import{boot,adv,state}from'./helpers.mjs';
test('nearby homes have furnished connected rooms and grounded moving residents',async({page})=>{
 await boot(page);const before=(await state(page)).interiors;expect(before?.buildings.length).toBeGreaterThan(0);expect(before?.residents.length).toBeGreaterThan(0);expect(before?.furniture.length).toBeGreaterThan(8);
 await adv(page,3);const after=(await state(page)).interiors;expect(after.residents.some(p=>{const a=before.residents.find(q=>q.id===p.id);return a&&Math.hypot(a.x-p.x,a.z-p.z)>.3;})).toBe(true);
 for(const p of after.residents)for(const f of p.feet.filter(f=>f.stance))expect(Math.abs(f.error)).toBeLessThan(.15);
});
test('interior furniture breaks, persists through streaming and resets with residents',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const g=__game,i=g.interiors,{eventBus,Events}=await import('/src/core/EventBus.js');const p=i.items.find(p=>!p.fragment),id=p.id;eventBus.emit(Events.WORLD_IMPACT,{x:p.mesh.position.x,y:p.mesh.position.y,z:p.mesh.position.z,radius:3});const broken=i.destroyed.has(id),pieces=i.items.filter(p=>p.fragment).length,at=g.jimothy.body.position.clone();teleportJimothy(400,400);i.stream();teleportJimothy(at.x,at.z);g.jimothy.body.position.y=at.y;i.stream();const restored=i.items.some(p=>p.id===id);eventBus.emit(Events.GAME_RESTART,{});return{broken,pieces,restored,damage:i.destroyed.size,people:i.residents.length};});
 expect(result.broken).toBe(true);expect(result.pieces).toBeGreaterThan(1);expect(result.restored).toBe(false);expect(result.damage).toBe(0);expect(result.people).toBeGreaterThan(0);
});

test('a resident climbs connected stairs without a floor jump or ceiling snap',async({page})=>{
 await boot(page);
 const result=await page.evaluate(async()=>{
  const g=__game,i=g.interiors,{gameState}=await import('/src/core/GameState.js'),{eventBus,Events}=await import('/src/core/EventBus.js');
  eventBus.emit(Events.DEV_GOTO_INTERIOR,{});eventBus.emit(Events.DEV_GOTO_INTERIOR,{});i.stream();
  const p=i.residents.find(p=>p.plan.stairs&&p.plan.floors.length>1),plan=p.plan,lower=plan.nodes.find(n=>n.key===`${plan.id}:0:stair-front`),upper=plan.nodes.find(n=>n.key===`${plan.id}:1:stair-back`);
  for(const q of [...i.residents])if(q!==p)i.removeResident(q);
  p.mesh.position.set(lower.x,lower.y,lower.z);p.grounding.reset();p.pause=0;p.flee=0;p.route=i.path(p,upper);i.clock=Infinity;gameState.player.hidden=true;
  const from=p.mesh.position.y;let maxRise=0,steps=0;for(;steps<2400&&p.route.length;steps++){const y=p.mesh.position.y;i.update(1/60);maxRise=Math.max(maxRise,p.mesh.position.y-y);}
  return{rise:p.mesh.position.y-from,expected:upper.y-lower.y,maxRise,steps,position:p.mesh.position.toArray(),target:upper,feet:p.grounding.contacts};
 });
 expect(result.rise).toBeCloseTo(result.expected,1);expect(result.maxRise).toBeLessThan(.24);expect(result.steps).toBeLessThan(2400);
 for(const f of result.feet.filter(f=>f.stance))expect(Math.abs(f.error)).toBeLessThan(.15);
});

test('indoor people enter the shared ragdoll and rolling-collection lifecycle',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const g=__game,i=g.interiors,{eventBus,Events}=await import('/src/core/EventBus.js');const p=i.residents[0],at=p.mesh.position.clone();eventBus.emit(Events.WORLD_IMPACT,{x:at.x,y:at.y+.8,z:at.z,radius:.8});const ragdoll=p.ragdoll&&g.ragdolls.active.has(p.id);eventBus.emit(Events.ENTITY_ATTACH,{id:p.id});const attached=p.attached&&!g.ragdolls.active.has(p.id);eventBus.emit(Events.ENTITY_RELEASE,{id:p.id,position:at,ground:at.y});i.update(.1);return{ragdoll,attached,released:!p.attached,feet:p.grounding.contacts};});
 expect(result.ragdoll).toBe(true);expect(result.attached).toBe(true);expect(result.released).toBe(true);expect(result.feet).toHaveLength(2);
});

test('carried furniture returns at its dropped location after unloading',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const g=__game,i=g.interiors,{eventBus,Events}=await import('/src/core/EventBus.js'),p=i.items[0],id=p.id;eventBus.emit(Events.ENTITY_ATTACH,{id});const position={x:0,y:g.voxels.terrainHeightAt(0,12),z:12};eventBus.emit(Events.ENTITY_RELEASE,{id,position,ground:position.y});teleportJimothy(450,450);i.stream();const removed=!i.items.some(q=>q.id===id);teleportJimothy(0,12);i.stream();const restored=i.items.find(q=>q.id===id);return{removed,restored:!!restored,position:restored?.mesh.position.toArray(),count:i.items.length,people:i.residents.length};});
 expect(result.removed).toBe(true);expect(result.restored).toBe(true);expect(result.position[0]).toBeCloseTo(0);expect(result.position[2]).toBeCloseTo(12);expect(result.count).toBeLessThanOrEqual(80);expect(result.people).toBeLessThanOrEqual(8);
});

test('released broken furniture expires without respawning a whole model',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const g=__game,i=g.interiors,{eventBus,Events}=await import('/src/core/EventBus.js'),p=i.items.find(p=>p.kind!=='rugRectangle'),at=p.mesh.position.clone();i.breakItem(p,at);const q=i.items.find(q=>q.fragment),id=q.id;eventBus.emit(Events.ENTITY_ATTACH,{id});eventBus.emit(Events.ENTITY_RELEASE,{id,position:at,ground:at.y});q.life=0;i.update(.1);i.stream();return{saved:i.saved.has(id),active:i.items.some(q=>q.id===id)};});
 expect(result).toEqual({saved:false,active:false});
});

test('lean Jimothy walks through a real doorway at floor level',async({page})=>{
 await boot(page,{withRig:true});
 const start=await page.evaluate(async()=>{const g=__game,L=await import('/src/level/Layout.js'),b=L.buildingsIntersecting(-100,-100,100,100).filter(b=>b.type==='craftsman').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0],plan=g.interiors.plan(b),e=plan.entrance;teleportJimothy(e.x,e.z);g.jimothy.body.position.y=e.y+g.jimothy.radius;g.jimothy.vy=0;g.jimothy._prevFeetY=undefined;g.jimothy.postUpdate(0);faceJimothy(-(b.front||0)*Math.PI/2);return{...e,front:b.front};});
 await page.keyboard.down('w');await adv(page,.75);await page.keyboard.up('w');const s=await state(page);
 expect(Math.hypot(s.jimothy.x-start.x,s.jimothy.z-start.z)).toBeGreaterThan(1.6);expect(Math.abs(s.jimothy.y-start.y)).toBeLessThan(.25);expect(s.jimothy.grounded).toBe(true);
 for(const f of s.feet.filter(f=>f.stance))expect(Math.abs(f.error)).toBeLessThan(.16);
});

test('residents travelling in opposite directions pass each other in a hall',async({page})=>{
 await boot(page);const crossed=await page.evaluate(async()=>{const g=__game,i=g.interiors,{gameState}=await import('/src/core/GameState.js'),a=i.residents[0],b=i.residents[1],plan=a.plan,f=plan.floors.find(f=>f.id===a.floor),front=plan.nodes.find(n=>n.key===`${plan.id}:${f.index}:front`),back=plan.nodes.find(n=>n.key===`${plan.id}:${f.index}:back`);for(const p of [...i.residents])if(p!==a&&p!==b)i.removeResident(p);const dx=back.x-front.x,dz=back.z-front.z,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,mx=(front.x+back.x)/2,mz=(front.z+back.z)/2;
 for(const [p,sign,target]of[[a,-1,back],[b,1,front]]){p.plan=plan;p.floor=f.id;p.mesh.position.set(mx+sign*ux*.8,front.y,mz+sign*uz*.8);p.mesh.rotation.y=Math.atan2(-sign*ux,-sign*uz);p.grounding.reset();p.route=[target];p.pause=0;p.flee=0;}gameState.player.hidden=true;i.clock=Infinity;
 for(let n=0;n<420;n++){i.update(1/60);if((a.mesh.position.x-b.mesh.position.x)*ux+(a.mesh.position.z-b.mesh.position.z)*uz>.4)return true;}return false;});expect(crossed).toBe(true);
});
