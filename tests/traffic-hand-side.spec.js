import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('the named passenger-side wheels face the kerb side of each right-hand lane',async({page})=>{
 await boot(page);
 const lanes=await page.evaluate(async()=>{
  const {Vector3}=await import('/node_modules/three/build/three.module.js'),s=window.__game.streetLife;
  return s.routes.roads.map((road,i)=>{
   const car=s.template('car',i%s.vehicles.length);car.rotation.y=Math.atan2(road.dir.x,road.dir.z);car.updateMatrixWorld(true);
   const side=name=>car.children.find(m=>m.name==='wheel-front-'+name).getWorldPosition(new Vector3());
   const right=side('right').sub(side('left')).normalize(),offset=new Vector3(road.start.x-road.centreStart.x,0,road.start.z-road.centreStart.z);
   return {road:road.id,dot:right.dot(offset)};
  });
 });
 for(const lane of lanes)expect(lane.dot,JSON.stringify(lane)).toBeGreaterThan(1);
});
