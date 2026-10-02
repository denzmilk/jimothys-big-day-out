import {test,expect} from '@playwright/test';import {boot,adv,state} from './helpers.mjs';
async function target(page,kind='jet',withRig=false){
 await boot(page,{withRig});await page.waitForFunction(()=>__game.military.ready);
 return page.evaluate(async kind=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js'),g=__game,j=g.jimothy;setFatness(250);teleportJimothy(-2,-40);faceJimothy(0);g.military.update=()=>{};
  const u=g.military.spawn(kind),p=j.body.position;
  const dy=kind==='jet'?40:-j.radius+u.half[1],dz=kind==='jet'?15:j.radius+8;
  u.mesh.position.set(p.x,p.y+dy,p.z+dz);u.mesh.rotation.set(0,0,0);u.mesh.updateMatrixWorld(true);
  eventBus.emit(Events.PROP_POSE,{id:u.id,position:u.mesh.position,quaternion:u.mesh.quaternion});
  const aim=-Math.atan2(dy,dz);lookJimothy(0);aimJimothy(g.cameraSystem.neutralPitch+aim);return{id:u.id,y:p.y,aim};
 },kind);
}
test('an upward aimed giant headbutt reaches a jet and visibly lunges',async({page})=>{
 const t=await target(page);await adv(page,.1);let s=await state(page);expect(s.jimothy.aim).toBeCloseTo(t.aim,2);expect(s.reticle.inReach).toBe(true);
 await page.keyboard.press('e');await adv(page,.27);s=await state(page);
 expect(s.military.units.some(u=>u.id===t.id)).toBe(false);expect(s.military.wreckage).toBeGreaterThan(1);
 expect(await page.evaluate(()=>__game.jimothy.body.position.y)).toBeGreaterThan(t.y+1);expect(s.game.isPlaying).toBe(true);
 await adv(page,4);expect((await state(page)).jimothy.grounded).toBe(true);
});
test('giant aimed attacks still break ground army vehicles',async({page})=>{
 const t=await target(page,'tank');await adv(page,.1);await page.keyboard.press('e');await adv(page,.4);
 const s=await state(page);expect(s.military.units.some(u=>u.id===t.id)).toBe(false);expect(s.military.wreckage).toBeGreaterThan(1);
});
test('headbutt interrupts held rolling and an aimed-away jet survives',async({page})=>{
 const t=await target(page);await page.evaluate(()=>{faceJimothy(Math.PI);lookJimothy(Math.PI);});
 await page.keyboard.down('c');await adv(page,.3);expect((await state(page)).jimothy.move).toBe('roll');
 await page.keyboard.press('e');await adv(page,.15);const s=await state(page);expect(s.jimothy.move).toBe('headbutt');expect(s.military.units.some(u=>u.id===t.id)).toBe(true);await page.keyboard.up('c');
});
test('jets descend into a reachable low pass and climb out again',async({page})=>{
 await boot(page);await page.waitForFunction(()=>__game.military.ready);
 const out=await page.evaluate(()=>{
  setFatness(250);teleportJimothy(-2,-40);const g=__game,u=g.military.spawn('jet'),y=g.jimothy.body.position.y,r=g.jimothy.radius;
  u.travel=-1;g.military.update(0);const low=u.mesh.position.y;
  u.travel=150;g.military.update(0);return{low,high:u.mesh.position.y,y,r};
 });expect(out.low-out.y).toBeGreaterThan(out.r);expect(out.low-out.y).toBeLessThan(out.r*2);expect(out.high).toBeGreaterThan(out.low+10);
});
test('a jet beyond the giant headbutt reach survives',async({page})=>{
 const t=await target(page);await page.evaluate(async id=>{
  const g=__game,u=g.military.units.find(u=>u.id===id),p=g.jimothy.body.position;
  u.mesh.position.set(p.x,p.y+80,p.z+30);u.mesh.updateMatrixWorld(true);
  const{eventBus,Events}=await import('/src/core/EventBus.js');eventBus.emit(Events.PROP_POSE,{id,position:u.mesh.position,quaternion:u.mesh.quaternion});
 },t.id);await adv(page,.1);expect((await state(page)).reticle.inReach).toBe(false);
 await page.keyboard.press('e');await adv(page,.4);expect((await state(page)).military.units.some(u=>u.id===t.id)).toBe(true);
});

test('upward giant aiming keeps the loaded camera above ground with the jet in view',async({page})=>{
 const t=await target(page,'jet',true);await adv(page,1);
 const view=await page.evaluate(id=>{
  const g=__game,c=g.camera.position,u=g.military.units.find(u=>u.id===id),screen=u.mesh.position.clone().project(g.camera);
  return{height:c.y-g.voxels.terrainHeightAt(c.x,c.z),solid:!!g.voxels.solidAtWorld(c.x,c.y,c.z),screen:screen.toArray()};
 },t.id);
 expect(view.height).toBeGreaterThan(1);expect(view.solid).toBe(false);
 expect(Math.abs(view.screen[0])).toBeLessThan(.8);expect(Math.abs(view.screen[1])).toBeLessThan(.8);expect(view.screen[2]).toBeLessThan(1);
});

test('holding roll resumes travel after the giant headbutt lands',async({page})=>{
 await target(page);await page.keyboard.down('c');await adv(page,.3);await page.keyboard.press('e');await adv(page,.2);
 expect((await state(page)).jimothy.move).toBe('headbutt');await adv(page,4);
 expect((await state(page)).jimothy.move).toBe('roll');await page.keyboard.up('c');await adv(page,1.3);expect((await state(page)).jimothy.move).toBe(null);
});
test('a moving jet can be intercepted during its natural low pass',async({page})=>{
 await boot(page,{withRig:true});await page.waitForFunction(()=>__game.military.ready);
 const id=await page.evaluate(()=>{setFatness(250);teleportJimothy(-2,-40);return __game.military.spawn('jet').id;});
 await adv(page,4.7);
 const before=await page.evaluate(id=>{
  const g=__game,u=g.military.units.find(u=>u.id===id),j=g.jimothy,p=u.mesh.position,dx=p.x-j.body.position.x,dy=p.y-j.body.position.y,dz=p.z-j.body.position.z;
  faceJimothy(Math.atan2(dx,dz));lookJimothy(Math.atan2(dx,dz));aimJimothy(g.cameraSystem.neutralPitch-Math.atan2(dy,Math.hypot(dx,dz)));
  return{travel:u.travel,distance:p.distanceTo(j.group.position),grounded:j.grounded};
 },id);console.log(JSON.stringify(before));await page.keyboard.press('e');await adv(page,.3);
 const s=await state(page);expect(s.military.units.some(u=>u.id===id)).toBe(false);expect(s.military.wreckage).toBeGreaterThan(1);expect(s.game.isPlaying).toBe(true);
});
