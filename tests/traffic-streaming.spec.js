import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('departing traffic is replenished while Jimothy stands still without growing bodies',async({page})=>{
 await boot(page);
 const result=await page.evaluate(()=>{
  const g=window.__game,s=g.streetLife,centre={...s.center};
  const far=s.routes.roads.find(r=>Math.hypot(r.start.x-centre.x,r.start.z-centre.z)>150);
  const counts=()=>({b:g.physics.world.bodies.length,e:g.collector.entities.size});const before=counts();let minimum=Infinity;
  for(let i=0;i<12;i++){
   const car=s.items.find(p=>p.driving);s.assignRoute(car,far,far.length/2);s.update(0);
   minimum=Math.min(minimum,s.items.filter(p=>p.driving&&Math.hypot(p.mesh.position.x-centre.x,p.mesh.position.z-centre.z)<100).length);
  }
  return {minimum,before,after:counts(),saved:s.saved.size,centre:s.center};
 });
 console.log('TRAFFIC_REPLENISH',JSON.stringify(result));expect(result.minimum).toBe(8);expect(result.after).toEqual(result.before);expect(result.saved).toBe(0);
});
