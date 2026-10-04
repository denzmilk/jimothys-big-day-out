import {test,expect} from '@playwright/test';import {boot,state} from './helpers.mjs';
const watchers=new WeakMap(),errors=new WeakMap();
test.beforeEach(async({page})=>{
 const log=[];errors.set(page,log);page.on('console',m=>{if(m.type()==='error')log.push(m.text());});page.on('pageerror',e=>{log.push(e.message);console.log('SWIM_PAGE_ERROR',e.message);});page.on('requestfailed',r=>console.log('SWIM_REQUEST_FAILED',r.url(),r.failure()));
 watchers.set(page,setInterval(()=>page.evaluate(()=>{const g=window.__game;return{game:!!g,ped:g?.pedestrians.ready,trash:g?.trashCans.ready,interiors:g?.interiors.ready,street:g?.streetLife.ready,environment:g?.environmentLife.ready,army:g?.pursuers.response.infantryReady,hidden:document.hidden};}).then(r=>console.log('SWIM_BOOT',r)).catch(()=>{}),10000));
});
test.afterEach(async({page})=>{clearInterval(watchers.get(page));expect(errors.get(page)).toEqual([]);});
async function setup(page){await boot(page);await page.waitForFunction(()=>__game.pursuers.response.infantryReady);await page.evaluate(()=>{teleportJimothy(-850,0);advanceTime(.2);});}

test('all civilian bodies swim above deep water instead of walking on the seabed',async({page})=>{
 await setup(page);const rows=await page.evaluate(async()=>{
  const g=__game,peds=g.pedestrians,THREE=await import('/node_modules/three/build/three.module.js'),rows=[];
  for(const p of [...peds.people])peds._remove(p);peds._graphAround(-850,0);peds.populationPending=false;
  for(const hz of [30,60,120])for(let model=0;model<peds.models.length;model++){
   const p=peds._spawn({x:-850,z:0,key:'water-test'},model);p.y=-1;p.mesh.position.set(p.x,p.y,p.z);p.flee=100;
   const hand=p.visual.getObjectByName('hand_r'),head=p.visual.getObjectByName('head');let first=null,stroke=0;
   for(let i=0;i<hz*8;i++){peds.update(1/hz);p.mesh.updateMatrixWorld(true);const at=p.mesh.worldToLocal(hand.getWorldPosition(new THREE.Vector3()));if(i===hz*6)first=at;if(first)stroke=Math.max(stroke,at.distanceTo(first));}
   const headY=head.getWorldPosition(new THREE.Vector3()).y;rows.push({hz,model:p.model,swimming:!!p.swimming,head:headY,water:g.water.heightAt(p.x,p.z),stroke,y:p.y,finite:Number.isFinite(p.x+p.y+p.z)});peds._remove(p);
  }return rows;
 });console.log('HUMAN_SWIM_BODIES',JSON.stringify(rows));expect(rows.length).toBe(36);for(const r of rows){expect(r.swimming,r.model).toBe(true);expect(r.head-r.water,r.model).toBeGreaterThan(.05);expect(r.head-r.water,r.model).toBeLessThan(.55);expect(r.stroke,r.model).toBeGreaterThan(.15);expect(r.finite).toBe(true);}
 expect((await state(page)).people).toBeDefined();
});

test('all response roles float and swim at 30/60/120 Hz',async({page})=>{
 await setup(page);const rows=await page.evaluate(async()=>{
  const g=__game,ai=g.pursuers,THREE=await import('/node_modules/three/build/three.module.js'),{gameState}=await import('/src/core/GameState.js'),rows=[];gameState.heat.tier=0;
  for(const hz of [30,60,120])for(const type of ['paparazzo','angry-local','animal-control','police','infantry']){
   ai.reset();const id=spawnPursuerAt(type,-848,0),p=ai.all.find(p=>p.id===id);p.group.position.y=-1;p.sees=true;
   for(let i=0;i<hz*8;i++)ai.update(1/hz);p.group.updateMatrixWorld(true);const head=p.visual.getObjectByName('head').getWorldPosition(new THREE.Vector3());
   rows.push({hz,type,swimming:!!p.swimming,head:head.y,water:g.water.heightAt(head.x,head.z),response:ai.response.snapshot(),net:p.netPhase,playing:gameState.game.isPlaying});
  }return rows;
});console.log('HUMAN_SWIM_ROLES',JSON.stringify(rows));for(const r of rows){expect(r.swimming,`${r.type} ${r.hz}`).toBe(true);expect(r.head-r.water).toBeGreaterThan(.05);expect(r.response.gunShots+r.response.kicks+r.response.photos).toBe(0);expect(r.playing).toBe(true);if(r.type==='animal-control')expect(r.net).toBe('idle');}
});

