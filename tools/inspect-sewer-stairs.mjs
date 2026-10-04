import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']}),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;localStorage.setItem('jimothy-graphics','medium');});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>__game.jimothy.rig.loaded&&__game.pedestrians.ready,undefined,{timeout:120000});
 await page.evaluate(async()=>{const g=__game,{planSewerStairs}=await import('/src/level/SewerStairs.js');g.renderer.setAnimationLoop(null);window.__STATE_ONLY_TEST__=true;window.ST=await import('/node_modules/three/build/three.module.js');window.stairEntry=sewerEntrances().sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];window.stairPlan=planSewerStairs(stairEntry,g.voxels.terrain);teleportJimothy(stairEntry.x,stairEntry.z);advanceTime(.1);g.voxels.processGeneration();g.voxels.remeshDirty();g.dayNight.setHour(14);});
 const views=[];
 for(const [name,index] of [['entrance',0],['flight',7],['lower',24]]){
  const result=await page.evaluate(({name,index})=>{
   const g=__game,p=stairPlan.path[index],next=stairPlan.path[index+1],e=stairEntry,top=stairPlan.path[0].y;dropJimothy(p.x,p.z,p.y+g.jimothy.radius);g.jimothy.yaw=Math.atan2(next.x-p.x,next.z-p.z);g.jimothy.legs.reset();g.jimothy.postUpdate(0);advanceTime(.05);g.sewerLife.update(.1);g.voxels.remeshDirty();
   if(name==='entrance')g.camera.position.set(e.x+8,top+6,e.z+7);
   else {const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);g.camera.position.set(p.x+dx/d*1.3,p.y+1.1,p.z+dz/d*1.3);}
   g.camera.lookAt(p.x,p.y+.7,p.z);g.jimothy.cameraDist=Infinity;g.jimothy.postUpdate(0);g.scene.updateMatrixWorld(true);g.jimothy.rig.skinned.skeleton.update();g.renderer.shadowMap.needsUpdate=true;g.renderer.render(g.scene,g.camera);
   const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);return {name,at:p,group:g.jimothy.group.position.toArray(),box:new ST.Box3().setFromObject(g.jimothy.rig.root,true),stats:g.voxels.stats(),state:JSON.parse(render_game_to_text()),png:canvas.toDataURL()};
  },{name,index});
  await fs.writeFile(`output/iterate/sewer-stairs-${name}.png`,Buffer.from(result.png.split(',')[1],'base64'));delete result.png;views.push(result);
 }
 await fs.writeFile('output/iterate/sewer-stairs-native.json',JSON.stringify({errors,views},null,2));console.log(JSON.stringify({errors,views:views.map(v=>({name:v.name,at:v.at,group:v.group,box:v.box,grounded:v.state.jimothy.grounded,depth:v.state.underground.depth}))}));
}finally{await browser.close();}
