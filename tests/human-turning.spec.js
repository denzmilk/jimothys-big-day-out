import {test,expect} from '@playwright/test';import {boot} from './helpers.mjs';

test('all twelve human bodies replant their feet after stationary half-turns at 30/60/120 Hz',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));await boot(page);
 const rows=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,T=await import('/node_modules/three/build/three.module.js'),rows=[];
  for(const p of [...s.people])s._remove(p);
  for(const hz of [30,60,120])for(let model=0;model<s.models.length;model++){
   const p=s._spawn({x:0,z:0,key:'turn'},model),ground=p.grounding;ground.ground=()=>0;ground.reset();
   let jumps=0,stanceError=0,previous=null,steps=0;
   for(let i=0;i<hz*4;i++){
    p.mesh.rotation.y=Math.PI*Math.min(1,Math.max(0,(i/hz-.5)/1.5));p.mixer.update(1/hz);ground.update(p.actions.Idle,false,1/hz);
    const feet=ground.legs.map(l=>l.foot.getWorldPosition(new T.Vector3()));if(previous)jumps=Math.max(jumps,...feet.map((f,n)=>f.distanceTo(previous[n])));previous=feet;
    for(const f of ground.contacts)if(f.stance)stanceError=Math.max(stanceError,Math.abs(f.error));else steps++;
   }
   const placement=ground.legs.map(l=>{const actual=p.mesh.worldToLocal(l.foot.getWorldPosition(new T.Vector3()));return{side:l.foot.name,across:actual.x,rest:l.rest.x,error:Math.hypot(actual.x-l.rest.x,actual.z-l.rest.z)};});
   rows.push({hz,model:p.model,placement,jumps,stanceError,steps});s._remove(p);
  }return rows;
 });console.log('HUMAN_STATIONARY_TURN',JSON.stringify(rows));for(const r of rows){expect(r.steps,r.model).toBeGreaterThan(0);for(const f of r.placement){expect(f.across*f.rest,JSON.stringify(r)).toBeGreaterThan(0);expect(f.error).toBeLessThan(.1);}expect(r.jumps).toBeLessThan(.2);expect(r.stanceError).toBeLessThan(.15);}expect(errors).toEqual([]);
});

test('a real shore exit settles to a balanced stance after the walker stops',async({page})=>{
 await boot(page);const r=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,T=await import('/node_modules/three/build/three.module.js');teleportJimothy(69.0833333333,-697.4072751356);advanceTime(.4);
  for(const p of [...s.people])s._remove(p);s._graphAround(69,-697);s.populationPending=false;s.activities.enabled=false;
  const p=s._spawn({x:69.0833333333,z:-697.4072751356,key:'shore'},0);p.y=-1;p.mesh.position.set(p.x,p.y,p.z);p.flee=100;
  for(let i=0;i<1080;i++){s.update(1/30);g.water.update(1/30);g.physics.update(1/30);}
  return{active:p.swimmer.active,animation:p.animation,feet:p.grounding.legs.map(l=>{const v=p.mesh.worldToLocal(l.foot.getWorldPosition(new T.Vector3()));return{across:v.x,rest:l.rest.x,error:Math.hypot(v.x-l.rest.x,v.z-l.rest.z)};})};
 });console.log('SHORE_STANCE',JSON.stringify(r));expect(r.active).toBe(false);expect(r.animation).toBe('Idle');for(const f of r.feet){expect(f.across*f.rest).toBeGreaterThan(0);expect(f.error).toBeLessThan(.1);}
});
