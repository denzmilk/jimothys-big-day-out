import {test,expect} from '@playwright/test';import {boot} from './helpers.mjs';

test('grown legs gather gently without the full lean-body tuck',async({page})=>{
 await boot(page,{withRig:true});const rows=await page.evaluate(()=>{
  const j=__game.jimothy,r=j.rig,rows=[];for(const fat of [0,90,250,400]){
   j.reset();setFatness(fat);j.body.position.set(0,100+j.radius,0);j.grounded=false;j.move={kind:'roll',physical:fat>0,t:1,ticks:0};j.postUpdate(0);j.legs.setTuck(1);j.legs.update(0);
   rows.push({fat,angles:['FL','FR','RL','RR'].map(n=>r.bones['leg_'+n].quaternion.angleTo(r.rest['leg_'+n]))});
  }return rows;
 });console.log('GIANT_TUCK',JSON.stringify(rows));for(const r of rows)for(const a of r.angles){expect(a).toBeGreaterThan(.2);if(r.fat)expect(a).toBeLessThan(.5);else expect(a).toBeGreaterThan(1);}
});

test('grown skin keeps smooth shading across duplicated UV seam vertices',async({page})=>{
 await boot(page,{withRig:true});const out=await page.evaluate(()=>{
  const r=__game.jimothy.rig,a=r.skinned.geometry.attributes,original=a.normal.array.slice();setFatness(250);__game.jimothy.postUpdate(0);
  const seen=new Map();let seams=0,max=0;for(let v=0;v<a.position.count;v++){
   const key=[0,1,2].map(k=>Math.round(r.growthBase[v*3+k]*1e5)).join(','),old=seen.get(key),normal=[a.normal.getX(v),a.normal.getY(v),a.normal.getZ(v)];
   if(old){seams++;max=Math.max(max,Math.hypot(...normal.map((n,k)=>n-old[k])));}else seen.set(key,normal);
  }
  setFatness(0);__game.jimothy.postUpdate(0);return{seams,max,leanRestored:original.every((n,i)=>n===a.normal.array[i])};
 });console.log('GROWTH_NORMALS',JSON.stringify(out));expect(out.seams).toBeGreaterThan(1000);expect(out.max).toBeLessThan(.002);expect(out.leanRestored).toBe(true);
});

test('upper and lower segments of a grown limb share one growth direction',async({page})=>{
 await boot(page,{withRig:true});const out=await page.evaluate(()=>{
  const r=__game.jimothy.rig,m=r.skinned,names=m.skeleton.bones.map(b=>b.name),a=m.geometry.attributes;let samples=0,max=0,total=0;
  for(let v=0;v<a.position.count;v++)for(const leg of ['FL','FR','RL','RR']){
   const offsets=[];let sum=0,largest=0;for(let k=0;k<4;k++){const o=v*4+k;if(!['leg_'+leg,'shin_'+leg].includes(names[r.baseSkinIndex[o]]))continue;sum+=r.baseSkinWeight[o];largest=Math.max(largest,r.baseSkinWeight[o]);offsets.push(o);}
   if(sum<.901||largest>.64)continue;const error=Math.max(...offsets.map(o=>r.socketDistance[o]));samples++;max=Math.max(max,error);total+=error;
  }return{samples,max,mean:total/samples};
 });console.log('LIMB_GROWTH',JSON.stringify(out));expect(out.samples).toBeGreaterThan(100);expect(out.max).toBeLessThan(.03);
});
