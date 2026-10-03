import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('the original raccoon walks with low steps, restrained knee splay and a supporting pair',async({page})=>{
  await boot(page,{withRig:true});
  const reports=await page.evaluate(()=>{
    const c=window.__game.jimothy,reports=[];window.setFatness(0);
    const ground=()=>20;c.voxels={groundHeightAt:ground,terrainHeightAt:ground,solidAtWorld:()=>false};
    for(const hz of [30,60,120])for(const speed of [1.5,3,6]){
      c.reset();c.yaw=0;c.elapsed=0;c.body.position.set(0,20+c.radius,0);
      let splay=0,lift=0,minSupport=4,fold=0;
      for(let frame=0;frame<hz*3;frame++){
        c.vel.set(0,0,speed);c.body.position.z+=speed/hz;c.elapsed+=1/hz;c.postUpdate(1/hz);
        const feet=c.legs.snapshot();minSupport=Math.min(minSupport,feet.filter(p=>p.stance).length);
        for(const paw of c.legs.paws){
          const hip=paw.hip.getWorldPosition(c.group.position.clone()),knee=paw.knee.getWorldPosition(c.group.position.clone()),foot=paw.end.getWorldPosition(c.group.position.clone());
          splay=Math.max(splay,Math.abs(knee.x-hip.x));
          fold=Math.max(fold,knee.clone().sub(hip).angleTo(foot.clone().sub(knee)));
        }
        lift=Math.max(lift,...feet.map(p=>p.y-20));
      }
      reports.push({hz,speed,splay,lift,minSupport,fold});
    }return reports;
  });
  console.log('SLINK_GAIT',JSON.stringify(reports));
  for(const r of reports){
    expect(r.splay,JSON.stringify(r)).toBeLessThan(.14);
    expect(r.lift,JSON.stringify(r)).toBeLessThan(.13);
    expect(r.fold,JSON.stringify(r)).toBeLessThan(1.85);
    expect(r.minSupport,JSON.stringify(r)).toBeGreaterThanOrEqual(2);
  }
});
