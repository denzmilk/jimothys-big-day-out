import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;localStorage.setItem('jimothy-graphics','medium');});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:4174');await page.waitForFunction(()=>window.__game?.jimothy.rig.loaded&&__game.pedestrians.ready&&__game.streetLife.ready,undefined,{timeout:120000});
 await page.evaluate(()=>{const g=__game;g.renderer.setAnimationLoop(null);window.__STATE_ONLY_TEST__=true;advanceTime(.2);const d=g.driving,s=g.streetLife;d.syncDrivers();const p=[...d.cars.values()].find(p=>d.drivers.has(p.id)&&p.seed%6===0)||[...d.cars.values()].find(p=>d.drivers.has(p.id));window.inspectCar=p;for(const q of s.items)q.driving=false;const road=s.routes.roads.find(r=>r.length>70&&Math.hypot(r.start.x,r.start.z)<100);s.assignRoute(p,road,road.length*.35);p.driving=false;p.route.speed=0;const at=d.exitPoint(p,g.jimothy.radius);teleportJimothy(at.x,at.z);advanceTime(.2);g.voxels.processGeneration();g.voxels.remeshDirty();g.freeCamera=true;g.dayNight.setHour(14);});
 const report={errors,views:[]};
 for(const phase of ['occupied','boarding','seated','follow','exit']){
  if(phase==='boarding'){await page.locator('canvas').first().focus();await page.keyboard.press('y');await page.evaluate(()=>advanceTime(.45));}
  if(phase==='seated')await page.evaluate(()=>advanceTime(1.2));
  if(phase==='exit'){await page.keyboard.press('y');await page.evaluate(()=>advanceTime(.3));}
  const r=await page.evaluate(phase=>{const g=__game,p=inspectCar;if(phase==='follow'){g.freeCamera=false;g.cameraSystem.yaw=p.yaw;g.cameraSystem.snapToTarget();}else{g.camera.position.set(p.mesh.position.x+5,p.mesh.position.y+2,p.mesh.position.z+5);g.camera.lookAt(p.mesh.position);}g.renderer.render(g.scene,g.camera);const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);return {png:canvas.toDataURL(),state:JSON.parse(render_game_to_text()),car:{half:p.half,model:p.seed%6,at:p.mesh.position.toArray()}};},phase);
  await fs.writeFile(`output/iterate/driving-${phase}.png`,Buffer.from(r.png.split(',')[1],'base64'));delete r.png;r.hud=await page.locator('#driving-hud').evaluate(el=>({visible:!el.hidden,text:el.textContent,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));report.views.push({phase,...r});if(phase==='follow')await page.screenshot({path:'output/iterate/driving-follow-hud.png'});
 }
 await fs.writeFile('output/iterate/driving-visual.json',JSON.stringify(report,null,2));console.log(JSON.stringify({errors,views:report.views.map(v=>({phase:v.phase,driving:v.state.driving,car:v.car}))}));
}finally{await browser.close();}
