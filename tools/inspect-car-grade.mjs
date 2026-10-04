import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';

const browser=await chromium.launch({channel:'chrome',headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;window.__SKIP_RIG__=true;localStorage.setItem('jimothy-graphics','medium');});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:4174');await page.waitForFunction(()=>window.__game?.streetLife.ready&&__game.pedestrians.ready,undefined,{timeout:120000});
 const at=await page.evaluate(()=>{const g=__game;g.renderer.setAnimationLoop(null);window.__STATE_ONLY_TEST__=true;advanceTime(.2);const p=g.streetLife.items.filter(p=>p.kind==='car'&&!p.driving&&!p.loose).sort((a,b)=>a.grounding.pitch-b.grounding.pitch)[0];window.gradeCarId=p.id;const at=[p.mesh.position.x+8,p.mesh.position.z-2];teleportJimothy(...at);advanceTime(.3);g.freeCamera=true;g.dayNight.setHour(14);return at;});
 const report={errors,views:[]};
 for(const phase of ['before','returned']){
  if(phase==='returned')await page.evaluate(at=>{teleportJimothy(420,-140);advanceTime(.2);teleportJimothy(...at);advanceTime(.3);},at);
  const r=await page.evaluate(()=>{
   const g=__game,p=g.streetLife.items.find(p=>p.id===gradeCarId);g.voxels.processGeneration();g.voxels.remeshDirty();
   g.camera.position.copy(p.mesh.position.clone().set(6,2.5,6).applyQuaternion(p.mesh.quaternion).add(p.mesh.position));g.camera.lookAt(p.mesh.position);g.renderer.shadowMap.needsUpdate=true;g.renderer.render(g.scene,g.camera);
   const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);
   return {png:canvas.toDataURL(),car:p.id,position:p.mesh.position.toArray(),yaw:p.yaw,wheels:p.mesh.children.filter(w=>w.userData.restY!==undefined).map(w=>({name:w.name,y:w.position.y,restY:w.userData.restY})),state:JSON.parse(render_game_to_text()).streetLife};
  });
  await fs.writeFile(`output/iterate/car-grade-native-${phase}.png`,Buffer.from(r.png.split(',')[1],'base64'));delete r.png;report.views.push({phase,...r});
 }
 await fs.writeFile('output/iterate/car-grade-native.json',JSON.stringify(report,null,2));console.log(JSON.stringify({errors,views:report.views.map(({phase,car,position,yaw})=>({phase,car,position,yaw}))}));
}finally{await browser.close();}
