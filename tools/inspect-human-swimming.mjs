import {chromium} from 'playwright';import fs from 'node:fs/promises';
const shore=process.env.SHORE_ONLY==='1',folder=shore?'output/iterate/human-swim-shore':'output/iterate/human-swim-native';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal','--disable-audio-output']}),errors=[],frames=[];
try{
 const page=await browser.newPage({viewport:{width:1100,height:700}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{__MANUAL_TIME__=true;__SKIP_ARRIVAL__=true;});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');
 await page.waitForFunction(()=>window.__game?.pedestrians.ready&&__game.jimothy.rig.loaded&&__game.streetLife.ready,null,{timeout:120000});
 await page.evaluate(()=>{
  advanceTime(.1);__STATE_ONLY_TEST__=true;const g=__game,s=g.pedestrians;teleportJimothy(-850,0);g.dayNight.setHour(14);g.freeCamera=true;g.camera.fov=45;g.camera.updateProjectionMatrix();
  for(const p of [...s.people])s._remove(p);s._graphAround(-850,0);s.populationPending=false;s.activities.enabled=false;
  window.swimmers=[0,3,5,10].map((model,i)=>{const p=s._spawn({x:-850+i*2,z:0,key:'inspection'},model);p.y=-1;p.mesh.position.set(p.x,p.y,p.z);return p;});
  for(let i=0;i<180;i++)s.update(1/60);
 });
 if(shore)await page.evaluate(()=>{
  const g=__game,s=g.pedestrians;g.freeCamera=false;teleportJimothy(69.0833333333,-697.4072751356);advanceTime(.4);g.freeCamera=true;
  for(const p of [...s.people])s._remove(p);s._graphAround(69,-697);s.populationPending=false;
  const p=s._spawn({x:69.0833333333,z:-697.4072751356,key:'shore-inspection'},0);p.y=-1;p.mesh.position.set(p.x,p.y,p.z);p.flee=100;window.swimmers=[p];
 });
 for(let frame=0;frame<(shore?360:180);frame++){
  const result=await page.evaluate(({frame,shore})=>{
   const g=__game;for(let i=0;i<(shore?3:1);i++){g.pedestrians.update(1/30);g.water.update(1/30);g.physics.update(1/30);g.dayNight.update(1/30,false);}
   const p=swimmers[shore?0:1],target=p.mesh.position.clone();target.y+=.8;g.camera.position.copy(target).add(target.clone().set(4,shore?2:frame<90?3:.1,5));g.camera.lookAt(target);g.ocean.afterCamera();g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});g.renderer.render(g.scene,g.camera);
   const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);
   return{png:canvas.toDataURL(),shoreActive:p.swimmer.active,waterDepth:g.water.heightAt(p.x,p.z)-p.y,snapshot:JSON.parse(render_game_to_text()).people};
  },{frame,shore});
  await fs.writeFile(`${folder}/frame-${String(frame).padStart(3,'0')}.png`,Buffer.from(result.png.split(',')[1],'base64'));delete result.png;frames.push({frame,...result});
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,frames},null,2));console.log('HUMAN_SWIM_NATIVE',JSON.stringify({errors,frames:frames.length,start:frames[0],end:frames.at(-1)}));
}finally{await browser.close();}
