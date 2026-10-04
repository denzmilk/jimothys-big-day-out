import {chromium} from 'playwright';import fs from 'node:fs/promises';
const folder='output/iterate/fish-native';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal','--disable-audio-output']}),errors=[],frames=[];
try{
 const page=await browser.newPage({viewport:{width:1100,height:700}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{__MANUAL_TIME__=true;__SKIP_ARRIVAL__=true;});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');
 await page.waitForFunction(()=>window.__game?.ocean.ready&&__game.jimothy.rig.loaded&&__game.streetLife.ready,null,{timeout:120000});
 await page.evaluate(()=>{advanceTime(.1);__STATE_ONLY_TEST__=true;const g=__game;teleportJimothy(-850,0);g.dayNight.setHour(14);g.jimothy.body.position.set(-850,-5,0);g.jimothy.diving=true;g.jimothy.postUpdate(0);g.ocean.update(.1);g.freeCamera=true;g.camera.fov=45;g.camera.updateProjectionMatrix();window.tracked=g.ocean.fish.find(f=>f.kind==='fish-blue');});
 for(let frame=0;frame<240;frame++){
  const result=await page.evaluate(frame=>{
   const g=__game,f=tracked;if(frame===90){g.jimothy.body.position.set(f.mesh.position.x+2,f.mesh.position.y,f.mesh.position.z);g.jimothy.postUpdate(0);}if(frame===150){g.jimothy.body.position.x+=10;g.jimothy.postUpdate(0);}
   g.ocean.update(1/30);g.physics.update(1/30);g.jimothy.postUpdate(0);const target=f.mesh.position.clone();g.camera.position.copy(target).add(target.clone().set(-2.2,.5,2.3));g.camera.lookAt(target);g.ocean.afterCamera();g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});g.renderer.render(g.scene,g.camera);
   const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);
   return{png:canvas.toDataURL(),position:f.mesh.position.toArray(),yaw:f.mesh.rotation.y,snapshot:JSON.parse(render_game_to_text()).ocean};
  },frame);
  await fs.writeFile(`${folder}/frame-${String(frame).padStart(3,'0')}.png`,Buffer.from(result.png.split(',')[1],'base64'));delete result.png;frames.push({frame,...result});
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,frames},null,2));console.log('RESULT',JSON.stringify({errors,frames:frames.length,start:frames[0],end:frames.at(-1)}));
}finally{await browser.close();}
