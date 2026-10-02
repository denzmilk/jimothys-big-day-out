import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('every imported vehicle has its front axle facing the traffic forward axis',async({page})=>{
 await boot(page);
 const axes=await page.evaluate(()=>window.__game.streetLife.vehicles.map((_,i)=>{
  const mesh=window.__game.streetLife.template('car',i);
  const z=part=>{const wheels=mesh.children.filter(o=>o.name.includes('wheel-'+part));return wheels.reduce((sum,o)=>sum+o.position.z,0)/wheels.length;};
  return {model:i,forward:z('front')-z('back')};
 }));
 for(const axis of axes)expect(axis.forward,JSON.stringify(axis)).toBeGreaterThan(1);
});

test('visible front axles lead rear axles during traffic movement',async({page})=>{
 await boot(page);
 const result=await page.evaluate(async()=>{
  const {Vector3}=await import('/node_modules/three/build/three.module.js');const s=window.__game.streetLife;let samples=0,min=1;
  for(let i=0;i<900;i++){
   const before=s.items.filter(p=>p.driving).map(p=>({p,pos:p.mesh.position.clone()}));s.update(1/60);
   for(const {p,pos} of before){const travel=p.mesh.position.clone().sub(pos);travel.y=0;if(travel.length()<.001)continue;
    p.mesh.updateMatrixWorld(true);const axle=part=>{const wheels=p.mesh.children.filter(o=>o.name.includes('wheel-'+part));return wheels.reduce((v,o)=>v.add(o.getWorldPosition(new Vector3())),new Vector3()).divideScalar(wheels.length);};
    const nose=axle('front').sub(axle('back'));nose.y=0;min=Math.min(min,nose.normalize().dot(travel.normalize()));samples++;
   }
  }return {samples,min};
 });
 console.log('CAR_FORWARD',JSON.stringify(result));expect(result.samples).toBeGreaterThan(100);expect(result.min).toBeGreaterThanOrEqual(0);
});
