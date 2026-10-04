import {chromium} from 'playwright';
import fs from 'node:fs/promises';

const folder=process.env.OUTPUT_DIR||'output/iterate/tool-supplies-native';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal','--disable-audio-output']});
const errors=[],frames=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{__MANUAL_TIME__=true;__SKIP_ARRIVAL__=true;});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');
 await page.waitForFunction(()=>window.__game?.tools.ready&&__game.jimothy.rig.loaded&&__game.pedestrians.ready&&__game.streetLife.ready,null,{timeout:120000});await page.keyboard.press('Shift');
 await page.evaluate(async()=>{
  const g=__game;advanceTime(.1);__STATE_ONLY_TEST__=true;const t=g.tools,p=t.pickups.find(p=>p.type==='firework-launcher');
  teleportJimothy(0,-16);advanceTime(.2);g.dayNight.setHour(14);g.freeCamera=true;g.camera.fov=45;g.camera.updateProjectionMatrix();
  t.equip(p);p.remaining=2;t.syncSupply();t.aimOverride={x:0,y:.12,z:1};(await import('/src/core/GameState.js')).gameState.tools.energy=100;window.spentTool=p;
 });
 for(let frame=0;frame<100;frame++){
  const row=await page.evaluate(frame=>{
   const g=__game,t=g.tools;if(frame===20||frame===46){t.cooldown=0;t.use(1/30);}advanceTime(1/30);
   const target=g.jimothy.position.clone();target.y+=.35;g.camera.position.copy(target).add(target.clone().set(5,3.5,7));g.camera.lookAt(target);g.ocean.afterCamera();g.dayNight.update(0,false);g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});g.renderer.render(g.scene,g.camera);
   const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);
   return{png:canvas.toDataURL(),tools:JSON.parse(render_game_to_text()).tools,hud:t.panel.textContent,at:spentTool.mesh.position.toArray(),body:GLOB_BODY()};
   function GLOB_BODY(){const b=g.physics.props.get(spentTool.id);return{active:b.active,velocity:b.body.velocity.toArray()};}
  },frame);
  await fs.writeFile(`${folder}/frame-${String(frame).padStart(3,'0')}.png`,Buffer.from(row.png.split(',')[1],'base64'));delete row.png;frames.push({frame,...row});
  if([10,30,50].includes(frame)){await page.screenshot({path:`${folder}/hud-${frame}.png`});await page.locator('#tool-hud').screenshot({path:`${folder}/panel-${frame}.png`});}
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,frames},null,2));console.log(JSON.stringify({errors,frames:frames.length,final:frames.at(-1).tools.discards}));
}finally{await browser.close();}
