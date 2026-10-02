import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('street walking has continuous hip and foot movement across support changes',async({page})=>{
  await boot(page);
  const report=await page.evaluate(()=>{
    const g=window.__game,previous=new Map();let hipJump=0,footJump=0,samples=0;
    const errors=[];
    for(let frame=0;frame<360;frame++){
      g.pedestrians.update(1/60);
      for(const p of g.pedestrians.people){
        const hip=p.grounding.legs[0].hip.getWorldPosition(p.mesh.position.clone());
        const feet=p.grounding.legs.map(l=>l.foot.getWorldPosition(p.mesh.position.clone()));
        const last=previous.get(p.id);
        if(last){hipJump=Math.max(hipJump,Math.abs(hip.y-last.hip.y));footJump=Math.max(footJump,...feet.map((f,i)=>f.distanceTo(last.feet[i])));samples++;}
        previous.set(p.id,{hip,feet});
        for(const foot of p.grounding.contacts)if(foot.stance)errors.push(Math.abs(foot.error));
      }
    }
    errors.sort((a,b)=>a-b);
    return {hipJump,footJump,samples,p95:errors[Math.floor(errors.length*.95)],maxError:Math.max(...errors)};
  });
  console.log('STREET_IK',JSON.stringify(report));
  expect(report.samples).toBeGreaterThan(10000);
  expect(report.hipJump).toBeLessThan(.06);
  expect(report.footJump).toBeLessThan(.15);
  expect(report.p95).toBeLessThan(.06);expect(report.maxError).toBeLessThan(.15);
});

test('walking and running transitions stay stable at 30, 60 and 120 Hz',async({page})=>{
  await boot(page);
  const reports=await page.evaluate(()=>{
    const g=window.__game,reports=[];
    for(let model=0;model<g.pedestrians.models.length;model++)for(const hz of [30,60,120]){
      const p=g.pedestrians.people[model],dt=1/hz;
      p.grounding.ground=(x,z)=>.3*z+.2*x;p.grounding.reset();p.mesh.position.set(0,.035,0);p.mesh.rotation.set(0,0,0);
      let previous=null,hipSpeed=0;const errors=[];
      for(let frame=0;frame<hz*4;frame++){
        const t=frame/hz,speed=t<1.2?1.4:t<2.4||t>=3?4.2:0;
        p.mesh.position.z+=speed*dt;p.mesh.position.y=.3*p.mesh.position.z+.035;
        g.pedestrians._animate(p,speed>2?'Run':speed?'Walk':'Idle');p.mixer.update(dt);
        p.grounding.update(p.actions[p.animation],speed>0,dt);
        const hip=p.grounding.legs[0].hip.getWorldPosition(p.mesh.position.clone());
        if(previous)hipSpeed=Math.max(hipSpeed,Math.abs(hip.y-previous.y)*hz);previous=hip;
        for(const foot of p.grounding.contacts)if(foot.stance)errors.push(Math.abs(foot.error));
      }
      const before=p.grounding.legs.map(l=>l.foot.getWorldPosition(p.mesh.position.clone()));
      for(let i=0;i<10;i++){p.mixer.update(0);p.grounding.update(p.actions[p.animation],true,0);}
      const frozenDrift=Math.max(...p.grounding.legs.map((l,i)=>l.foot.getWorldPosition(p.mesh.position.clone()).distanceTo(before[i])));
      errors.sort((a,b)=>a-b);reports.push({model:p.model,hz,hipSpeed,frozenDrift,p95:errors[Math.floor(errors.length*.95)],maxError:Math.max(...errors)});
    }
    return reports;
  });
  console.log('TIMESTEP_IK',JSON.stringify(reports));
  expect(reports).toHaveLength(36);
  for(const r of reports){
    expect(r.hipSpeed,JSON.stringify(r)).toBeLessThan(3.6);expect(r.frozenDrift,JSON.stringify(r)).toBeLessThan(.0001);
    expect(r.p95,JSON.stringify(r)).toBeLessThan(.12);expect(r.maxError,JSON.stringify(r)).toBeLessThan(.2);
  }
});

test('all people walk, stop and resume smoothly on uphill, downhill and cross slopes',async({page})=>{
  await boot(page);
  const reports=await page.evaluate(()=>{
    const g=window.__game,reports=[];
    for(let model=0;model<g.pedestrians.models.length;model++)for(const [sx,sz] of [[0,.5],[0,-.5],[.45,0]]){
      const p=g.pedestrians.people.find(p=>p.model===g.pedestrians.people[model].model);
      const ground=(x,z)=>sx*x+sz*z;
      p.grounding.ground=ground;p.mesh.position.set(0,0,0);p.mesh.rotation.set(0,0,0);
      let last=null,hipJump=0,footJump=0;const errors=[];
      for(let frame=0;frame<300;frame++){
        const moving=frame<120||frame>=180,dt=1/60;
        if(moving)p.mesh.position.z+=1.4*dt;
        p.mesh.position.y=ground(p.mesh.position.x,p.mesh.position.z)+.035;
        g.pedestrians._animate(p,moving?'Walk':'Idle');p.mixer.update(dt);
        p.grounding.update(p.actions[p.animation],moving,dt);
        const hip=p.grounding.legs[0].hip.getWorldPosition(p.mesh.position.clone());
        const feet=p.grounding.legs.map(l=>l.foot.getWorldPosition(p.mesh.position.clone()));
        if(last&&frame>2){hipJump=Math.max(hipJump,Math.abs(hip.y-last.hip.y));footJump=Math.max(footJump,...feet.map((f,i)=>f.distanceTo(last.feet[i])));}
        last={hip,feet};
        for(const foot of p.grounding.contacts)if(foot.stance)errors.push(Math.abs(foot.error));
      }
      errors.sort((a,b)=>a-b);reports.push({model:p.model,sx,sz,hipJump,footJump,p95:errors[Math.floor(errors.length*.95)],maxError:Math.max(...errors)});
    }
    return reports;
  });
  console.log('RAMP_IK',JSON.stringify(reports));
  expect(reports).toHaveLength(36);
  for(const r of reports){
    expect(r.hipJump,JSON.stringify(r)).toBeLessThan(.06);
    expect(r.footJump,JSON.stringify(r)).toBeLessThan(.15);
    expect(r.p95,JSON.stringify(r)).toBeLessThan(.06);
    expect(r.maxError,JSON.stringify(r)).toBeLessThan(.15);
  }
});
