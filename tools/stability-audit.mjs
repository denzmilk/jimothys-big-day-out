import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

// Run mixed systems together with repeatable input seeds. The existing specs
// prove individual behaviours; this catches state/lifetime failures between them.
const option=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')??fallback;
const url=option('url','http://127.0.0.1:3000'),output=option('output','output/iterate/stability-soak');
const seeds=option('seeds','7,29,83').split(',').map(Number),results={url,seeds,started:new Date().toISOString(),timingNote:'CPU update samples and separate render submissions; run alone for performance comparisons. This does not measure presented FPS.',runs:[]};
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const save=()=>fs.writeFile(path.join(output,'report.json'),JSON.stringify(results,null,2));
try{
 for(const [runIndex,seed]of seeds.entries()){
  const context=await browser.newContext({viewport:{width:960,height:600}}),page=await context.newPage();
  const run={seed,quality:['low','medium','high'][runIndex%3],errors:[],warnings:[],requests:[],phases:[],resets:[]};results.runs.push(run);
  page.on('pageerror',e=>run.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')run.errors.push(m.text());if(m.type()==='warning')run.warnings.push(m.text());});
  page.on('requestfailed',r=>run.requests.push({url:r.url(),error:r.failure()?.errorText}));
  await page.addInitScript(({seed,quality})=>{
   window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;let value=seed;
   Math.random=()=>((value=Math.imul(value,1664525)+1013904223>>>0)/4294967296);
   localStorage.setItem('jimothy-graphics',quality);
  },{seed,quality:run.quality});
  try{
   await page.goto(url);await page.waitForFunction(()=>window.__game&&['pedestrians','interiors','trashCans','streetLife','environmentLife','tools','ocean','crabs','military','landmarks'].every(k=>__game[k].ready)&&__game.jimothy.rig.loaded,undefined,{timeout:120000});
   run.renderer=await page.evaluate(async()=>{
    const g=__game;g.renderer.setAnimationLoop(null);g.manualTime=false;g.quality.set(window.localStorage.getItem('jimothy-graphics'),false);
    window.__auditState=(await import('/src/core/GameState.js')).gameState;window.__auditConstants=await import('/src/core/Constants.js');window.__auditEvents=await import('/src/core/EventBus.js');
    const gl=g.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    window.__auditProbe=()=>{
     const g=__game,C=__auditConstants,problems=[],bodies=g.physics.world.bodies;
     for(const b of bodies){if(![b.position.x,b.position.y,b.position.z,b.velocity.x,b.velocity.y,b.velocity.z,b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w].every(Number.isFinite))problems.push(`nonfinite-body:${b.id}`);if(b.position.y<-C.TERRAIN.SEABED_DEPTH-C.TERRAIN.DEPTH-30)problems.push(`escaped-body:${b.id}`);}
     for(const [id,p]of g.physics.props)if(p.active!==!!p.body.world)problems.push(`prop-ownership:${id}`);
     if(new Set(g.physics.dynamic).size!==g.physics.dynamic.length)problems.push('duplicate-dynamic-body');
     if(new Set(g.collector.attached.map(e=>e.id)).size!==g.collector.attached.length)problems.push('duplicate-carried-entity');
     let meshes=0;g.scene.traverse(o=>{if(o.isMesh)meshes++;if(![o.position.x,o.position.y,o.position.z,o.quaternion.x,o.quaternion.y,o.quaternion.z,o.quaternion.w,o.scale.x,o.scale.y,o.scale.z].every(Number.isFinite))problems.push(`nonfinite-node:${o.name||o.type}`);});
     const limits={sections:[g.structuralSupport.fragments.length,C.SUPPORT.SECTION_LIMIT],debris:[g.debris.liveCount,C.DEBRIS.MAX],glass:[g.glassShards.items.length,C.GLASS_SHARDS.MAX],actors:[g.physics.actors.size,C.RUBBLE.ACTOR_LIMIT],carried:[g.collector.attached.length,C.COLLECTION.CAPACITY],tools:[g.tools.devices.length,C.TOOLS.DEVICE_LIMIT],fish:[g.ocean.fish.length,C.OCEAN.FISH_LIMIT]};
     for(const [key,[count,limit]]of Object.entries(limits))if(count>limit)problems.push(`over-budget:${key}:${count}>${limit}`);
     const fastBodies=bodies.filter(b=>b.velocity.length()>100).toSorted((a,b)=>b.velocity.length()-a.velocity.length()).slice(0,5).map(b=>({id:b.id,entity:b._actor?.id||[...g.physics.props.values()].find(p=>p.body===b)?.entity.id,type:b.type,speed:b.velocity.length()}));
     const p=g.jimothy.body.position;return{problems,limits,bodies:bodies.length,dynamic:g.physics.dynamic.length,actors:g.physics.actors.size,props:g.physics.props.size,registry:g.collector.entities.size,carried:g.collector.attached.length,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures,programs:g.renderer.info.programs.length,meshes,position:[p.x,p.y,p.z],speed:g.jimothy.vel.length(),maxBodySpeed:Math.max(0,...bodies.map(b=>b.velocity.length())),maxActorSpeed:Math.max(0,...bodies.filter(b=>b._actor).map(b=>b.velocity.length())),maxDynamicSpeed:Math.max(0,...g.physics.dynamic.map(b=>b.velocity.length())),fastBodies,queuedDamage:g.voxels.damageQueue.length,pendingMeshes:g.voxels.stats().pendingMeshes,playing:__auditState.game.isPlaying,netted:__auditState.game.netted,heat:__auditState.heat.tier,fat:__auditState.player.fatness};
    };
    return{vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,userAgent:navigator.userAgent};
   });
   const phase=async(label,seconds,keys=[],hz=60)=>{
    if(!await page.evaluate(()=>__auditState.game.isPlaying)){
     run.errors.push(`game-ended-before-phase:${label}`);
     await page.evaluate(()=>restartGame());
    }
    for(const key of keys)await page.keyboard.down(key);
    const samples=[];let remaining=seconds;
    while(remaining>1e-6){const duration=Math.min(2,remaining);samples.push(await page.evaluate(({duration,hz})=>{
     const g=__game,times=[];let elapsed=0;while(elapsed<duration-1e-8){const dt=Math.min(1/hz,duration-elapsed),t=performance.now();g.update(dt);times.push(performance.now()-t);elapsed+=dt;}
     const t=performance.now();g.renderer.render(g.scene,g.camera);g.renderer.render(g.scene,g.camera);const renderMs=performance.now()-t;
     return{times,renderMs,state:__auditProbe()};
    },{duration,hz}));remaining-=duration;}
    for(const key of keys)await page.keyboard.up(key);
    const values=samples.flatMap(s=>s.times).sort((a,b)=>a-b),last=samples.at(-1).state;
    const entry={label,seconds,hz,keys,frames:values.length,updateMs:{median:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],max:values.at(-1)},renderMs:samples.map(s=>s.renderMs),samples:samples.map(s=>s.state)};run.phases.push(entry);
    console.log(JSON.stringify({seed,label,seconds,problems:samples.flatMap(s=>s.state.problems),bodies:last.bodies,updateMs:entry.updateMs}));await save();
   };
   const teleport=async(x,z,fat=0,hour=14)=>page.evaluate(({x,z,fat,hour})=>{setFatness(fat);teleportJimothy(x,z);faceJimothy(0);__game.dayNight.setHour(hour);},{x,z,fat,hour});
   await phase('warmup',2);
   await phase('street-walk',4,['w'],30);await phase('scurry-turn',3,['w','d','Shift'],120);await phase('jump-headbutt',3,['w','Space','e'],60);
   const tools=await page.evaluate(()=>__game.tools.catalog.map(t=>t.id));run.tools=tools;
   for(const [index,id]of tools.entries()){
    await page.evaluate(({id,index})=>{const g=__game;setFatness(0);if(!__auditState.game.isPlaying)restartGame();__auditState.tools.energy=100;g.tools.equip(g.tools.pickups.find(p=>p.type===id));g.tools.cooldown=0;const p=g.pedestrians.people.find(p=>!p.attached&&!p.ragdoll);if(p){teleportJimothy(p.x,p.z-4);faceJimothy(0);g.tools.aimOverride={x:0,y:0,z:1};}if(index%4===0)g.trashCans.spawnFood('whole-pizza',g.jimothy.position.x,g.jimothy.position.z+3);},{id,index});
    const before=await page.evaluate(()=>__game.tools.shots);
    await phase(`tool:${id}`,1,['v'],[30,60,120][index%3]);
    if(await page.evaluate(()=>__game.tools.shots)<=before)run.errors.push(`tool-never-fired:${id}`);
   }
   await page.evaluate(()=>{__game.tools.drop();__game.tools.aimOverride=null;});
   const buildings=await page.evaluate(async()=>{const L=await import('/src/level/Layout.js'),near=L.buildingsIntersecting(-140,-140,140,140);return ['craftsman','apartment','shop'].map(type=>near.find(b=>b.type===type)).filter(Boolean).map(b=>({x:b.x+b.w/2,z:b.z+b.d/2,type:b.type}));});
   for(const b of buildings){await teleport(b.x,b.z);await phase(`building:${b.type}`,3,['w','e']);}
   await teleport(69,-3);await phase('sewer-entry-and-attack',5,['w','e'],30);
   await teleport(76,-717);await phase('beach-walk',3,['w'],120);
   await teleport(-850,0);await phase('water-entry',2);await phase('dive',3,['q','w']);await phase('swim-return',4,['Space','w'],30);
   const sites=await page.evaluate(()=>__game.landmarks.sites.map(s=>({id:s.id,x:s.x,z:s.z})));
   for(let i=0;i<6;i++){const site=sites[(runIndex*6+i)%sites.length];await teleport(site.x,site.z,0,[8,14,19,0][i%4]);await phase(`landmark:${site.id}`,2,[],[30,60,120][i%3]);}
   for(const fat of [25,90,250,400]){await teleport(-2,-40,fat,14);await phase(`roll:${fat}`,2,['c'],fat===400?30:60);await phase(`release:${fat}`,1);}
   await teleport(-2,-40,250,0);await page.evaluate(()=>{__auditState.heat.points=120;__game.heat._retier();});await phase('night-military',5,['w','e']);
   await page.evaluate(()=>{__game.quality.set('low',false);});await phase('quality-change-low',1);
   await page.evaluate(()=>{__game.quality.set('high',false);});await phase('quality-change-high',1);
   // Compare repeated identical restart states after the first warmed cycle.
   // Sample after GC so retained debug arrays do not masquerade as a game leak.
   const cdp=await context.newCDPSession(page);
   for(let i=0;i<5;i++){
    await page.evaluate(()=>{restartGame();__game.quality.set('medium',false);});await phase(`restart:${i}`,1);
    await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');
    run.resets.push({...await page.evaluate(()=>__auditProbe()),heapUsed:heap.usedSize});
   }
   const warm=run.resets[1],last=run.resets.at(-1);run.resetGrowth={bodies:last.bodies-warm.bodies,registry:last.registry-warm.registry,geometries:last.geometries-warm.geometries,textures:last.textures-warm.textures,heapBytes:last.heapUsed-warm.heapUsed};
   if(run.resetGrowth.bodies>10||run.resetGrowth.registry>10||run.resetGrowth.geometries>10||run.resetGrowth.textures>4)run.errors.push(`restart-resource-growth:${JSON.stringify(run.resetGrowth)}`);
   run.finalState=await page.evaluate(()=>JSON.parse(render_game_to_text()));
  }catch(e){run.errors.push(String(e));}
  finally{await save();await context.close();}
 }
}finally{await browser.close();results.finished=new Date().toISOString();await save();}
const failed=results.runs.some(r=>r.errors.length||r.requests.length||r.phases.some(p=>p.samples.some(s=>s.problems.length)));
console.log(JSON.stringify({output,failed,runs:results.runs.length,seconds:results.runs.flatMap(r=>r.phases).reduce((n,p)=>n+p.seconds,0)}));
process.exitCode=failed?1:0;
