import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']}),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;localStorage.setItem('jimothy-graphics','medium');});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>__game.jimothy.rig.loaded&&__game.pedestrians.ready,undefined,{timeout:120000});
 await page.evaluate(async()=>{
  const g=__game,{VOXEL}=await import('/src/core/Constants.js'),L=await import('/src/level/Layout.js'),s=VOXEL.SIZE;g.renderer.setAnimationLoop(null);window.__STATE_ONLY_TEST__=true;window.T=await import('/node_modules/three/build/three.module.js');window.E=await import('/src/core/EventBus.js');
  for(let x=-180;x<=180&&!window.digSite;x+=10)for(let z=-180;z<=180;z+=10){
   if(g.voxels.terrainHeightAt(x,z)<4||L.buildingsIntersecting(x-10,z-10,x+10,z+10).length)continue;

   if([-4,0,4].every(dx=>[-4,0,4].every(dz=>{const vx=Math.floor((x+dx)/s),vz=Math.floor((z+dz)/s),top=g.voxels.terrain.topSolidVoxelY((vx+.5)*s,(vz+.5)*s);return [5,8].includes(g.voxels.terrain.materialAtVoxel(vx,top,vz));}))){window.digSite={x,z};break;}
  }
  if(!window.digSite)throw new Error('No natural terrain inspection site');teleportJimothy(digSite.x,digSite.z);advanceTime(.2);g.voxels.processGeneration();g.voxels.remeshDirty();g.dayNight.setHour(14);window.originalHeight=g.voxels.terrainHeightAt(digSite.x,digSite.z);
 });
 const views=[];
 for(const name of ['before','after']){
  const view=await page.evaluate(name=>{
   const g=__game,w=g.voxels,c=g.jimothy,{x,z}=digSite;
   if(name==='after'){const before=w.removedCount;for(const dx of [-3,-1.5,0,1.5,3])w.damageSphere(x+dx,w.terrainHeightAt(x+dx,z)-.5,z,1.3,{digsTerrain:true});E.eventBus.emit(E.Events.WORLD_DEMOLISHED,{x,y:originalHeight-1,z,voxels:w.removedCount-before,bounds:{min:[x-5,originalHeight-4,z-2],max:[x+5,originalHeight+1,z+2]}});w.remeshDirty();const y=w.groundHeightAt(x,z,originalHeight+1);dropJimothy(x,z,y+c.radius);c.legs.reset();c.postUpdate(0);advanceTime(1);w.remeshDirty();}
   c.cameraDist=Infinity;c.postUpdate(0);g.camera.position.set(x+7,Math.max(originalHeight+10,w.terrainHeightAt(x+7,z+7)+8),z+7);g.camera.lookAt(x,originalHeight-.6,z);g.scene.updateMatrixWorld(true);c.rig.skinned.skeleton.update();g.renderer.shadowMap.needsUpdate=true;g.renderer.render(g.scene,g.camera);
   const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);
   return {name,site:digSite,state:JSON.parse(render_game_to_text()),surfaceCache:{patches:w.dugSurface.patches.size,corners:w.dugSurface.corners.size},png:canvas.toDataURL()};
  },name);
  await fs.writeFile(`output/iterate/dug-ground-${name}.png`,Buffer.from(view.png.split(',')[1],'base64'));delete view.png;views.push(view);
 }
 await fs.writeFile('output/iterate/dug-ground-native.json',JSON.stringify({errors,views},null,2));console.log(JSON.stringify({errors,views:views.map(v=>({name:v.name,site:v.site,position:v.state.jimothy,cache:v.surfaceCache}))}));
}finally{await browser.close();}
