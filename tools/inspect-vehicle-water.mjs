import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;localStorage.setItem('jimothy-graphics','medium');});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:4174');await page.waitForFunction(()=>__game.jimothy.rig.loaded&&__game.pedestrians.ready&&__game.streetLife.ready,undefined,{timeout:120000});
 await page.locator('canvas').first().focus();await page.keyboard.press('h');
 await page.evaluate(()=>{
  const g=__game;g.renderer.setAnimationLoop(null);window.__STATE_ONLY_TEST__=true;advanceTime(.2);const d=g.driving,s=g.streetLife,w=g.water;
  const p=s.items.find(p=>p.kind==='car'&&p.seed%6===4&&!p.fragment);window.waterCar=p;for(const q of s.items)q.driving=false;
  const road=s.routes.roads.find(r=>r.length>70&&Math.hypot(r.start.x,r.start.z)<100);s.assignRoute(p,road,road.length*.35);p.driving=false;p.route.speed=0;
  const at=d.exitPoint(p,g.jimothy.radius);teleportJimothy(at.x,at.z);if(!d.enter(p))throw Error(d.reason);advanceTime(1.5);
  s.update=()=>{};g.voxels.streamAround(-850,0);p.yaw=0;p.mesh.rotation.set(0,0,0);p.grounding={pitch:0,bank:0};p.mesh.position.set(-850,w.heightAt(-850,0)+p.half[1]-.3,0);d.playerPose();w.reset();w.update(0);d.speed=14;d.update(1/60);g.dayNight.setHour(14);
 });
 await page.waitForTimeout(80);
 const report={errors,audio:await page.evaluate(()=>__game.driving.effects.audioSnapshot()),views:[]};
 for(const dt of [.08,.2,.35]){
  const r=await page.evaluate(dt=>{const g=__game,p=waterCar;advanceTime(dt);g.voxels.processGeneration();g.voxels.remeshDirty();g.camera.position.set(-840,6,10);g.camera.lookAt(-850,1,3);g.renderer.shadowMap.needsUpdate=true;g.renderer.render(g.scene,g.camera);const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);return {png:canvas.toDataURL(),at:p.mesh.position.toArray(),water:g.water.snapshot(),driving:JSON.parse(render_game_to_text()).driving};},dt);
  await fs.writeFile(`output/iterate/vehicle-water-${dt}.png`,Buffer.from(r.png.split(',')[1],'base64'));delete r.png;report.views.push(r);
 }
 await fs.writeFile('output/iterate/vehicle-water-native.json',JSON.stringify(report,null,2));console.log(JSON.stringify({errors,audio:report.audio,views:report.views.map(v=>({at:v.at,water:v.water,phase:v.driving.phase}))}));
}finally{await browser.close();}
