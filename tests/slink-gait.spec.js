import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('the original raccoon walks with low steps, restrained knee splay and a supporting pair',async({page})=>{
  await boot(page,{withRig:true});
  const reports=await page.evaluate(()=>{
    const c=window.__game.jimothy,reports=[];window.setFatness(0);
    const ground=()=>20;c.voxels={groundHeightAt:ground,physicalGroundHeightAt:ground,terrainHeightAt:ground,solidAtWorld:()=>false};
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

test('land paw cadence is measured across speeds, sizes and frame rates',async({page})=>{
 await boot(page,{withRig:true});
 const rows=await page.evaluate(()=>{
  const c=__game.jimothy,rows=[],ground=()=>20;c.voxels={groundHeightAt:ground,physicalGroundHeightAt:ground,terrainHeightAt:ground,solidAtWorld:()=>false};
  const scenarios=[...[30,60,120].flatMap(hz=>[1.5,6,10].map(speed=>({hz,speed,fat:0}))),...[25,90].map(fat=>({hz:60,speed:3,fat}))];
  for(const setup of scenarios){
   const {hz,speed,fat}=setup;c.reset();setFatness(fat);c.yaw=0;c.body.position.set(0,20+c.radius,0);c.legs.reset();
   const starts=[0,0,0,0],previous=[null,null,null,null];let drift=0,feet=null,travel=0;
   for(let frame=0;frame<hz*3;frame++){
    c.vel.set(0,0,speed);c.body.position.z+=speed/hz;travel+=speed/hz;c.elapsed+=1/hz;c.postUpdate(1/hz);
    const next=c.legs.snapshot();c.legs.paws.forEach((p,i)=>{if(p.swing&&p.swing!==previous[i])starts[i]++;previous[i]=p.swing;if(next[i].stance&&feet?.[i].stance)drift=Math.max(drift,Math.hypot(next[i].x-feet[i].x,next[i].z-feet[i].z));});feet=next;
   }
   rows.push({...setup,starts,cadence:starts.reduce((a,b)=>a+b)/12,drift,travel,radius:c.radius,anatomy:c.rig.anatomyScale});
  }return rows;
 });console.log('LAND_CADENCE',JSON.stringify(rows));
 for(const r of rows){expect(r.cadence,JSON.stringify(r)).toBeLessThanOrEqual(r.speed>6?7:5);expect(r.drift).toBeLessThan(.02);}
 const slow=rows.find(r=>r.hz===60&&r.speed===1.5),walk=rows.find(r=>r.hz===60&&r.speed===6);expect(slow.cadence).toBeLessThan(walk.cadence);
 for(const speed of [1.5,6,10]){const rates=rows.filter(r=>r.fat===0&&r.speed===speed).map(r=>r.cadence);expect(Math.max(...rates)-Math.min(...rates)).toBeLessThanOrEqual(1);}
});


test('turning in place settles into planted paws and stopping does not leave a walk cycle',async({page})=>{
 await boot(page,{withRig:true});
 const rows=await page.evaluate(()=>{
  const c=__game.jimothy,rows=[],ground=()=>20;c.voxels={groundHeightAt:ground,physicalGroundHeightAt:ground,terrainHeightAt:ground,solidAtWorld:()=>false};
  for(const hz of [30,60,120]){
   c.reset();setFatness(0);c.yaw=0;c.body.position.set(0,20+c.radius,0);c.legs.reset();let lateStarts=0,maxJump=0,previousY=null;const last=[null,null,null,null];
   for(let frame=0;frame<hz*4;frame++){
    const t=frame/hz,speed=t<1?6:0;c.vel.set(0,0,speed);c.body.position.z+=speed/hz;c.yaw=t<1?0:Math.min(1,(t-1)*2)*Math.PI;c.elapsed+=1/hz;c.postUpdate(1/hz);
    c.legs.paws.forEach((paw,i)=>{if(t>2.5&&paw.swing&&paw.swing!==last[i])lateStarts++;last[i]=paw.swing;});
    const y=c.rig.root.position.y;if(previousY!==null)maxJump=Math.max(maxJump,Math.abs(y-previousY));previousY=y;
   }
   rows.push({hz,lateStarts,maxJump,support:c.legs.snapshot().filter(p=>p.stance).length});
  }return rows;
 });console.log('LAND_TURN_STOP',JSON.stringify(rows));
 for(const r of rows){expect(r.lateStarts).toBe(0);expect(r.support).toBe(4);expect(r.maxJump).toBeLessThan(.1);}
});