test('swimmers leave the real sloping beach with continuous head and foot motion',async({page})=>{
 await setup(page);const rows=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,T=await import('/node_modules/three/build/three.module.js'),rows=[];
  const ux=1/3,uz=-Math.sqrt(8/9);let start;
  for(let d=0;d<100;d+=.25){const x=70-ux*d,z=-700-uz*d,depth=g.water.heightAt(x,z)-g.voxels.terrainHeightAt(x,z);if(depth>1.6){start={x,z};break;}}
  if(!start)throw Error('No real beach entry');teleportJimothy(start.x,start.z);g.voxels.processGeneration();
  for(const p of [...s.people])s._remove(p);s._graphAround(start.x,start.z);s.populationPending=false;
  for(const hz of [30,60,120]){
   const p=s._spawn({...start,key:'beach'},hz);p.y=-1;p.mesh.position.set(p.x,p.y,p.z);p.flee=1000;let swam=false,left=false,landFrames=0,maxHeadStep=0,maxFootStep=0,lastHead,lastFoot,minDepth=Infinity;
   for(let i=0;i<hz*90;i++){
    s.update(1/hz);p.mesh.updateMatrixWorld(true);const h=p.visual.getObjectByName('head').getWorldPosition(new T.Vector3()),f=p.visual.getObjectByName('foot_l').getWorldPosition(new T.Vector3());
    if(i>hz*2){maxHeadStep=Math.max(maxHeadStep,Math.abs(h.y-lastHead.y));maxFootStep=Math.max(maxFootStep,f.distanceTo(lastFoot));}lastHead=h;lastFoot=f;
    swam||=p.swimming;left||=swam&&!p.swimmer.active;if(left)landFrames++;
    minDepth=Math.min(minDepth,g.water.heightAt(p.x,p.z)-g.voxels.terrainHeightAt(p.x,p.z));if(landFrames>hz*3)break;
   }
   rows.push({hz,start,end:{x:p.x,y:p.y,z:p.z},swam,left,landFrames,maxHeadStep,maxFootStep,minDepth,tilt:p.visual.rotation.x,feet:p.grounding.contacts});s._remove(p);
  }return rows;
 });console.log('HUMAN_SWIM_SHORE',JSON.stringify(rows));for(const r of rows){expect(r.swam).toBe(true);expect(r.left,JSON.stringify(r)).toBe(true);expect(r.minDepth).toBeLessThan(0);expect(r.maxHeadStep).toBeLessThan(.16);expect(r.maxFootStep).toBeLessThan(.3);expect(Math.abs(r.tilt)).toBeLessThan(.01);expect(r.feet.length).toBe(2);}
});

test('submerged swimmers do not ascend through voxel or wreck ceilings',async({page})=>{
 await setup(page);const rows=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,T=await import('/node_modules/three/build/three.module.js'),rows=[];
  for(const p of [...s.people])s._remove(p);s._graphAround(-850,0);s.populationPending=false;
  for(const kind of ['voxel','wreck']){
   const p=s._spawn({x:-850,z:0,key:'cover'},0);p.y=-4;p.mesh.position.set(p.x,p.y,p.z);
   const original=g.voxels.physicalSolidAtWorld.bind(g.voxels);let part;
   if(kind==='voxel')g.voxels.physicalSolidAtWorld=(x,y,z)=>y>-1.6&&y<-1.1||original(x,y,z);
   else {const mesh=new T.Mesh(new T.BoxGeometry(80,.5,80),new T.MeshBasicMaterial());mesh.position.set(-850,-1.35,0);g.scene.add(mesh);part={mesh,half:[40,.25,40]};g.ocean.parts.push(part);}
   let maxHead=-Infinity;
   for(let i=0;i<360;i++){s.update(1/60);maxHead=Math.max(maxHead,p.visual.getObjectByName('head').getWorldPosition(new T.Vector3()).y);}
   rows.push({kind,maxHead,y:p.y,swimming:p.swimming});s._remove(p);g.voxels.physicalSolidAtWorld=original;
   if(part){g.ocean.parts.splice(g.ocean.parts.indexOf(part),1);part.mesh.removeFromParent();part.mesh.geometry.dispose();part.mesh.material.dispose();}
  }return rows;
 });console.log('HUMAN_SWIM_CEILING',JSON.stringify(rows));for(const r of rows){expect(r.swimming).toBe(true);expect(r.maxHead,r.kind).toBeLessThan(-1.6);}
});
