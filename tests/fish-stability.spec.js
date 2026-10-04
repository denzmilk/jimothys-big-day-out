import {test,expect} from '@playwright/test';
import {boot,state} from './helpers.mjs';

async function setup(page){await boot(page);await page.waitForFunction(()=>__game.ocean.ready);await page.evaluate(()=>{teleportJimothy(-850,0);advanceTime(.6);});}

test('all five fish keep bounded turns and travel during repeated swimmer avoidance at 30/60/120 Hz',async({page})=>{
 await setup(page);
 const rows=await page.evaluate(async()=>{
  const g=__game,o=g.ocean,{OCEAN:C}=await import('/src/core/Constants.js'),rows=[];
  // An approaching swimmer can reverse the desired direction in one frame.
  // Observe the delivered fish transform, not just an internal steering value.
  for(const hz of [30,60,120])for(const kind of C.FISH){
   o.clearFish();o.addFish(kind,{x:-850,z:0},0,['manta','whale'].includes(kind));const f=o.fish[0];f.mesh.position.set(-850,-5,0);o.habitat={x:-850,z:0};
   let turn=0,travel=0,vertical=0,accel=0,previousSpeed=null;
   for(let i=0;i<hz*8;i++){
    const p=f.mesh.position,near=Math.floor(i/(hz/2))%2===1;g.jimothy.body.position.set(p.x+(near?2:8),p.y,p.z);g.jimothy.postUpdate(0);
    const before=p.clone(),yaw=f.mesh.rotation.y;o.update(1/hz);
    if(i>1){turn=Math.max(turn,Math.abs(Math.atan2(Math.sin(f.mesh.rotation.y-yaw),Math.cos(f.mesh.rotation.y-yaw)))*hz);travel=Math.max(travel,p.distanceTo(before)*hz);vertical=Math.max(vertical,Math.abs(p.y-before.y)*hz);const speed=Math.hypot(p.x-before.x,p.z-before.z)*hz;if(previousSpeed!==null)accel=Math.max(accel,Math.abs(speed-previousSpeed)*hz);previousSpeed=speed;}
   }rows.push({hz,kind,turn,travel,vertical,accel});
  }return rows;
 });
 console.log('FISH_CONTINUITY',JSON.stringify(rows));
 for(const r of rows){expect(r.turn,`${r.kind} ${r.hz} Hz turn`).toBeLessThanOrEqual(1.801);expect(r.travel).toBeLessThanOrEqual(2.6);expect(r.vertical).toBeLessThanOrEqual(.36);expect(r.accel).toBeLessThanOrEqual(3.01);}
 expect((await state(page)).ocean.fish).toBeGreaterThan(0);
});

test('fish decline occupied spawn positions and place coastal schools above the actual seabed',async({page})=>{
 await setup(page);const r=await page.evaluate(async()=>{
  const g=__game,o=g.ocean,T=await import('/src/level/Terrain.js');o.clearFish();const solid=g.voxels.physicalSolidAtWorld;g.voxels.physicalSolidAtWorld=()=>true;o.addFish('fish-blue',{x:-850,z:0},0);const blocked=o.fish.length;g.voxels.physicalSolidAtWorld=solid;o.clearFish();
  const samples=[];for(let x=-750;x<-550;x+=10)for(let z=-50;z<=50;z+=10){const y=T.surfaceHeight(x,z);if(y<-5&&y>-9){o.addFish('fish-blue',{x,z},0);const f=o.fish.at(-1);if(f)samples.push({gap:f.mesh.position.y-T.surfaceHeight(f.mesh.position.x,f.mesh.position.z),y:f.mesh.position.y});o.clearFish();}}
  return{blocked,samples};
 });console.log('FISH_SPAWN',JSON.stringify(r));expect(r.blocked).toBe(0);expect(r.samples.length).toBeGreaterThan(0);for(const s of r.samples){expect(s.gap).toBeGreaterThanOrEqual(1.19);expect(s.y).toBeLessThanOrEqual(-1);}
});

