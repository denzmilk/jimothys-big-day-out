import {chromium} from 'playwright';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const folder=process.env.RAGDOLL_OUTPUT||'output/iterate/player-ragdoll-native';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']}),errors=[],rows=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:600}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;});await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>window.__game?.jimothy.rig.loaded&&__game.streetLife.ready&&__game.pedestrians.ready,undefined,{timeout:120000});
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{eventBus,Events}=await import('/src/core/EventBus.js'),g=__game,j=g.jimothy;g.renderer.setAnimationLoop(null);window.RAG={T,eventBus,Events};
  const stage=new T.Scene();stage.background=new T.Color(0xcbd6df);stage.add(new T.HemisphereLight(0xffffff,0x77806e,2));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(330,150,300);stage.add(sun);stage.add(j.group);RAG.stage=stage;
  const plane=new T.Mesh(new T.PlaneGeometry(160,160),new T.MeshStandardMaterial({color:0x8f9995}));plane.rotation.x=-Math.PI/2;plane.position.set(300,20,300);stage.add(plane);const grid=new T.GridHelper(160,80,0x738080,0xa8b5ae);grid.position.set(300,20.01,300);stage.add(grid);
  const ground=()=>20;j.voxels=g.physics.voxels={terrainHeightAt:ground,groundHeightAt:ground,physicalGroundHeightAt:ground,solidAtWorld:(x,y,z)=>y<20,raycast:()=>null};j.onImpact=()=>{};
  RAG.car=g.streetLife.items.find(p=>p.kind==='car'&&!p.fragment);stage.add(RAG.car.mesh);RAG.car.driving=false;RAG.car.mesh.rotation.set(0,0,0);RAG.car.yaw=0;
 });
 for(const kind of ['blast','car','giant']){
  await page.evaluate(kind=>{const {eventBus,Events,car}=RAG,j=__game.jimothy;j.reset();setFatness(kind==='giant'?250:0);j.body.position.set(300,20+j.radius,300);j.yaw=0;j.postUpdate(0);car.mesh.visible=kind==='car';car.mesh.position.set(300,20+car.half[1],293);eventBus.emit(Events.PROP_POSE,{id:car.id,position:car.mesh.position,quaternion:car.mesh.quaternion});if(kind!=='car')eventBus.emit(Events.CAR_EXPLODED,{id:'native-blast',x:298,y:j.body.position.y,z:300,radius:4.5});},kind);
  const dir=`${folder}/${kind}`;await fs.mkdir(dir,{recursive:true});const frames=[];
  for(let frame=0;frame<120;frame++){
   const out=await page.evaluate(({kind,frame})=>{
    const {T,stage,eventBus,Events,car}=RAG,g=__game,j=g.jimothy;
    for(let sub=0;sub<2;sub++){const t=(frame*2+sub)/60;j.update(1/60,0);if(kind==='car'){car.mesh.position.set(300,20+car.half[1],293+Math.min(t,1.2)*14);eventBus.emit(Events.PROP_POSE,{id:car.id,position:car.mesh.position,quaternion:car.mesh.quaternion});}g.physics.update(1/60);j.postUpdate(1/60);}
    stage.updateMatrixWorld(true);j.rig.skinned.skeleton.update();const center=new T.Vector3().copy(j.body.position),distance=Math.max(4,j.radius*3.5);g.camera.position.copy(center).add(new T.Vector3(distance,distance*.35,distance*.6));g.camera.lookAt(center);g.renderer.render(stage,g.camera);
    let gap=0;for(const c of j.ragdoll.physics?.constraints||[]){const a=c.bodyA.pointToWorldFrame(c.pivotA),b=c.bodyB.pointToWorldFrame(c.pivotB);gap=Math.max(gap,a.distanceTo(b));}
    const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);
    return{png:canvas.toDataURL(),position:j.body.position.toArray(),ragdoll:j.ragdoll.snapshot(),launched:j.launched,gap};
   },{kind,frame});await fs.writeFile(`${dir}/${String(frame).padStart(3,'0')}.png`,Buffer.from(out.png.split(',')[1],'base64'));delete out.png;frames.push(out);
  }
  execFileSync('/opt/homebrew/bin/ffmpeg',['-loglevel','error','-y','-framerate','30','-i',`${dir}/%03d.png`,'-c:v','libx264','-pix_fmt','yuv420p',`${dir}.mp4`]);rows.push({kind,frames});
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,rows},null,2));console.log(JSON.stringify({errors,rows:rows.map(r=>({kind:r.kind,maxGap:Math.max(...r.frames.map(f=>f.gap)),last:r.frames.at(-1)}))}));
}finally{await browser.close();}
