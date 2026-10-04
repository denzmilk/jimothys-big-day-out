import {chromium} from 'playwright';import fs from 'node:fs/promises';
const folder='output/iterate/crater-exit-native';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']}),errors=[],frames=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:600}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>window.__MANUAL_TIME__=true);await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>window.__game?.jimothy.rig.loaded&&__game.pedestrians.ready&&__game.streetLife.ready&&__game.interiors.ready&&__game.trashCans.ready,undefined,{timeout:120000});
 await page.evaluate(()=>{advanceTime(7.3);window.__STATE_ONLY_TEST__=true;});await page.keyboard.down('w');
 for(let frame=0;frame<60;frame++){
  const r=await page.evaluate(()=>{advanceTime(1/30);const g=__game;g.scene.updateMatrixWorld(true);g.jimothy.rig.skinned.skeleton.update();g.renderer.render(g.scene,g.camera);const c=document.createElement('canvas');c.width=g.renderer.domElement.width;c.height=g.renderer.domElement.height;c.getContext('2d').drawImage(g.renderer.domElement,0,0);return{png:c.toDataURL(),jimothy:JSON.parse(render_game_to_text()).jimothy};});
  if(frame%5===0||frame===59)await fs.writeFile(`${folder}/${String(frame).padStart(3,'0')}.png`,Buffer.from(r.png.split(',')[1],'base64'));delete r.png;frames.push(r);
 }await page.keyboard.up('w');await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,frames},null,2));console.log(JSON.stringify({errors,first:frames[0].jimothy,last:frames.at(-1).jimothy}));
}finally{await browser.close();}
