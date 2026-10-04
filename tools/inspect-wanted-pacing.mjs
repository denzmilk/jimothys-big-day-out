import {chromium} from 'playwright';import fs from 'node:fs/promises';
const folder='output/iterate/wanted-native';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']}),errors=[],frames=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>window.__game?.jimothy.rig.loaded&&__game.pedestrians.ready&&__game.streetLife.ready&&__game.interiors.ready&&__game.trashCans.ready,undefined,{timeout:120000});
 await page.evaluate(async()=>{advanceTime(.1);window.__STATE_ONLY_TEST__=true;__game.dayNight.setHour(14);const {gameState}=await import('/src/core/GameState.js'),{HEAT}=await import('/src/core/Constants.js');gameState.heat.points=HEAT.TIER_THRESHOLDS[5];__game.heat._retier();__game.pursuers.update=()=>{};__game.military.update=()=>{};});
 for(const [name,seconds]of [['pending-four',1],['pending-five',12],['five',12]]){
  const r=await page.evaluate(seconds=>{advanceTime(seconds);const g=__game;g.scene.updateMatrixWorld(true);g.jimothy.rig.skinned.skeleton.update();g.renderer.render(g.scene,g.camera);const c=document.createElement('canvas');c.width=g.renderer.domElement.width;c.height=g.renderer.domElement.height;c.getContext('2d').drawImage(g.renderer.domElement,0,0);return{png:c.toDataURL(),heat:JSON.parse(render_game_to_text()).heat,label:document.getElementById('radar-status').textContent,stars:document.getElementById('heat-stars').textContent};},seconds);
  await fs.writeFile(`${folder}/${name}-world.png`,Buffer.from(r.png.split(',')[1],'base64'));await page.locator('#hud').screenshot({path:`${folder}/${name}-hud.png`});delete r.png;frames.push({name,...r});
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,frames},null,2));console.log(JSON.stringify({errors,frames}));
}finally{await browser.close();}
