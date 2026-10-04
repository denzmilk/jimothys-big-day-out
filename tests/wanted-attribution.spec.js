import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

async function observe(page){
 await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js');window.damageReports=[];window.propertyReports=[];
  eventBus.on(Events.WORLD_DEMOLISHED,e=>damageReports.push({voxels:e.voxels,ground:e.groundOnly?e.voxels:e.groundVoxels||0,cause:e.instigator,collapse:!!e.collapse}));
  eventBus.on(Events.PROPERTY_DESTROYED,e=>propertyReports.push(e));
 });
}

test('actual ground, neutral blasts and a repeated empty hit carry the correct heat',async({page})=>{
 await boot(page);await observe(page);
 const result=await page.evaluate(async()=>{
  const g=__game,{eventBus,Events}=await import('/src/core/EventBus.js'),{VOXEL,HEAT}=await import('/src/core/Constants.js');
  const y=g.voxels.terrainHeightAt(0,0);g.blastAt({x:0,y:y-.5,z:0},1,{fatShare:0});
  const first=JSON.parse(render_game_to_text()).heat,removed=damageReports.reduce((n,r)=>n+r.voxels,0);
  g.blastAt({x:0,y:y-.5,z:0},1,{fatShare:0});const repeated=JSON.parse(render_game_to_text()).heat;
  // Real queued shell/spawn damage, using fresh solid patches. The shell's
  // terrain-preserving path hits an explicit raised slab just above grade.
  const s=VOXEL.SIZE,sy=Math.ceil((y+4)/s);for(let x=30;x<40;x++)for(let z=0;z<10;z++)for(let v=sy;v<sy+4;v++)g.voxels.setEdit(x,v,z,3);
  g.military.explode({x:35*s,y:(sy+2)*s,z:5*s},1);
  eventBus.emit(Events.WORLD_BLAST,{x:-6,y:g.voxels.terrainHeightAt(-6,0)-.5,z:0,radius:1,digsTerrain:true,instigator:'spawn'});
  eventBus.emit(Events.WORLD_BLAST,{x:0,y:g.voxels.terrainHeightAt(0,6)-.5,z:6,radius:1,digsTerrain:true});
  advanceTime(.5);return{first,repeated,after:JSON.parse(render_game_to_text()).heat,reports:damageReports,removed,groundWeight:HEAT.PER_GROUND_DEMOLITION,cell:s**3};
 });
 expect(result.first.groundVolume).toBeGreaterThan(0);expect(result.first.structureVolume).toBe(0);expect(result.first.tier).toBe(0);
 expect(result.repeated).toEqual(result.first);expect(result.after.points).toBe(result.first.points);
 expect(result.reports.some(r=>r.cause==='military'&&r.voxels>0)).toBe(true);expect(result.reports.some(r=>r.cause==='spawn'&&r.voxels>0)).toBe(true);expect(result.reports.some(r=>r.cause==='unknown'&&r.voxels>0)).toBe(true);
});

test('a generated house retains player attribution through delayed cave-in',async({page})=>{
 await boot(page);await observe(page);
 const before=await page.evaluate(async()=>{
  const L=await import('/src/level/Layout.js'),{VOXEL}=await import('/src/core/Constants.js');const g=__game,v=g.voxels,s=VOXEL.SIZE;
  g.pursuers.update=()=>{};g.military.update=()=>{};
  const b=L.buildingsIntersecting(-160,-160,160,160).filter(b=>b.type==='craftsman').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];teleportJimothy(b.x-5,b.z-5);
  const span=s*VOXEL.CHUNK_XZ;for(let x=Math.floor((b.x-2)/span);x<=Math.floor((b.x+b.w+2)/span);x++)for(let z=Math.floor((b.z-2)/span);z<=Math.floor((b.z+b.d+2)/span);z++)v.ensureColumn(x,z);
  const cut=b.vy+((b.vy+1)%4===3?2:1),removed=[];
  for(let x=b.vx-2;x<b.vx+b.vw+2;x++)for(let z=b.vz-2;z<b.vz+b.vd+2;z++){const mat=v.get(x,cut,z);if(mat){v.setEdit(x,cut,z,0);removed.push({x:(x+.5)*s,y:(cut+.5)*s,z:(z+.5)*s,mat,ground:false});}}
  g.demolitionEffects(removed,{x:b.x+b.w/2,y:cut*s,z:b.z+b.d/2},false,'player');return JSON.parse(render_game_to_text()).heat;
 });await adv(page,10);
 const after=await page.evaluate(()=>({heat:JSON.parse(render_game_to_text()).heat,reports:damageReports}));
 expect(after.reports.some(r=>r.collapse&&r.voxels>0&&r.cause==='player')).toBe(true);expect(after.reports.every(r=>r.cause==='player')).toBe(true);expect(after.heat.structureVolume).toBeGreaterThan(before.structureVolume);expect(after.heat.points).toBeGreaterThan(before.points);
});

