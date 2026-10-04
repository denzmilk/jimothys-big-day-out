import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;localStorage.setItem('jimothy-graphics','medium');});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:4174');await page.waitForFunction(()=>__game.jimothy.rig.loaded&&__game.pedestrians.ready&&__game.streetLife.ready,undefined,{timeout:120000});
 await page.evaluate(()=>{
  const g=__game;g.renderer.setAnimationLoop(null);window.__STATE_ONLY_TEST__=true;advanceTime(.2);const d=g.driving,s=g.streetLife;
  const p=s.items.find(p=>p.kind==='car'&&p.seed%6===4&&!p.fragment);window.inspectCar=p;for(const q of s.items)q.driving=false;
  const road=s.routes.roads.find(r=>r.length>70&&Math.hypot(r.start.x,r.start.z)<100);s.assignRoute(p,road,road.length*.35);p.driving=false;p.route.speed=0;
  const at=d.exitPoint(p,g.jimothy.radius);teleportJimothy(at.x,at.z);if(!d.enter(p))throw Error(d.reason);advanceTime(1.5);
  p.mesh.position.set(67.35,0,40);p.yaw=0;p.mesh.rotation.set(0,0,0);s.poseVehicle(p);d.playerPose();g.jimothy.postUpdate(0);g.dayNight.setHour(14);
  for(const q of [...s.items])if(q.kind==='car'&&q!==p&&Math.abs(q.mesh.position.x-67.35)<4&&q.mesh.position.z>35&&q.mesh.position.z<90)s.remove(q);
 });
 const report={errors,views:[]};
 for(const target of [60,65,75]){
  await page.evaluate(target=>{const g=__game,d=g.driving,p=inspectCar;g.input.codes.add('KeyW');let n=0;while(p.mesh.position.z<target&&d.car&&n++<100)advanceTime(.05);g.input.codes.clear();if(p.mesh.position.z<target)throw Error(`Stuck before ${target}: ${JSON.stringify(d.lastContact)}`);},target);
  const r=await page.evaluate(()=>{const g=__game,p=inspectCar;g.voxels.processGeneration();g.voxels.remeshDirty();g.camera.position.copy(p.mesh.position).add({x:10,y:4,z:5});g.camera.lookAt(p.mesh.position);g.renderer.shadowMap.needsUpdate=true;g.renderer.render(g.scene,g.camera);const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);return {png:canvas.toDataURL(),at:p.mesh.position.toArray(),grounding:p.grounding,driving:JSON.parse(render_game_to_text()).driving};});
  await fs.writeFile(`output/iterate/driving-steep-${target}.png`,Buffer.from(r.png.split(',')[1],'base64'));delete r.png;report.views.push(r);
 }
 await fs.writeFile('output/iterate/driving-steep-native.json',JSON.stringify(report,null,2));console.log(JSON.stringify({errors,views:report.views.map(v=>({at:v.at,speed:v.driving.speed,crashes:v.driving.crashes,gaps:v.grounding.wheelGaps}))}));
}finally{await browser.close();}
