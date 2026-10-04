import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('daylight shadow volume includes the controlled body at every growth tier',async({page})=>{
 await boot(page,{withRig:true});
 const rows=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),g=__game,rows=[];
  for(const quality of ['low','medium','high'])for(const fat of [0,25,90,250,400])for(const hour of [8,12,16]){
   g.quality.set(quality,false);setFatness(fat);teleportJimothy(0,0);g.jimothy.postUpdate(0);g.dayNight.setHour(hour);g.dayNight.update(0,false);g.scene.updateMatrixWorld(true);g.sun.shadow.updateMatrices(g.sun);
   const camera=g.sun.shadow.camera,project=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),center=g.jimothy.body.position,r=g.jimothy.radius;
   const points=[];for(const [x,y,z]of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])points.push(new T.Vector3(center.x+x*r,center.y+y*r,center.z+z*r).applyMatrix4(project));
   rows.push({quality,fat,hour,r,clipped:points.filter(p=>Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z))>1).length});
  }return rows;
 });
 console.log('SHADOW_BODY_COVERAGE',JSON.stringify(rows));
 for(const r of rows)expect(r.clipped,JSON.stringify(r)).toBe(0);
});

test('nearby grass, flowers and shrubs cast a rendered daytime shadow',async({page})=>{
 await page.setViewportSize({width:640,height:480});await boot(page);
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),g=__game,rows=[];
  g.scene.children.forEach(o=>{if(!o.isLight)o.visible=false;});
  g.dayNight.setHour(14);g.dayNight.update(0,false);g.scene.updateMatrixWorld(true);
  const ground=new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshStandardMaterial({color:0xffffff}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.copy(g.jimothy.position);g.scene.add(ground);
  const camera=new T.PerspectiveCamera(45,640/480,.1,1000);camera.position.copy(ground.position).add(new T.Vector3(2,2.4,3));camera.lookAt(ground.position);
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const ctx=canvas.getContext('2d');
  const draw=()=>{g.renderer.shadowMap.needsUpdate=true;g.renderer.render(g.scene,camera);ctx.drawImage(g.renderer.domElement,0,0);return ctx.getImageData(0,0,640,480).data;};
  for(const kind of [0,1,2,3,4,5]){
   const source=g.environmentLife.batches.find(b=>b.index===kind).mesh,mesh=source.clone();mesh.customDepthMaterial=source.customDepthMaterial;mesh.visible=true;mesh.layers.enable(0);mesh.frustumCulled=false;mesh.count=1;mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(ground.position.x,ground.position.y,ground.position.z));mesh.instanceMatrix.needsUpdate=true;g.scene.add(mesh);
   draw();const on=draw();mesh.castShadow=false;const off=draw();let changed=0;
   for(let i=0;i<on.length;i+=4)if((off[i]+off[i+1]+off[i+2]-on[i]-on[i+1]-on[i+2])/3>3)changed++;
   rows.push({kind,changed,casts:source.castShadow});g.scene.remove(mesh);mesh.dispose();
  }g.scene.remove(ground);ground.geometry.dispose();ground.material.dispose();return rows;
 });
 console.log('FOLIAGE_SHADOW_PIXELS',JSON.stringify(result));for(const r of result){expect(r.casts).toBe(true);expect(r.changed).toBeGreaterThan(10);}
});
