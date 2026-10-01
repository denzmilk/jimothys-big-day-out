import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

test('animated feet use individual ground contacts on streets and slopes',async({page})=>{
 await boot(page);await page.waitForFunction(()=>window.__game.pedestrians.ready);
 const errors=[];
 for(let step=0;step<8;step++){
  await adv(page,.15);
  const people=(await state(page)).people.items;
  for(const p of people)for(const f of p.feet)if(f.stance)errors.push(Math.abs(f.error));
 }
 expect(errors.length).toBeGreaterThan(100);
 const sorted=errors.sort((a,b)=>a-b);
 expect(sorted[Math.floor(sorted.length*.95)]).toBeLessThan(.12);
 expect(Math.max(...errors)).toBeLessThan(.3);
});

test('windows have transmissive glass, vehicles retain licensed models and ground tilt',async({page})=>{
 await boot(page);await page.waitForFunction(()=>window.__game.streetLife.ready);
 await adv(page,1);
 const report=await page.evaluate(()=>{
  const g=window.__game;let carGlass=0;for(const p of g.streetLife.items.filter(p=>p.kind==='car'))p.mesh.traverse(o=>{if(o.isMesh)for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m.transmission>0)carGlass++;});
  const panes=[...g.voxels.chunks.values()].filter(c=>c.mesh?.geometry.groups.some(g=>g.materialIndex===1)).length;
  return {wheelGaps:g.streetLife.items.filter(p=>p.kind==='car'&&!p.loose).flatMap(p=>p.grounding?.wheelGaps||[]),carGlass,panes,transmission:g.voxels.glassMaterial.transmission,sloped:g.streetLife.items.some(p=>p.driving&&Math.abs(p.grounding?.pitch||0)>.005)};
 });
 expect(report.carGlass).toBeGreaterThan(5);expect(report.panes).toBeGreaterThan(5);expect(report.transmission).toBeGreaterThan(.5);expect(report.sloped).toBe(true);
 expect(report.wheelGaps.length).toBeGreaterThan(20);expect(Math.max(...report.wheelGaps.map(Math.abs))).toBeLessThan(.1);
});
