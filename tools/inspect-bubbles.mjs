import {chromium} from 'playwright';import fs from 'node:fs/promises';
const folder='output/iterate/bubble-native';await fs.mkdir(folder,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal','--disable-audio-output']}),errors=[],rows=[];
try{
 const page=await browser.newPage({viewport:{width:1100,height:700}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.addInitScript(()=>{__MANUAL_TIME__=true;__SKIP_ARRIVAL__=true;});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');
 await page.waitForFunction(()=>window.__game?.ocean.ready&&__game.jimothy.rig.loaded&&__game.streetLife.ready,null,{timeout:120000});await page.evaluate(()=>{advanceTime(.1);__STATE_ONLY_TEST__=true;__game.freeCamera=true;__game.dayNight.setHour(14);});
 for(const fat of [0,60,250]){
  await page.evaluate(fat=>{const g=__game,j=g.jimothy;setFatness(fat);teleportJimothy(-900,0);j.body.position.y=-j.radius-5;j._prevFeetY=undefined;j.diving=j.swimming=true;j.postUpdate(0);g.ocean.bubbles=[];g.ocean.bubbleClock=0;},fat);
  for(let frame=0;frame<151;frame++){
   const r=await page.evaluate(frame=>{
    const g=__game,j=g.jimothy,dt=1/30,speed=frame<90?1.2:0;j.vel.set(speed,0,0);j.body.position.x+=speed*dt;j.elapsed+=dt;j.postUpdate(0);g.water.update(dt);g.ocean.update(dt);
    const target=j.rig.bellyBox().getCenter(j.group.position.clone()),distance=Math.max(3,j.radius*2.2);target.y=Math.min(-1,target.y);g.camera.position.copy(target).add(target.clone().set(-distance,Math.min(1,-.7-target.y),distance));if(frame===150&&j.radius>10){const point=g.ocean.bubbles.find(p=>p.source==='player'&&p.y< -2);if(point){target.copy(point);g.camera.position.copy(target).add(target.clone().set(-8,1,8));}}g.camera.fov=48;g.camera.updateProjectionMatrix();g.camera.lookAt(target);g.ocean.afterCamera();g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});g.renderer.render(g.scene,g.camera);
    const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);const s=JSON.parse(render_game_to_text());return{png:canvas.toDataURL(),bubbles:s.ocean.bubbles,underwater:s.ocean.underwater,bodyY:s.jimothy.bodyY,radius:j.radius};
   },frame);
   if([0,30,89,149,150].includes(frame))await fs.writeFile(`${folder}/fat-${fat}-frame-${frame}.png`,Buffer.from(r.png.split(',')[1],'base64'));delete r.png;rows.push({fat,frame,...r});
  }
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,rows},null,2));console.log('RESULT',JSON.stringify({errors,rows:rows.filter(r=>r.frame===149)}));
}finally{await browser.close();}
