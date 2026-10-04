import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const label=process.env.GAIT_LABEL||'review',folder=`output/iterate/land-gait-${label}`;await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:960,height:600}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;localStorage.setItem('jimothy-graphics','medium');});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');await page.waitForFunction(()=>__game.jimothy.rig.loaded&&__game.pedestrians.ready,undefined,{timeout:120000});
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),g=__game,c=g.jimothy;window.GAIT_T=T;g.renderer.setAnimationLoop(null);window.__STATE_ONLY_TEST__=true;advanceTime(.1);
  const ground=()=>20;c.voxels={groundHeightAt:ground,physicalGroundHeightAt:ground,terrainHeightAt:ground,solidAtWorld:()=>false};
  const stage=new T.Scene();stage.background=new T.Color(0xcbd6df);stage.add(new T.HemisphereLight(0xffffff,0x77806e,2));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(4,28,5);sun.target.position.set(0,20,0);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:80});stage.add(sun,sun.target,c.group);window.gaitStage=stage;
  const plane=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0x828c90}));plane.rotation.x=-Math.PI/2;plane.position.y=20;plane.receiveShadow=true;stage.add(plane);const grid=new T.GridHelper(200,100,0x778184,0x929b9f);grid.position.y=20.001;stage.add(grid);
 });
 const reports=[];
 for(const [fat,speed]of [[0,1.5],[0,6],[25,3],[90,3]]){
  const frames=await page.evaluate(({fat,speed})=>{
   const g=__game,c=g.jimothy,T=GAIT_T;c.reset();setFatness(fat);c.yaw=0;c.elapsed=0;c.body.position.set(0,20+c.radius,0);c.legs.reset();const frames=[];
   for(let i=0;i<60;i++){
    c.vel.set(0,0,speed);c.body.position.z+=speed/60;c.elapsed+=1/60;c.postUpdate(1/60);
    const box=new T.Box3().setFromObject(c.group),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),distance=Math.max(size.x,size.y,size.z)*1.7;
    g.camera.position.copy(center).add(new T.Vector3(distance,.25*distance,.3*distance));g.camera.lookAt(center);g.renderer.render(gaitStage,g.camera);
    const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);
    frames.push({png:canvas.toDataURL(),feet:c.legs.snapshot()});
   }return frames;
  },{fat,speed});
  const dir=`${folder}/fat-${fat}-speed-${speed}`;await fs.mkdir(dir,{recursive:true});
  for(const [i,f]of frames.entries()){await fs.writeFile(`${dir}/${String(i).padStart(3,'0')}.png`,Buffer.from(f.png.split(',')[1],'base64'));delete f.png;}
  execFileSync('/opt/homebrew/bin/ffmpeg',['-loglevel','error','-y','-framerate','60','-i',`${dir}/%03d.png`,'-c:v','libx264','-pix_fmt','yuv420p',`${dir}.mp4`]);reports.push({fat,speed,frames});
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,reports},null,2));console.log(JSON.stringify({errors,cases:reports.map(({fat,speed})=>({fat,speed})),folder}));
}finally{await browser.close();}
