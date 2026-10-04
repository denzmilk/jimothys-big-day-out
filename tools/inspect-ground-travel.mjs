import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;localStorage.setItem('jimothy-graphics','medium');});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:4174');await page.waitForFunction(()=>__game.jimothy.rig.loaded&&__game.pedestrians.ready,undefined,{timeout:120000});
 const report={errors,routes:[]};
 for(const direction of [1,-1]){
  await page.evaluate(direction=>{const g=__game;g.renderer.setAnimationLoop(null);window.__STATE_ONLY_TEST__=true;teleportJimothy(67.35,direction>0?40:74);faceJimothy(direction>0?0:Math.PI);g.dayNight.setHour(14);advanceTime(.2);},direction);
  const result=await page.evaluate(()=>{
   const g=__game,c=g.jimothy,start=c.body.position.clone();let air=0,error=0;g.input.codes.add('KeyW');
   for(let i=0;i<180;i++){advanceTime(1/60);if(!c.grounded)air++;error=Math.max(error,Math.abs(c.position.y-g.voxels.groundHeightAt(c.position.x,c.position.z,c.position.y+.1)));}
   g.input.codes.clear();const at=c.body.position.clone();g.voxels.processGeneration();g.voxels.remeshDirty();g.camera.position.copy(c.group.position).add({x:5,y:2,z:3});g.camera.lookAt(c.group.position);g.renderer.render(g.scene,g.camera);
   const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);
   return {air,error,travel:start.distanceTo(at),at:at.toArray(),snapshot:JSON.parse(render_game_to_text()),png:canvas.toDataURL()};
  });
  await fs.writeFile(`output/iterate/ground-travel-${direction}.png`,Buffer.from(result.png.split(',')[1],'base64'));delete result.png;report.routes.push({direction,...result});
 }
 await fs.writeFile('output/iterate/ground-travel-native.json',JSON.stringify(report,null,2));console.log(JSON.stringify({errors,routes:report.routes.map(({direction,air,error,travel,at})=>({direction,air,error,travel,at}))}));
}finally{await browser.close();}
