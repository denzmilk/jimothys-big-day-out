import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('departing traffic is replenished while Jimothy stands still without growing bodies',async({page})=>{
 await boot(page);
 const result=await page.evaluate(()=>{
  const g=window.__game,s=g.streetLife,centre={...s.center};
  window.advanceTime(.75);
  const far=s.routes.roads.find(r=>Math.hypot(r.start.x-centre.x,r.start.z-centre.z)>150);
  const counts=()=>({b:g.physics.world.bodies.length,e:g.collector.entities.size});const before=counts();let minimum=Infinity;
  for(let i=0;i<12;i++){
   const car=s.items.find(p=>p.driving);s.assignRoute(car,far,far.length/2);s.update(0);
   minimum=Math.min(minimum,s.items.filter(p=>p.driving&&Math.hypot(p.mesh.position.x-centre.x,p.mesh.position.z-centre.z)<100).length);
  }
  // Occupants now leave with their car. Let the normal population and driver
  // refresh finish before comparing exact counts; the limits are unchanged.
  window.advanceTime(.75);
  return {minimum,before,after:counts(),saved:s.saved.size,centre:s.center,people:g.pedestrians.people.length,drivers:g.driving.drivers.size,buried:g.pedestrians.people.filter(p=>!p.attached&&p.y<g.voxels.terrainHeightAt(p.x,p.z)-1).length};
 });
 console.log('TRAFFIC_REPLENISH',JSON.stringify(result));expect(result.minimum).toBe(8);expect(result.after).toEqual(result.before);expect(result.saved).toBe(0);expect(result.people).toBe(36);expect(result.drivers).toBe(8);expect(result.buried).toBe(0);
});
