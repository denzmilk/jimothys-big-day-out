import {chromium} from 'playwright';import fs from 'node:fs/promises';
const folder=process.env.CAPTURE_FOLDER||'output/iterate/local-response-native';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']}),errors=[],frames=[];
try{
 const page=await browser.newPage({viewport:{width:1100,height:700}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>window.__game?.jimothy.rig.loaded&&__game.pedestrians.ready&&__game.streetLife.ready&&__game.pursuers.response.ready,undefined,{timeout:120000});
 await page.evaluate(async()=>{advanceTime(.1);window.__STATE_ONLY_TEST__=true;const {PAPARAZZI,LOCAL_RESPONSE}=await import('/src/core/Constants.js');PAPARAZZI.COUNT_TIER1=PAPARAZZI.COUNT_TIER2=LOCAL_RESPONSE.COUNT=0;});
 for(const kind of ['paparazzo','angry-local']){
  await page.evaluate(async kind=>{
   restartGame();advanceTime(.1);const g=__game,ai=g.pursuers,{gameState}=await import('/src/core/GameState.js');ai.reset();
   const sites=[];for(let x=-24;x<=24;x+=3)for(let z=-24;z<=24;z+=3){const h=g.voxels.terrainHeightAt(x,z),other=g.voxels.terrainHeightAt(x,z-1);if(Math.abs(h-other)<.04&&!g.voxels.physicalSolidAtWorld(x,h+1,z)&&!g.voxels.physicalSolidAtWorld(x,other+1,z-1))sites.push({x,z});}sites.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));teleportJimothy(sites[0].x,sites[0].z);advanceTime(.1);
   const j=g.jimothy.position,id=spawnPursuerAt(kind,j.x,j.z-(kind==='paparazzo'?2.8:1)),p=ai.all.find(p=>p.id===id);p.group.position.y=ai._groundY(p.group.position.x,p.group.position.z);p.group.rotation.y=0;p.state='chase';p.sees=true;p.awareness=1;p.target={x:j.x,z:j.z};p.lastKnown={...p.target};p.flashCooldown=0;p.grounding.reset();window.actor=p;
   gameState.heat.points=kind==='paparazzo'?10:20;ai.globalFlashCooldown=0;g.heat._retier();g.freeCamera=true;g.dayNight.setHour(14);g.camera.fov=48;g.camera.updateProjectionMatrix();g.camera.position.set(p.group.position.x+3.3,p.group.position.y+2.1,p.group.position.z+3);g.camera.lookAt(p.group.position.x,p.group.position.y+.9,p.group.position.z+(kind==='paparazzo'?1.2:.5));
  },kind);
  const count=kind==='paparazzo'?40:150;
  for(let frame=0;frame<count;frame++){
   const r=await page.evaluate(()=>{advanceTime(1/30);const g=__game,p=actor;g.scene.updateMatrixWorld(true);g.jimothy.rig.skinned.skeleton.update();p.visual.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});g.renderer.render(g.scene,g.camera);const c=document.createElement('canvas');c.width=g.renderer.domElement.width;c.height=g.renderer.domElement.height;c.getContext('2d').drawImage(g.renderer.domElement,0,0);const s=JSON.parse(render_game_to_text()),at=p.group.position.clone();return{png:c.toDataURL(),people:g.pedestrians.people.filter(q=>q.mesh.position.distanceTo(p.group.position)<8).map(q=>({id:q.id,model:q.model,activity:q.activity?.kind,phase:q.activity?.phase,driver:q.vehicleSeat,wasDriver:q.wasDriver,position:q.mesh.position.toArray(),ground:g.voxels.terrainHeightAt(q.x,q.z),visual:q.visual.position.toArray(),rotation:q.visual.quaternion.toArray()})),response:s.response,ragdoll:s.jimothy.ragdoll,phase:p.kick?.phase,time:p.kick?.time,flash:p.photoLeft,foot:p.visual.getObjectByName('foot_r').getWorldPosition(at).toArray(),finite:p.visual.matrixWorld.elements.every(Number.isFinite)};});
   if([0,4,6,8,12,18,22,28,35,45,75,149].includes(frame))await fs.writeFile(`${folder}/${kind}-${String(frame).padStart(3,'0')}.png`,Buffer.from(r.png.split(',')[1],'base64'));delete r.png;frames.push({kind,frame,...r});
  }
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,frames},null,2));console.log(JSON.stringify({errors,photos:Math.max(...frames.map(f=>f.response.photos)),hits:Math.max(...frames.map(f=>f.response.hits)),physical:frames.some(f=>f.ragdoll.phase==='physical'),last:frames.at(-1)}));
}finally{await browser.close();}
