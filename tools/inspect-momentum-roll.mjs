import {chromium} from 'playwright';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const folder='output/iterate/momentum-roll-native';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']}),errors=[],reports=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:600}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;});await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>window.__game?.jimothy.rig.loaded&&__game.pedestrians.ready,undefined,{timeout:120000});
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),g=__game,j=g.jimothy;g.renderer.setAnimationLoop(null);advanceTime(.1);window.__STATE_ONLY_TEST__=true;window.ROLL_T=T;
  const stage=new T.Scene();stage.background=new T.Color(0xcbd6df);stage.add(new T.HemisphereLight(0xffffff,0x77806e,2));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(60,120,50);stage.add(sun);stage.add(j.group);window.rollStage=stage;
  const plane=new T.Mesh(new T.PlaneGeometry(600,600),new T.MeshStandardMaterial({color:0x8f9995}));plane.rotation.x=-Math.PI/2-Math.atan(.3);plane.position.y=20;stage.add(plane);const grid=new T.GridHelper(600,150,0x738080,0xa8b5ae);grid.rotation.x=-Math.atan(.3);grid.position.y=20.01;stage.add(grid);
  const h=(x,z)=>20+z*.3;j.voxels={groundHeightAt:h,physicalGroundHeightAt:h,terrainHeightAt:h,solidAtWorld:(x,y,z)=>y<h(x,z),raycast:()=>null};j.onImpact=()=>{};
 });
 for(const fat of [0,90,250]){
  await page.evaluate(fat=>{const j=__game.jimothy;j.reset();setFatness(fat);j.body.position.set(0,20+j.radius,0);j.yaw=0;j.legs.reset();j.postUpdate(0);__game.input.codes.clear();__game.input.codes.add('KeyC');__game.input._rollQueued=true;},fat);
  const dir=`${folder}/fat-${fat}`;await fs.mkdir(dir,{recursive:true});const samples=[];
  for(let frame=0;frame<120;frame++){
   const result=await page.evaluate(({frame,fat})=>{
    const g=__game,j=g.jimothy,T=ROLL_T;
    for(let sub=0;sub<2;sub++){
     const t=(frame*2+sub)/60;if(t>(fat?2.4:.5))g.input.codes.delete('KeyC');g.input.moveX=fat&&t>1.2&&t<2.4?-1:0;g.input.moveZ=0;
     j.update(1/60,0);j.body.position.x+=j.body.velocity.x/60;j.body.position.y+=j.body.velocity.y/60;j.body.position.z+=j.body.velocity.z/60;j.postUpdate(1/60);
    }
    rollStage.updateMatrixWorld(true);j.rig.skinned.skeleton.update();
    const distance=Math.max(4,j.radius*3.5),center=new T.Vector3().copy(j.body.position);g.camera.position.copy(center).add(new T.Vector3(distance,.45*distance,.6*distance));g.camera.lookAt(center);g.renderer.render(rollStage,g.camera);
    const c=document.createElement('canvas');c.width=g.renderer.domElement.width;c.height=g.renderer.domElement.height;c.getContext('2d').drawImage(g.renderer.domElement,0,0);
    return{png:c.toDataURL(),speed:j.speed,position:j.position.toArray(),rotation:j.group.quaternion.toArray(),move:j.move?.kind||null,recovering:!!j.move?.recovering,spin:j.rollMotion.spin};
   },{frame,fat});await fs.writeFile(`${dir}/${String(frame).padStart(3,'0')}.png`,Buffer.from(result.png.split(',')[1],'base64'));delete result.png;samples.push(result);
  }
  execFileSync('/opt/homebrew/bin/ffmpeg',['-loglevel','error','-y','-framerate','30','-i',`${dir}/%03d.png`,'-c:v','libx264','-pix_fmt','yuv420p',`${dir}.mp4`]);reports.push({fat,samples});
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,reports},null,2));console.log(JSON.stringify({errors,folder,cases:reports.map(r=>({fat:r.fat,last:r.samples.at(-1)}))}));
}finally{await browser.close();}
