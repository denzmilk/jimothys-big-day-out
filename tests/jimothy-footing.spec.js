import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

test('real Jimothy paws plant through walking, scurrying, turns and stops',async({page})=>{
  await boot(page,{withRig:true});
  const reports=await page.evaluate(()=>{
    const c=window.__game.jimothy,reports=[];
    for(const hz of [30,60,120])for(const grade of [0,.35,-.35]){
      const ground=(x,z)=>20+grade*z;c.voxels={groundHeightAt:ground,terrainHeightAt:ground,solidAtWorld:()=>false};
      c.reset();c.yaw=0;c.group.rotation.set(0,0,0);c.body.position.set(0,20+c.radius,0);
      let previous=null,drift=0,contacts=0,lift=0;const errors=[];
      for(let frame=0;frame<hz*4;frame++){
        const t=frame/hz,speed=t<1?3:t<2?6:t<3?10:0,angle=t<1.5?0:.7;
        c.vel.set(Math.sin(angle)*speed,0,Math.cos(angle)*speed);c.body.position.x+=c.vel.x/hz;c.body.position.z+=c.vel.z/hz;
        c.body.position.y=ground(c.body.position.x,c.body.position.z)+c.radius;c.elapsed+=1/hz;c.postUpdate(1/hz);
        const feet=c.legs.snapshot();
        for(let i=0;i<feet.length;i++){
          const f=feet[i];if(f.stance){contacts++;errors.push(Math.abs(f.y-ground(f.x,f.z)));
            if(grade===0&&previous?.[i].stance)drift=Math.max(drift,Math.hypot(f.x-previous[i].x,f.z-previous[i].z));
          }else if(Number.isFinite(f.y))lift=Math.max(lift,f.y-ground(f.x,f.z));
        }previous=feet;
      }
      errors.sort((a,b)=>a-b);reports.push({hz,grade,contacts,drift,lift,p95:errors[Math.floor(errors.length*.95)]});
    }return reports;
  });
  console.log('JIMOTHY_FOOTING',JSON.stringify(reports));
  for(const r of reports){expect(r.contacts).toBeGreaterThan(100);expect(r.p95).toBeLessThan(.06);expect(r.drift).toBeLessThan(.02);expect(r.lift).toBeGreaterThan(.05);}
});

test('idle gestures include scratching, interrupt on movement and reset',async({page})=>{
  await boot(page,{withRig:true});
  const r=await page.evaluate(()=>{
    const c=window.__game.jimothy,actions=new Set();let headTravel=0,last=null,support=0;
    for(let frame=0;frame<60*14;frame++){
      c.elapsed+=1/60;c.postUpdate(1/60);actions.add(c.idleAction??null);
      const p=c.rig.partCentroid('head');if(last)headTravel+=p.distanceTo(last);last=p;
      if(c.idleAction==='scratch')support=Math.max(support,c.legs.snapshot().filter(f=>f.stance).length);
    }return {actions:[...actions],headTravel,support};
  });
  expect(r.actions).toContain('scratch');expect(r.actions).toContain('look');expect(r.headTravel).toBeGreaterThan(.1);expect(r.support).toBe(3);
  await page.keyboard.down('w');await adv(page,.1);await page.keyboard.up('w');
  expect(await page.evaluate(()=>window.__game.jimothy.idleAction)).toBe(null);
  await page.evaluate(()=>window.restartGame());await adv(page,.1);
  expect(await page.evaluate(()=>window.__game.jimothy.idleAction)).toBe(null);
  expect((await state(page)).feet).toHaveLength(4);
});

test('paws negotiate cross slopes and kerbs without body jumps or zero-time drift',async({page})=>{
  await boot(page,{withRig:true});
  const reports=await page.evaluate(()=>{
    const c=window.__game.jimothy,reports=[];
    for(const kind of ['cross','kerb']){
      const ground=(x,z)=>20+(kind==='cross'?.4*x:z>1&&z<3?.22:0);
      c.voxels={groundHeightAt:ground,terrainHeightAt:ground,solidAtWorld:()=>false};c.reset();c.yaw=0;
      c.body.position.set(0,20+c.radius,0);let previous=null,jump=0;const errors=[];
      for(let f=0;f<240;f++){
        c.vel.set(0,0,1.4);c.body.position.z+=1.4/60;c.body.position.y=ground(0,c.body.position.z)+c.radius;c.elapsed+=1/60;c.postUpdate(1/60);
        const y=c.rig.bones.leg_FL.getWorldPosition(c.group.position.clone()).y;
        if(previous!==null)jump=Math.max(jump,Math.abs(y-previous));previous=y;
        for(const foot of c.legs.snapshot())if(foot.stance)errors.push(Math.abs(foot.error));
      }
      const before=c.legs.snapshot();for(let i=0;i<10;i++)c.postUpdate(0);
      const frozen=Math.max(...c.legs.snapshot().map((p,i)=>Math.hypot(p.x-before[i].x,p.y-before[i].y,p.z-before[i].z)));
      errors.sort((a,b)=>a-b);reports.push({kind,jump,frozen,p95:errors[Math.floor(errors.length*.95)]});
    }return reports;
  });
  console.log('JIMOTHY_KERBS',JSON.stringify(reports));
  for(const r of reports){expect(r.jump).toBeLessThan(.1);expect(r.frozen).toBeLessThan(.0001);expect(r.p95).toBeLessThan(.06);}
});