test('player car wrecks count once and military car wrecks remain neutral',async({page})=>{
 await boot(page);await observe(page);
 const r=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js'),{STREET,HEAT}=await import('/src/core/Constants.js'),g=__game,cars=g.streetLife.items.filter(p=>p.kind==='car'&&!p.fragment),a=cars[0],b=cars[1];
  eventBus.emit(Events.VEHICLE_BREAK,{id:a.id,radius:STREET.CAR.EXPLODE_RADIUS,instigator:'player'});const first=JSON.parse(render_game_to_text()).heat;
  eventBus.emit(Events.VEHICLE_BREAK,{id:a.id,radius:STREET.CAR.EXPLODE_RADIUS,instigator:'player'});g.streetLife.fracture(a,a.mesh.position.x,a.mesh.position.z,STREET.CAR.EXPLODE_RADIUS,'player');
  eventBus.emit(Events.WORLD_IMPACT,{...b.mesh.position,radius:STREET.CAR.EXPLODE_RADIUS,instigator:'military'});
  return{first,after:JSON.parse(render_game_to_text()).heat,reports:propertyReports,credit:HEAT.PER_CAR_WRECK,a:a.id,b:b.id};
 });
 expect(r.first.cars).toBe(1);expect(r.first.points).toBe(r.credit);expect(r.after).toEqual(r.first);expect(r.reports.filter(p=>p.id===r.a)).toHaveLength(1);expect(r.reports.some(p=>p.id===r.b&&p.instigator==='military')).toBe(true);
});

test('giant ground channel reports stay low weight and do not re-credit a settled path',async({page})=>{
 await boot(page);await observe(page);
 const r=await page.evaluate(()=>{
  const g=__game,v=g.voxels,from={x:0,y:v.terrainHeightAt(0,0),z:0},to={x:8,y:v.terrainHeightAt(8,0),z:0};
  v.queueGroundChannel(from,to,3,1);advanceTime(.5);const first=JSON.parse(render_game_to_text()).heat;
  v.queueGroundChannel(from,to,3,1);advanceTime(.5);return{first,after:JSON.parse(render_game_to_text()).heat,reports:damageReports};
 });
 expect(r.first.groundVolume).toBeGreaterThan(5);expect(r.first.structureVolume).toBe(0);expect(r.first.tier).toBe(0);expect(r.after.groundVolume).toBe(r.first.groundVolume);expect(r.reports.every(r=>r.cause==='player'&&r.ground===r.voxels)).toBe(true);
});

test('real pedestrian scares are suppressed on repeated approaches and escalation is visible then reset',async({page})=>{
 await boot(page);
 const r=await page.evaluate(async()=>{
  const g=__game,{gameState}=await import('/src/core/GameState.js'),{HEAT}=await import('/src/core/Constants.js');const p=g.pedestrians.people.find(p=>!p.attached&&!p.vehicleSeat);
  const approach=()=>{g.jimothy.body.position.set(p.x+1,p.y+g.jimothy.radius,p.z);p.scaredRecently=false;g.pedestrians.update(.01);};
  approach();const first=gameState.heat.points;for(let i=0;i<25;i++)approach();const repeated=gameState.heat.points;
  // Only the UI clock is seeded here; volume and escalation rules have
  // independent tests above and across three simulation frequencies.
  gameState.heat.points=HEAT.TIER_THRESHOLDS[5];g.heat._retier();g.pursuers.update=()=>{};g.military.update=()=>{};
  advanceTime(1);return{first,repeated,heat:JSON.parse(render_game_to_text()).heat,label:document.getElementById('radar-status').textContent};
 });expect(r.first).toBeGreaterThan(0);expect(r.repeated).toBe(r.first);expect(r.heat.tier).toBe(3);expect(r.label).toContain('WANTED RISING');await adv(page,12);expect((await state(page)).heat.tier).toBe(4);
 await page.evaluate(()=>restartGame());await adv(page,.1);const clean=await state(page);expect(clean.heat).toMatchObject({points:0,tier:0,target:0,nuisance:0,structureVolume:0,groundVolume:0,cars:0});
 await expect(page.locator('#radar-status')).not.toContainText('WANTED RISING');
});
