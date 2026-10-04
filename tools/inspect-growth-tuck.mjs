import {chromium} from 'playwright';import fs from 'node:fs/promises';
const folder=process.env.GROWTH_OUTPUT||'output/iterate/growth-tuck-before';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal']}),errors=[],rows=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:720}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{window.__MANUAL_TIME__=true;window.__SKIP_ARRIVAL__=true;});await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>window.__game?.jimothy.rig.loaded,undefined,{timeout:120000});
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),C=await import('/src/core/Constants.js');window.GROW={T,C};const g=__game,j=g.jimothy;g.renderer.setAnimationLoop(null);
  const stage=new T.Scene();stage.background=new T.Color(0xcbd6df);stage.add(new T.HemisphereLight(0xffffff,0x77806e,2));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(60,-120,50);stage.add(sun);stage.add(j.group);GROW.stage=stage;
 });
 for(const fat of [0,90,250,400])for(const tuck of [0,.3,1]){
  const result=await page.evaluate(({fat,tuck})=>{
   const {T,C,stage}=GROW,g=__game,j=g.jimothy,r=j.rig,m=r.skinned;j.reset();setFatness(fat);j.body.position.set(0,j.radius,0);j.postUpdate(0);j.group.rotation.set(0,0,0);r.root.position.y=r.baseY;
   for(const name of Object.keys(r.bones))r.pose(name);stage.updateMatrixWorld(true);m.skeleton.update();
   const count=m.geometry.attributes.position.count,rest=Array.from({length:count},(_,i)=>m.getVertexPosition(i,new T.Vector3()));
   ['FL','FR','RL','RR'].forEach((n,i)=>r.pose('leg_'+n,C.MOVES.ROLL.TUCK_LEG*(i<2?1:-1)*tuck));stage.updateMatrixWorld(true);m.skeleton.update();
   const posed=Array.from({length:count},(_,i)=>m.getVertexPosition(i,new T.Vector3())),index=m.geometry.index.array;let edges=0,over2=0,over3=0,max=0;
   for(let i=0;i<index.length;i+=3)for(let k=0;k<3;k++){const a=index[i+k],b=index[i+(k+1)%3],before=rest[a].distanceTo(rest[b]);if(before<1e-6)continue;const ratio=posed[a].distanceTo(posed[b])/before;edges++;if(ratio>2)over2++;if(ratio>3)over3++;max=Math.max(max,ratio);}
   const center=r.bellyBox().getCenter(new T.Vector3()),distance=Math.max(2.5,j.radius*3.2);g.camera.position.copy(center).add(new T.Vector3(distance*.35,-distance,distance*.35));g.camera.lookAt(center);g.renderer.render(stage,g.camera);
   const c=document.createElement('canvas');c.width=g.renderer.domElement.width;c.height=g.renderer.domElement.height;c.getContext('2d').drawImage(g.renderer.domElement,0,0);return{fat,tuck,edges,over2,over3,max,png:c.toDataURL()};
  },{fat,tuck});await fs.writeFile(`${folder}/fat-${fat}-tuck-${tuck}.png`,Buffer.from(result.png.split(',')[1],'base64'));delete result.png;rows.push(result);
 }
 await fs.writeFile(`${folder}/report.json`,JSON.stringify({errors,rows},null,2));console.log(JSON.stringify({errors,rows}));
}finally{await browser.close();}
