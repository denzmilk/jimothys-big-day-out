import {chromium} from 'playwright';import fs from 'node:fs/promises';
const folder=process.env.OUTPUT_DIR||'output/iterate/tool-flow-native';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal','--disable-audio-output']}),errors=[],views=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{__MANUAL_TIME__=true;__SKIP_ARRIVAL__=true;});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>window.__game?.tools.ready&&__game.jimothy.rig.loaded&&__game.pedestrians.ready&&__game.streetLife.ready,null,{timeout:120000});await page.keyboard.press('Shift');
 for(const id of (process.env.TOOL?[process.env.TOOL]:['power-washer','leaf-blower','vacuum','fire-extinguisher'])){
  await page.evaluate(async ({id,hour,fat})=>{restartGame();advanceTime(.1);__STATE_ONLY_TEST__=true;const g=__game,t=g.tools;teleportJimothy(0,-16);advanceTime(.2);setFatness(fat);g.dayNight.setHour(hour);g.freeCamera=fat===0;g.camera.fov=50;g.camera.updateProjectionMatrix();t.equip(t.pickups.find(p=>p.type===id));(await import('/src/core/GameState.js')).gameState.tools.energy=100;t.aimOverride=fat?null:{x:0,y:.03,z:1};if(id==='vacuum'){const j=g.jimothy.position;for(const offset of [-1,0,1])g.trashCans.spawnFood('whole-pizza',j.x+offset,j.z+5);} },{id,hour:Number(process.env.HOUR||14),fat:Number(process.env.FAT||0)});
  await page.keyboard.down('v');
  for(let frame=0;frame<24;frame++){
   const result=await page.evaluate(({close})=>{const g=__game;advanceTime(1/30);const target=g.jimothy.position.clone();target.y+=.5;if(g.jimothy.radius<3){g.camera.position.copy(target).add(target.clone().set(8,4,6));g.camera.lookAt(target);}if(close){const focus=g.tools.muzzle().addScaledVector(g.tools.direction(),4);g.camera.position.copy(focus).add(focus.clone().set(8,4,6));g.camera.lookAt(focus);}g.ocean.afterCamera();g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});g.renderer.render(g.scene,g.camera);const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);return{png:canvas.toDataURL(),flow:JSON.parse(render_game_to_text()).tools.flow};},{close:process.env.CAMERA==='outlet'});
   await fs.writeFile(`${folder}/${id}-${String(frame).padStart(2,'0')}.png`,Buffer.from(result.png.split(',')[1],'base64'));if(frame===18){await page.screenshot({path:`${folder}/${id}-hud.png`});views.push({id,flow:result.flow});}
  }await page.keyboard.up('v');await page.evaluate(()=>advanceTime(.8));
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,views},null,2));console.log(JSON.stringify({errors,tools:views.map(v=>({id:v.id,style:v.flow.style,visible:v.flow.visible,particles:v.flow.particles}))}));
}finally{await browser.close();}
