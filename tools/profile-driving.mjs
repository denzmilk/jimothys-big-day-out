import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';

// Keep this serial with other gameplay runs: CPU plus render submission is
// useful for regression diagnosis, but does not measure presented frame rate.
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']});
const report={method:'960x600 Medium, original rigs, live work budgets, serial 3-second samples at 30/60/120 Hz; CPU update plus render submission, not FPS.',errors:[],samples:[]};
try{
 for(const hz of [30,60,120]){
  const page=await browser.newPage({viewport:{width:960,height:600}});
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;localStorage.setItem('jimothy-graphics','medium');let seed=83;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:4174');
  await page.waitForFunction(()=>window.__game?.jimothy.rig.loaded&&['pedestrians','streetLife','interiors','tools','military','ocean','crabs','environmentLife'].every(k=>__game[k].ready),undefined,{timeout:120000});
  await page.evaluate(()=>{
   const g=__game;g.renderer.setAnimationLoop(null);window.__STATE_ONLY_TEST__=true;advanceTime(.2);const s=g.streetLife,d=g.driving;d.syncDrivers();const p=[...d.cars.values()].find(p=>d.drivers.has(p.id));
   for(const q of s.items)q.driving=false;const road=s.routes.roads.find(r=>r.length>70&&Math.hypot(r.start.x,r.start.z)<100);s.assignRoute(p,road,road.length*.25);p.driving=false;p.route.speed=0;const at=d.exitPoint(p,g.jimothy.radius);teleportJimothy(at.x,at.z);advanceTime(.2);g.voxels.processGeneration();g.voxels.remeshDirty();d.enter(p);advanceTime(1.5);if(d.phase!=='driving')throw Error('Profile failed to enter car');
   g.manualTime=false;g.dayNight.setHour(14);for(let i=0;i<120;i++){g.update(1/60);g.renderer.render(g.scene,g.camera);}g.renderer.getContext().finish();window.profileStart=p.mesh.position.clone();g.input.codes.add('KeyW');
  });
  const frames=[];
  for(let i=0;i<hz*3;i+=30)frames.push(...await page.evaluate(({count,hz})=>{
   const g=__game,rows=[];for(let i=0;i<count;i++){const t=performance.now();g.update(1/hz);const u=performance.now();g.renderer.render(g.scene,g.camera);rows.push({update:u-t,total:performance.now()-t,draws:g.renderer.info.render.calls,bodies:g.physics.world.bodies.length,effects:g.driving.effects.particles.length,speed:g.driving.speed,phase:g.driving.phase});}return rows;
  },{count:Math.min(30,hz*3-i),hz}));
  const final=await page.evaluate(()=>{const g=__game;g.input.codes.clear();return {travel:g.jimothy.position.distanceTo(profileStart),state:JSON.parse(render_game_to_text()),geometry:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};});
  const stats=key=>{const a=frames.map(r=>r[key]).sort((a,b)=>a-b);return {median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
  const summary={hz,frames:frames.length,movingFrames:frames.filter(f=>Math.abs(f.speed)>.1).length,travel:final.travel,update:stats('update'),total:stats('total'),draws:stats('draws'),bodies:stats('bodies'),effects:stats('effects')};report.samples.push({summary,frames,final});console.log(JSON.stringify(summary));await page.close();
 }
}finally{await browser.close();await fs.writeFile('output/iterate/driving-performance.json',JSON.stringify(report,null,2));}
process.exitCode=report.errors.length?1:0;
