import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const folder='output/iterate/player-ragdoll-world';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']}),errors=[],frames=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:600}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>window.__game?.jimothy.rig.loaded&&__game.streetLife.ready&&__game.pedestrians.ready,undefined,{timeout:120000});
 await page.evaluate(async()=>{advanceTime(.1);teleportJimothy(0,10);faceJimothy(0);const {eventBus,Events}=await import('/src/core/EventBus.js'),p=__game.jimothy.body.position;eventBus.emit(Events.EXPLOSION_SPAWN,{x:p.x-1,y:p.y,z:p.z,radius:2,source:'firework'});});
 for(let frame=0;frame<90;frame++){
  const r=await page.evaluate(()=>{advanceTime(1/30);const g=__game,j=g.jimothy;g.scene.updateMatrixWorld(true);j.rig.skinned.skeleton.update();g.renderer.render(g.scene,g.camera);const c=document.createElement('canvas');c.width=g.renderer.domElement.width;c.height=g.renderer.domElement.height;c.getContext('2d').drawImage(g.renderer.domElement,0,0);const s=JSON.parse(render_game_to_text());return{png:c.toDataURL(),jimothy:s.jimothy,stunned:s.stunned};});
  if(frame%10===0||frame===89)await fs.writeFile(`${folder}/${String(frame).padStart(3,'0')}.png`,Buffer.from(r.png.split(',')[1],'base64'));delete r.png;frames.push(r);
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,frames},null,2));console.log(JSON.stringify({errors,first:frames[0].jimothy.ragdoll,last:frames.at(-1).jimothy.ragdoll,stunned:frames.at(-1).stunned}));
}finally{await browser.close();}
