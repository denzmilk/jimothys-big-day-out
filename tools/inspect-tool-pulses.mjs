import {chromium} from 'playwright';import fs from 'node:fs/promises';
const folder=process.env.OUTPUT_DIR||'output/iterate/tool-pulses-native';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal','--disable-audio-output']}),errors=[],views=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{__MANUAL_TIME__=true;__SKIP_ARRIVAL__=true;});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>window.__game?.tools.ready&&__game.jimothy.rig.loaded&&__game.pedestrians.ready&&__game.streetLife.ready,null,{timeout:120000});await page.keyboard.press('Shift');
 for(const id of (process.env.TOOL?[process.env.TOOL]:['air-horn','disco-ray','sick-ray'])){
  await page.evaluate(async ({id,hour,fat})=>{
   restartGame();advanceTime(.3);__STATE_ONLY_TEST__=true;const g=__game,t=g.tools,j=g.jimothy,p=g.pedestrians.people.find(p=>!p.vehicleSeat&&!p.attached&&!p.ragdoll&&Math.hypot(p.x,p.z)<45);window.subject=p;
   teleportJimothy(p.x,p.z-5);advanceTime(.1);setFatness(fat);j.postUpdate(0);g.dayNight.setHour(hour);g.freeCamera=true;g.camera.fov=55;g.camera.updateProjectionMatrix();t.equip(t.pickups.find(p=>p.type===id));(await import('/src/core/GameState.js')).gameState.tools.energy=100;
   const target=p.mesh.position.clone();target.y+=.9;t.aimOverride=target.clone().sub(j.body.position).normalize();if(fat)t.aimOverride={x:0,y:.35,z:1};else for(let i=0;i<4;i++){t.pose();t.aimOverride=target.clone().sub(t.muzzle()).normalize();}t.pose();j.yaw=Math.atan2(t.aimOverride.x,t.aimOverride.z);j.postUpdate(0);
   const focus=fat?t.muzzle().addScaledVector(t.direction(),3):j.position.clone().lerp(p.mesh.position,.5);focus.y+=1;g.camera.position.copy(focus).add(focus.clone().set(7,3,3));g.camera.lookAt(focus);
  },{id,hour:Number(process.env.HOUR||14),fat:Number(process.env.FAT||0)});
  await page.keyboard.down('v');
  for(let frame=0;frame<36;frame++){
   if(frame===18)await page.keyboard.up('v');
   const r=await page.evaluate(()=>{const g=__game;advanceTime(1/30);g.ocean.afterCamera();g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});g.renderer.render(g.scene,g.camera);const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);return{png:canvas.toDataURL(),pulse:g.tools.snapshot().pulses,subject:{id:subject.id,attached:subject.attached,kind:g.tools.statuses.get(subject.id)?.kind}};});
   await fs.writeFile(`${folder}/${id}-${String(frame).padStart(2,'0')}.png`,Buffer.from(r.png.split(',')[1],'base64'));if([2,6,24].includes(frame)){await page.screenshot({path:`${folder}/${id}-hud-${frame}.png`});views.push({id,frame,pulse:r.pulse,subject:r.subject});}
  }
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,views},null,2));console.log(JSON.stringify({errors,views:views.map(v=>({id:v.id,frame:v.frame,pulses:v.pulse.count,marks:v.pulse.marks,subject:v.subject}))}));
}finally{await browser.close();}
