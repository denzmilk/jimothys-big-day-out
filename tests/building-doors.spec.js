import {test,expect} from '@playwright/test';import {boot,adv,state} from './helpers.mjs';

test('front and connected room doors open for Jimothy and residents',async({page})=>{
 await boot(page,{withRig:true});
 const result=await page.evaluate(async()=>{
  const g=__game,i=g.interiors,doors=i.items.filter(p=>p.door&&!p.fragment);if(!doors.length)return {count:0};
  const front=doors.find(d=>d.door.exterior),inside=doors.find(d=>!d.door.exterior);
  const floor=front.mesh.position.y-front.half[1];dropJimothy(front.mesh.position.x,front.mesh.position.z-1.8,floor+g.jimothy.radius);i.update(.5);
  const opened=front.angle;const resident=i.residents[0];resident.mesh.position.copy(inside.hinge);resident.mesh.position.y=inside.mesh.position.y-inside.half[1];i.update(.5);
  return {count:doors.length,opened,residentOpen:inside.angle,rooms:JSON.parse(render_game_to_text()).interiors.buildings.flatMap(b=>b.rooms)};
 });
 expect(result.count).toBeGreaterThan(2);expect(Math.abs(result.opened)).toBeGreaterThan(1);expect(Math.abs(result.residentOpen)).toBeGreaterThan(1);
});

test('doors break loose, retain damage after travel and reset',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{
  const g=__game,i=g.interiors,{eventBus,Events}=await import('/src/core/EventBus.js'),p=i.items.find(p=>p.door);if(!p)return {found:false};
  const id=p.id,at=p.mesh.position.clone();eventBus.emit(Events.WORLD_IMPACT,{x:at.x,y:at.y,z:at.z,radius:1.5});
  const broken=i.destroyed.has(id),pieces=i.items.filter(q=>q.fragment&&q.door).length;
  teleportJimothy(400,400);i.stream();teleportJimothy(at.x,at.z);i.stream();const restored=i.items.some(q=>q.id===id);
  restartGame();i.stream();return {found:true,broken,pieces,restored,reset:i.destroyed.size,doors:i.items.filter(q=>q.door).length};
 });
 expect(result.found).toBe(true);expect(result.broken).toBe(true);expect(result.pieces).toBeGreaterThan(0);expect(result.restored).toBe(false);expect(result.reset).toBe(0);expect(result.doors).toBeGreaterThan(0);
});

test('door frames lost to demolition release the leaf into shared physics',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{
  const g=__game,i=g.interiors,{VOXEL}=await import('/src/core/Constants.js'),p=i.items.find(p=>p.door);if(!p)return {found:false};
  for(const q of p.supportPoints){const [x,y,z]=g.voxels.worldToVoxel(q.x,q.y,q.z);g.voxels.setEdit(x,y,z,0);}
  i.update(1);const body=g.physics.props.get(p.id);return {found:true,loose:p.loose,dynamic:body.body.type===1,removed:i.destroyed.has(p.id)};
 });expect(result).toEqual({found:true,loose:true,dynamic:true,removed:true});
});

test('nearby furnished rooms and doors stay within their streaming budget',async({page})=>{
 await boot(page);await adv(page,1);const s=await state(page),f=s.interiors.furniture;
 expect(f.some(p=>p.kind==='door')).toBe(true);expect(new Set(f.filter(p=>p.kind!=='door').map(p=>p.kind)).size).toBeGreaterThanOrEqual(8);
 expect(f.filter(p=>p.kind==='door').length).toBeLessThanOrEqual(32);expect(f.filter(p=>p.kind!=='door'&&!p.fragment).length).toBeLessThanOrEqual(64);
 expect(s.interiors.residents.length).toBeLessThanOrEqual(8);
});

test('original Jimothy and a resident actually cross a hinged room doorway',async({page})=>{
 await boot(page,{withRig:true});
 const start=await page.evaluate(async()=>{
  const g=__game,i=g.interiors,{buildingsIntersecting}=await import('/src/level/Layout.js'),{interiorPoint}=await import('/src/level/InteriorLayout.js');
  const b=buildingsIntersecting(-100,-100,100,100).filter(b=>b.type==='craftsman').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0],plan=i.plan(b),d=plan.doors.find(d=>!d.exterior&&d.floor===plan.floors[0].id);
  const at=interiorPoint(b,d.x+d.width/.22/2,1,d.z-2/.22),target=interiorPoint(b,d.x+d.width/.22/2,1,d.z+2/.22);
  teleportJimothy(at.x,at.z);advanceTime(4);dropJimothy(at.x,at.z,at.y+g.jimothy.radius);g.jimothy.postUpdate(0);faceJimothy(-(b.front||0)*Math.PI/2);i.stream();
  return{at,target,door:d.id};
 });
 await page.keyboard.down('w');await adv(page,.8);await page.keyboard.up('w');
 const result=await page.evaluate(async({at,target,door})=>{
  const g=__game,i=g.interiors,{gameState}=await import('/src/core/GameState.js'),dx=(target.x-at.x)/4,dz=(target.z-at.z)/4;
  const jim=(g.jimothy.position.x-at.x)*dx+(g.jimothy.position.z-at.z)*dz,feet=g.jimothy.position.y;
  const p=i.residents[0];for(const q of [...i.residents])if(q!==p)i.removeResident(q);
  p.mesh.position.copy(at);p.grounding.reset();p.route=[target];p.pause=0;p.flee=0;i.clock=Infinity;gameState.player.hidden=true;
  for(let n=0;n<360;n++)i.update(1/60);
  return{jim,feet,rugs:i.items.filter(q=>q.kind==='rugRectangle').map(q=>q.loose),walked:(p.mesh.position.x-at.x)*dx+(p.mesh.position.z-at.z)*dz,angle:i.items.find(p=>p.id===door)?.angle};
 },start);
 expect(result.rugs.every(loose=>!loose)).toBe(true);expect(result.jim).toBeGreaterThan(3);expect(Math.abs(result.feet-start.at.y)).toBeLessThan(.25);expect(result.walked).toBeGreaterThan(3);
});

