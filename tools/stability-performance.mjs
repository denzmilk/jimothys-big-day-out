import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

// Run after the functional suite, with no concurrent gameplay tests. Keep
// shader startup separate from warmed updates; submission time is not FPS.
const option=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const url=option('url','http://127.0.0.1:3000'),output=option('output','output/iterate/stability-performance');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']});
const report={url,started:new Date().toISOString(),method:'960x600, Medium, original rig, 60 Hz simulation, live work budgets. CPU update and render submission; not presented FPS.',errors:[],scenarios:[]};
try{
 for(const scenario of [{name:'street',fat:0,x:0,z:0,frames:180},{name:'underwater',fat:0,x:-850,z:0,frames:180},{name:'giant-roll',fat:400,x:-2,z:-40,frames:150,keys:['c']}].filter(s=>!option('scenario','')||s.name===option('scenario',''))){
  const context=await browser.newContext({viewport:{width:960,height:600}}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;localStorage.setItem('jimothy-graphics','medium');let seed=83;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});
  await page.goto(url);await page.waitForFunction(()=>window.__game&&__game.jimothy.rig.loaded&&['pedestrians','streetLife','interiors','tools','landmarks','military','ocean','crabs','environmentLife'].every(k=>__game[k].ready),undefined,{timeout:120000});
  const start=await page.evaluate(s=>{
   const g=__game;g.renderer.setAnimationLoop(null);g.manualTime=false;g.quality.set('medium',false);g.dayNight.setHour(14);setFatness(s.fat);teleportJimothy(s.x,s.z);faceJimothy(0);
   if(s.name==='underwater'){g.jimothy.body.position.y=-6;g.jimothy.diving=true;g.jimothy.postUpdate(0);g.cameraSystem.snapToTarget();}
   const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),first=performance.now();g.renderer.render(g.scene,g.camera);gl.finish();const firstRenderMs=performance.now()-first;
   for(let i=0;i<120;i++){g.update(1/60);g.renderer.render(g.scene,g.camera);}gl.finish();
   window.__perfParts={};for(const [name,method]of [['streetLife','update'],['physics','update'],['pedestrians','update'],['structuralSupport','update'],['interiors','update'],['environmentLife','update'],['radar','update'],['voxels','processDamage'],['voxels','processGeneration'],['voxels','remeshDirty']]){
    const obj=g[name],original=obj[method].bind(obj),key=`${name}.${method}`;__perfParts[key]=[];obj[method]=(...args)=>{const t=performance.now(),r=original(...args);__perfParts[key].push(performance.now()-t);return r;};
   }
   return{firstRenderMs,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,position:g.jimothy.position.toArray()};
  },scenario);
  for(const key of scenario.keys||[])await page.keyboard.down(key);
  const frames=[];
  for(let i=0;i<scenario.frames;i+=30){frames.push(...await page.evaluate(count=>{
   const g=__game,rows=[];for(let i=0;i<count;i++){const t=performance.now();g.update(1/60);const u=performance.now();g.renderer.render(g.scene,g.camera);const end=performance.now();rows.push({updateMs:u-t,submissionMs:end-u,totalMs:end-t,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,bodies:g.physics.world.bodies.length,pendingMeshes:g.voxels.stats().pendingMeshes,queuedDamage:g.voxels.damageQueue.length});}return rows;
  },Math.min(30,scenario.frames-i)));}
  for(const key of scenario.keys||[])await page.keyboard.up(key);
  const final=await page.evaluate(()=>{
   const g=__game;g.renderer.render(g.scene,g.camera);const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);
   return{png:canvas.toDataURL(),parts:__perfParts,state:JSON.parse(render_game_to_text()),position:g.jimothy.position.toArray()};
  });
  await fs.writeFile(path.join(output,`${scenario.name}.png`),Buffer.from(final.png.split(',')[1],'base64'));delete final.png;
  const stats=values=>{const a=values.toSorted((a,b)=>a-b);return{median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
  const summary={name:scenario.name,frames:frames.length,travel:Math.hypot(final.position[0]-start.position[0],final.position[2]-start.position[2]),updateMs:stats(frames.map(f=>f.updateMs)),submissionMs:stats(frames.map(f=>f.submissionMs)),totalMs:stats(frames.map(f=>f.totalMs)),calls:stats(frames.map(f=>f.calls)),bodies:stats(frames.map(f=>f.bodies)),parts:Object.fromEntries(Object.entries(final.parts).map(([k,a])=>[k,stats(a)]))};
  if(scenario.name==='street')report.foliageShadowRefresh=await page.evaluate(()=>{
   const g=__game,gl=g.renderer.getContext(),rows=[];
   // Compare the repaired casters in the same warmed scene. Forced refresh
   // plus finish measures this pass's cost, not the usual five-Hz cadence.
   for(const enabled of [true,false,true]){
    for(const b of g.environmentLife.batches)b.mesh.castShadow=enabled;
    const times=[];for(let i=0;i<36;i++){g.renderer.shadowMap.needsUpdate=true;const t=performance.now();g.renderer.render(g.scene,g.camera);gl.finish();if(i>=6)times.push(performance.now()-t);}
    times.sort((a,b)=>a-b);rows.push({enabled,median:times[15],p95:times[28],max:times.at(-1),calls:g.renderer.info.render.calls});
   }return rows;
  });
  report.scenarios.push({scenario,start,summary,frames,final});console.log(JSON.stringify(summary));await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));await context.close();
 }
}catch(error){report.errors.push(String(error));}
finally{await browser.close();report.finished=new Date().toISOString();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
process.exitCode=report.errors.length?1:0;
