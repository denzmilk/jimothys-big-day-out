import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

test('local radar draws authored streets, player heading and a waypoint, then resets',async({page})=>{
 await boot(page);await adv(page,.3);let r=(await state(page)).radar;
 expect(r).toBeDefined();expect(r.layer).toBe('surface');expect(r.terrainSamples).toBeLessThanOrEqual(6400);expect(r.buildings).toBeGreaterThan(0);
 await expect(page.locator('#tactical-radar')).toBeVisible();
 const pixels=await page.locator('#radar-canvas').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return new Set(Array.from({length:p.length/4},(_,i)=>`${p[i*4]},${p[i*4+1]},${p[i*4+2]}`)).size;});expect(pixels).toBeGreaterThan(20);
 await page.evaluate(()=>{__game.landmarks.target=__game.landmarks.sites[0].id;faceJimothy(1.2);});await adv(page,.3);r=(await state(page)).radar;expect(r.heading).toBeCloseTo(1.2,1);expect(r.waypoint).toBeTruthy();
 const draws=r.draws;await adv(page,.04);expect((await state(page)).radar.draws-draws).toBeLessThanOrEqual(1);
 await page.evaluate(()=>restartGame());await adv(page,.3);r=(await state(page)).radar;expect(r.contacts).toHaveLength(0);expect(r.waypoint).toBeNull();expect(await page.locator('#tactical-radar').count()).toBe(1);
});

test('radar matches awareness, clips sight against a wall, and marks the fixed search area',async({page})=>{
 await boot(page);
 const result=await page.evaluate(()=>{
  const ai=__game.pursuers,j=__game.jimothy.position;spawnPursuerAt('animal-control',j.x,j.z+12);const p=ai.animalControl;
  p.group.rotation.y=Math.PI;
  // A deterministic opaque barrier in the perception world tests the same ray
  // contract as voxel LOS; existing pursuer specs also destroy a real wall.
  const actual=ai.voxels;ai.voxels={terrainHeightAt:()=>0,hasLineOfSight:()=>false,raycast:()=>({t:3})};
  ai._think(p,.1);const seen=ai.radarContacts()[0];ai.voxels=actual;return seen;
 });
 expect(result.sight).toBeDefined();expect(Math.max(...result.sight.map(p=>Math.hypot(p.x-result.x,p.z-result.z)))).toBeLessThanOrEqual(3.1);
 await page.evaluate(()=>{const ai=__game.pursuers,p=ai.animalControl;p.state='chase';p.awareness=1;p.lastKnown={x:p.group.position.x+2,z:p.group.position.z};teleportJimothy(800,800);});
 await adv(page,.3);const p=(await state(page)).pursuers.find(p=>p.type==='animal-control');expect(p.state).toBe('search');expect(p.searchRadius).toBeGreaterThan(0);expect(p.searchRemaining).toBeGreaterThan(0);
});

test('sewer radar uses tunnel routes and filters surface contacts and incapacitated people',async({page})=>{
 await boot(page);await page.evaluate(async()=>{const {eventBus,Events}=await import('/src/core/EventBus.js');eventBus.emit(Events.DEV_GOTO_SEWER);});await adv(page,2);
 const r=(await state(page)).radar;expect(r).toBeDefined();expect(r.layer).toBe('underground');expect(r.tunnelSegments).toBeGreaterThan(0);
 await page.evaluate(()=>{const j=__game.jimothy.position,ai=__game.pursuers;spawnPursuerAt('animal-control',j.x+6,j.z);ai.animalControl.group.position.y=j.y+20;});await adv(page,.3);expect((await state(page)).radar.contacts).toHaveLength(0);
 await page.evaluate(()=>{const p=__game.pursuers.animalControl;p.group.position.y=__game.jimothy.position.y;p.ragdoll=true;});await adv(page,.3);expect((await state(page)).radar.contacts).toHaveLength(0);
});

test('tanks cannot aim a new shot or track an unseen target with their turret',async({page})=>{
 await boot(page);await page.waitForFunction(()=>__game.military.ready);
 const r=await page.evaluate(()=>{
  const m=__game.military,u=m.spawn('tank');m.voxels={...m.voxels,groundHeightAt:()=>0,terrainHeightAt:()=>0,hasLineOfSight:()=>false};m.drive=()=>{};
  u.mesh.position.copy(__game.jimothy.position);u.mesh.position.x+=20;u.clock=10;
  m.update(.1);const before=u.turret.rotation.y;__game.jimothy.body.position.z+=40;m.update(.1);
  return {phase:u.phase,before,after:u.turret.rotation.y,awareness:u.awareness};
 });expect(r.phase).toBe('approach');expect(r.after).toBeCloseTo(r.before,5);expect(r.awareness).not.toBe('chase');
});


test('giant radar stays bounded and reading an unvisited plan does not load the world',async({page})=>{
 await boot(page);const result=await page.evaluate(()=>{
  const g=__game,before=g.voxels.generated.size;g.radar.rebuild({x:800,z:800},180,'surface');
  const after=g.voxels.generated.size;setFatness(20000);return {before,after};
 });expect(result.after).toBe(result.before);await adv(page,.3);const r=(await state(page)).radar;expect(r.range).toBeGreaterThan(90);expect(r.range).toBeLessThanOrEqual(180);expect(r.terrainSamples).toBeLessThanOrEqual(6400);expect(r.contacts.length).toBeLessThanOrEqual(16);
});

test('an approaching jet outside the map still marks its nearby committed strike',async({page})=>{
 await boot(page);await page.waitForFunction(()=>__game.military.ready);
 const r=await page.evaluate(()=>{const g=__game,j=g.jimothy.position;g.military.spawn('jet');g.radar.update(.2,{x:j.x,y:j.y,z:j.z,yaw:0,radius:g.jimothy.radius,underground:false});return g.radar.snapshot();});
 expect(r.contacts.some(c=>c.kind==='jet'&&c.strike&&Math.hypot(c.strike.x-r.player.x,c.strike.z-r.player.z)<1)).toBe(true);
});