test('an apartment living room retains a complete furniture group around its clear route',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{
  const g=__game,i=g.interiors,{eventBus,Events}=await import('/src/core/EventBus.js');eventBus.emit(Events.DEV_GOTO_INTERIOR);eventBus.emit(Events.DEV_GOTO_INTERIOR);advanceTime(3);i.stream();
  const a=[...i.active.values()].filter(a=>a.plan.b.type==='apartment').sort((a,b)=>i.distance(a.floor,g.jimothy.position)-i.distance(b.floor,g.jimothy.position))[0],r=a.floor.rooms.find(r=>r.purpose==='living');
  return{floor:a.floor.id,kinds:i.items.filter(p=>p.id.startsWith(r.id+':')).map(p=>p.kind)};
 });
 expect(result.kinds).toContain('loungeSofa');expect(result.kinds).toContain('tableCoffee');expect(result.kinds).toContain('cabinetTelevision');expect(result.kinds).toContain('televisionVintage');expect(result.kinds).toContain('rugRectangle');expect(result.kinds.some(k=>k==='pottedPlant'||k==='lampRoundFloor')).toBe(true);
});

test('a carried door returns as the same loose leaf after travel',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{
  const g=__game,i=g.interiors,{eventBus,Events}=await import('/src/core/EventBus.js'),p=i.items.find(p=>p.door),id=p.id,key=p.key;
  eventBus.emit(Events.ENTITY_ATTACH,{id});const ground=g.voxels.groundHeightAt(0,12,g.voxels.terrainHeightAt(0,12)+1),position={x:0,y:ground,z:12};
  eventBus.emit(Events.ENTITY_RELEASE,{id,position,ground});teleportJimothy(400,400);i.stream();const unloaded=!i.items.some(p=>p.id===id);
  teleportJimothy(0,12);i.stream();const q=i.items.find(p=>p.id===id);return{unloaded,found:!!q,key:q?.key,expected:key,loose:q?.loose,mass:q?.mass,attached:q?.attached,x:q?.mesh.position.x,z:q?.mesh.position.z};
 });expect(result.unloaded).toBe(true);expect(result.found).toBe(true);expect(result.key).toBe(result.expected);expect(result.loose).toBe(true);expect(result.attached).toBe(false);expect(result.mass).toBe(22);expect(result.x).toBeCloseTo(0);expect(result.z).toBeCloseTo(12);
});

test('closed leaves block enemy sight and nearby pursuers open them',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{
  const g=__game,i=g.interiors,p=i.items.find(p=>p.door&&!p.door.exterior),yaw=p.closedYaw,nx=Math.sin(yaw),nz=Math.cos(yaw);
  p.angle=0;i.poseDoor(p);const at=p.mesh.position.clone(),a={x:at.x-nx,y:at.y,z:at.z-nz},b={x:at.x+nx,y:at.y,z:at.z+nz};
  const closed=g.voxels.hasLineOfSight(a.x,a.y,a.z,b.x,b.y,b.z);
  const target=at.clone().addScaledVector(g.jimothy.vel.clone().set(nx,0,nz),2),eye=at.clone().addScaledVector(g.jimothy.vel.clone().set(nx,0,nz),-2);
  g.jimothy.body.position.set(target.x,target.y-g.cameraSystem._lookHeight+g.jimothy.radius,target.z);
  const cameraDistance=g.cameraSystem._pullIn(eye).distanceTo(target);p.angle=p.door.sign*Math.PI/2;i.poseDoor(p);const open=g.voxels.hasLineOfSight(a.x,a.y,a.z,b.x,b.y,b.z);
  p.angle=0;p.hold=0;i.poseDoor(p);dropJimothy(0,50,g.voxels.terrainHeightAt(0,50)+g.jimothy.radius);for(const q of i.residents)q.mesh.position.set(0,0,0);
  spawnPursuerAt('animal-control',a.x,a.z);g.pursuers.animalControl.group.position.y=at.y-p.half[1];i.clock=Infinity;i.update(.5);
  return{closed,open,cameraDistance,angle:p.angle};
 });expect(result.closed).toBe(false);expect(result.open).toBe(true);expect(result.cameraDistance).toBeLessThan(2);expect(Math.abs(result.angle)).toBeGreaterThan(1);
});
