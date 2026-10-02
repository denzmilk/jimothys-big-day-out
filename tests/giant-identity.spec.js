import {test,expect} from '@playwright/test';
import {boot,adv} from './helpers.mjs';

test('giant keeps the original textured mesh and readable anatomy',async({page})=>{
 await boot(page,{withRig:true});
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),j=__game.jimothy,r=j.rig,m=r.skinned,out=[];
  for(const fat of [0,90,250,400]){
   setFatness(fat);teleportJimothy(10,20);j.postUpdate(0);j.group.updateMatrixWorld(true);
   const head=r.partBox('head').getSize(new T.Vector3()).length(),body=r.bellyBox().getSize(new T.Vector3()).length();
   out.push({fat,head,body,ratio:head/body,triangles:m.geometry.index.count/3,texture:!!m.material.map,fur:r.furBlend?.value||0});
  }return out;
 });console.log(JSON.stringify(result));
 for(const s of result){expect(s.triangles).toBe(39991);expect(s.texture).toBe(true);expect(s.ratio).toBeGreaterThan(.1);expect(s.fur).toBe(0);}
 expect(result.at(-1).head).toBeGreaterThan(result[0].head*5);
});

test('the loaded giant visibly jiggles without rebuilding its mesh',async({page})=>{
 await boot(page,{withRig:true});await page.evaluate(()=>{setFatness(250);teleportJimothy(10,20);});
 const report=await page.evaluate(()=>{
  const j=__game.jimothy,r=j.rig,geometry=r.skinned.geometry,out=[];j.jiggleAmp=.1;
  for(let i=0;i<16;i++){j.elapsed+=1/60;j.postUpdate(1/60);j.group.updateMatrixWorld(true);const b=r.bellyBox();out.push(b.max.x-b.min.x);}
  return{spread:Math.max(...out)-Math.min(...out),sameGeometry:geometry===r.skinned.geometry};
 });expect(report.spread).toBeGreaterThan(.15);expect(report.sameGeometry).toBe(true);
});