test('real terrain contacts reset across growth, rolls, hops and teleporting',async({page})=>{
  await boot(page,{withRig:true});
  await page.evaluate(()=>{window.teleportJimothy(75,-714);window.faceJimothy(0);});await adv(page,.3);
  for(const fat of [0,25,90]){
    await page.evaluate(f=>window.setFatness(f),fat);await adv(page,1);
    const s=await state(page);expect(s.feet.every(f=>Number.isFinite(f.y))).toBe(true);
    expect(s.feet.filter(f=>f.stance).length).toBe(4);
    for(const f of s.feet)expect(Math.abs(f.error)).toBeLessThan(.12);
  }
  await page.evaluate(()=>window.setFatness(0));await adv(page,1);
  await page.keyboard.press('c');await adv(page,.25);
  expect((await state(page)).feet.every(f=>!f.stance)).toBe(true);
  await adv(page,1);await page.keyboard.press('Space');await adv(page,.1);
  const air=await state(page);expect(air.jimothy.grounded).toBe(false);expect(air.feet.every(f=>!f.stance)).toBe(true);
  await adv(page,1);await page.evaluate(()=>window.teleportJimothy(0,0));await adv(page,.3);
  const landed=await state(page);expect(landed.jimothy.grounded).toBe(true);
  for(const f of landed.feet){expect(f.stance).toBe(true);expect(Math.abs(f.error)).toBeLessThan(.12);expect(Math.hypot(f.x,f.z)).toBeLessThan(1.5);}
});

test('raising a scratching paw leaves the torso skin in place',async({page})=>{
  await boot(page,{withRig:true});
  const displacement=await page.evaluate(()=>{
    const c=window.__game.jimothy,rig=c.rig,mesh=rig.skinned,point=c.group.position.clone();
    rig.pose('leg_FR');rig.pose('shin_FR');c.group.updateMatrixWorld(true);
    const hip=rig.bones.leg_FR.getWorldPosition(point.clone()),samples=[];
    for(let v=0;v<mesh.geometry.attributes.position.count;v++){
      const p=mesh.getVertexPosition(v,point.clone()).applyMatrix4(mesh.matrixWorld);
      if(p.y>hip.y+.25)samples.push({v,p});
    }
    rig.pose('leg_FR',1.2);rig.pose('shin_FR',.7);c.group.updateMatrixWorld(true);
    return Math.max(...samples.map(({v,p})=>mesh.getVertexPosition(v,point).applyMatrix4(mesh.matrixWorld).distanceTo(p)));
  });
  console.log('TORSO_PAW_DISPLACEMENT',displacement);expect(displacement).toBeLessThan(.025);
});

test('visible paws follow a freshly broken voxel surface',async({page})=>{
  await boot(page,{withRig:true});
  const r=await page.evaluate(()=>{
    const g=window.__game,c=g.jimothy,w=g.voxels;window.teleportJimothy(75,-714);
    const floor=w.groundHeightAt(75.8,-714,w.terrainHeightAt(75.8,-714)+.5);
    g.blastAt({x:75.8,y:floor+.06,z:-714},.4,{fatShare:0,digsTerrain:true});
    c.legs.reset();c.yaw=Math.PI/2;const errors=[];let contacts=0;
    for(let i=0;i<150;i++){
      c.body.position.x=74.8+i/60;c.body.position.y=w.groundHeightAt(c.body.position.x,-714,floor+1)+c.radius;
      c.vel.set(1,0,0);c.elapsed+=1/60;c.postUpdate(1/60);
      for(const f of c.legs.snapshot())if(f.stance){contacts++;errors.push(Math.abs(f.error));}
    }
    errors.sort((a,b)=>a-b);return {removed:JSON.parse(render_game_to_text()).voxels.removed,contacts,p95:errors[Math.floor(errors.length*.95)]};
  });
  console.log('JIMOTHY_BROKEN_GROUND',JSON.stringify(r));
  expect(r.removed).toBeGreaterThan(0);expect(r.contacts).toBeGreaterThan(100);expect(r.p95).toBeLessThan(.06);
});