test('blue fish steer around real submerged voxels without body penetration or a stalled escape',async({page})=>{
 await setup(page);const rows=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js'),g=__game,o=g.ocean,s=.22;for(let x=Math.floor(-851.2/s);x<=Math.ceil(-848.8/s);x++)for(let y=Math.floor(-8/s);y<=Math.ceil(-2/s);y++)g.voxels.setEdit(x,y,Math.floor(2/s),6);
  const rows=[];for(const hz of [30,60,120]){
   o.clearFish();o.addFish('fish-blue',{x:-850,z:0},0);const f=o.fish[0];f.mesh.position.set(-850,-5,0);f.mesh.rotation.y=f.motion.yaw=0;f.motion.speed=1;f.home={x:-850,z:2};f.phase=0;f.depth=-5;
   g.jimothy.body.position.set(-850,-5,-8);g.jimothy.postUpdate(0);o.habitat={x:-850,z:-8};let intersections=0,turn=0;
   for(let i=0;i<hz*12;i++){const yaw=f.mesh.rotation.y;o.update(1/hz);turn=Math.max(turn,Math.abs(Math.atan2(Math.sin(f.mesh.rotation.y-yaw),Math.cos(f.mesh.rotation.y-yaw)))*hz);if(i%3===0){f.mesh.updateMatrixWorld(true);f.visual.traverse(m=>{if(!m.isSkinnedMesh)return;m.skeleton.update();const a=m.geometry.attributes.position;for(let v=0;v<a.count;v++){const p=m.applyBoneTransform(v,new THREE.Vector3().fromBufferAttribute(a,v)).applyMatrix4(m.matrixWorld);if(g.voxels.physicalSolidAtWorld(p.x,p.y,p.z))intersections++;}});}}
   rows.push({hz,intersections,turn,distance:Math.hypot(f.mesh.position.x+850,f.mesh.position.z),z:f.mesh.position.z});
  }return rows;
 });console.log('FISH_WALL',JSON.stringify(rows));for(const r of rows){expect(r.intersections).toBe(0);expect(r.turn).toBeLessThanOrEqual(1.801);expect(r.distance).toBeGreaterThan(4);expect(r.z).toBeGreaterThan(2.3);}
});

test('near and distant schools animate every frame and keep physics ownership through reset',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  const g=__game,o=g.ocean;g.jimothy.body.position.set(-850,-5,0);g.jimothy.postUpdate(0);o.populateHabitat();const distant=o.fish.at(-1);distant.mesh.position.set(-800,-5,0);distant.home={x:-800,z:0};distant.depth=-5;const times=[];let worstGap=0,clockError=0,shapeGap=0;
  for(let i=0;i<180;i++){
   const before=o.fish.map(f=>[f,f.mixer.time]);const start=performance.now();o.update(1/60);times.push(performance.now()-start);g.physics.update(1/60);
   for(const [f,t] of before){clockError=Math.max(clockError,Math.abs(f.mixer.time-t-1/60));const actor=g.physics.actors.get(f.id);if(actor?.active)worstGap=Math.max(worstGap,actor.body.position.distanceTo(f.mesh.position));}
  }
  for(const f of o.fish){const ext=g.physics.actors.get(f.id)?.body.shapes[0].halfExtents;if(ext)for(const axis of ['x','y','z'])shapeGap=Math.max(shapeGap,Math.abs(ext[axis]-Math.max(.1,Math.min(1.6,f.half[axis]-.08))));}
  const count=o.fish.length,ids=o.fish.map(f=>f.id);o.reset();times.sort((a,b)=>a-b);return{count,worstGap,clockError,shapeGap,left:ids.filter(id=>g.physics.actors.has(id)).length,median:times[90],p95:times[171],snapshot:o.snapshot()};
 });console.log('FISH_OWNERSHIP_COST',JSON.stringify(r));expect(r.count).toBe(13);expect(r.clockError).toBeLessThan(1e-6);expect(r.worstGap).toBeLessThan(.1);expect(r.shapeGap).toBeLessThan(.02);expect(r.left).toBe(0);expect(r.snapshot.fish).toBe(0);
});
