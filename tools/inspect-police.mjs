import {chromium} from 'playwright';import fs from 'node:fs/promises';
const folder='output/iterate/police-native';await fs.mkdir(folder,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal','--disable-audio-output']}),errors=[],frames=[];
try{
 const page=await browser.newPage({viewport:{width:1100,height:700}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.addInitScript(()=>{__MANUAL_TIME__=true;__SKIP_ARRIVAL__=true;});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>__game?.jimothy.rig.loaded&&__game.pedestrians.ready&&__game.streetLife.ready&&__game.pursuers.response.gunsReady,undefined,{timeout:120000});
 await page.evaluate(async()=>{advanceTime(.1);__STATE_ONLY_TEST__=true;const g=__game,{gameState}=await import('/src/core/GameState.js');gameState.heat.points=500;gameState.heat.tier=4;g.police.spawn();g.driving.syncDrivers();g.freeCamera=true;g.dayNight.setHour(14);g.camera.fov=48;g.camera.updateProjectionMatrix();});
 await page.keyboard.press('h');
 for(const mode of ['car','officer']){
  await page.evaluate(async mode=>{
   const g=__game,{gameState}=await import('/src/core/GameState.js');
   if(mode==='car'){const p=g.police.units[0].car;g.camera.position.copy(p.mesh.position).add(p.mesh.position.clone().set(7,4,7));g.camera.lookAt(p.mesh.position);return;}
   const ai=g.pursuers;ai.reset();g.police.reset();teleportJimothy(-6,-6);const j=g.jimothy.position,id=spawnPursuerAt('police',j.x,j.z-5),p=ai.all.find(p=>p.id===id);p.group.position.y=ai._groundY(p.group.position.x,p.group.position.z);p.group.rotation.y=0;p.sees=true;p.state='chase';p.grounding.reset();window.actor=p;gameState.capture.phase='idle';gameState.heat.tier=4;
   g.camera.position.set(p.group.position.x+4,p.group.position.y+3.4,p.group.position.z+6);g.camera.lookAt(p.group.position.x,p.group.position.y+.8,p.group.position.z+2.3);
  },mode);
  for(let frame=0;frame<(mode==='car'?12:100);frame++){
   const r=await page.evaluate(({mode})=>{
    const g=__game,dt=1/30;if(mode==='car'){g.police.update(dt);g.driving.afterUpdate(dt);}else{const ai=g.pursuers,p=actor;p.sees=true;ai._animate(p,dt,p.group.position.x,p.group.position.z);p.responsePose.apply(dt,p.fire.target||g.jimothy.position);ai.response.gun(p,dt);ai.response.update(dt);g.jimothy.update(dt,g.cameraSystem.yaw,g.cameraSystem.aimPitch);g.physics.update(dt);g.jimothy.postUpdate(dt);}
    if(mode==='officer'){const middle=actor.group.position.clone().lerp(g.jimothy.position,.5);g.camera.position.copy(middle).add(middle.clone().set(8,7,10));g.camera.lookAt(middle);}
    g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});g.renderer.render(g.scene,g.camera);const c=document.createElement('canvas');c.width=g.renderer.domElement.width;c.height=g.renderer.domElement.height;c.getContext('2d').drawImage(g.renderer.domElement,0,0);const s=JSON.parse(render_game_to_text());return{png:c.toDataURL(),police:s.police,response:s.response,driver:s.driving.drivers,ragdoll:s.jimothy.ragdoll,body:g.jimothy.body.position,grounded:g.jimothy.grounded,phase:mode==='officer'?actor.fire.phase:null};
   },{mode});if([0,4,12,20,24,27,30,45,80,99].includes(frame))await fs.writeFile(`${folder}/${mode}-${String(frame).padStart(3,'0')}.png`,Buffer.from(r.png.split(',')[1],'base64'));delete r.png;frames.push({mode,frame,...r});
  }
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,frames},null,2));console.log(JSON.stringify({errors,shots:Math.max(...frames.map(f=>f.response.gunShots)),hits:Math.max(...frames.map(f=>f.response.gunHits))}));
}finally{await browser.close();}
