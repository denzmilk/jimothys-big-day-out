import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

async function arrange(page,kind,{fatness=0,yaw=0,side=false}={}){
  return page.evaluate(({kind,fatness,yaw,side})=>{
    const g=window.__game;
    // Keep the target still so this measures contact resistance, not its AI
    // avoiding the approaching raccoon before the collision can occur.
    g.pedestrians.update=()=>{};g.pursuers.update=()=>{};g.interiors.update=()=>{};
    g.streetLife.populate=()=>{};g.military.update=()=>{};
    for(const p of [...g.streetLife.items])g.streetLife.remove(p);
    const human=kind==='person'?g.pedestrians.people[0]:null;
    for(const p of [...g.pedestrians.people])if(p!==human)g.pedestrians._remove(p);
    window.setFatness(fatness);
    const x=60,z=10,ground=g.voxels.terrainHeightAt(x,z);
    g.streetLife.center={x,z};
    let target,extent;
    if(human){
      human.x=x;human.z=z;human.y=ground;human.mesh.position.set(x,ground,z);
      target=human;extent=.45;
    }else{
      target=g.streetLife.spawn('weight-test-car','car',{x,z,key:'weight-test',seed:0},false);
      target.mesh.rotation.y=yaw;
      const body=g.physics.props.get(target.id).body;
      body.quaternion.copy(target.mesh.quaternion);body.position.copy(target.mesh.position);
      extent=target.half[side?0:2];
    }
    const angle=yaw+(side?Math.PI/2:0),dx=Math.sin(angle),dz=Math.cos(angle);
    const distance=extent+g.jimothy.radius+2;
    window.teleportJimothy(x+dx*distance,z+dz*distance);
    window.faceJimothy(angle+Math.PI);g.cameraSystem.yaw=angle+Math.PI;
    g.cameraSystem.aimPitch=0;g.jimothy.input.forcePointerLock=true;
    window.__weightTarget={id:target.id,x,z,dx,dz,extent};
    return window.__weightTarget;
  },{kind,fatness,yaw,side});
}

for(const side of [false,true])test(`lean roll stops at a car's ${side?'side':'nose'} without throwing it`,async({page})=>{
  await boot(page);const t=await arrange(page,'car',{yaw:side?.7:0,side});
  await page.keyboard.down('c');await adv(page,1.5);await page.keyboard.up('c');
  const r=await page.evaluate(()=>{
    const g=window.__game,t=window.__weightTarget,p=g.streetLife.items.find(p=>p.id===t.id),j=g.jimothy;
    return {exists:!!p,loose:p?.loose,travel:p?Math.hypot(p.mesh.position.x-t.x,p.mesh.position.z-t.z):999,
      front:(j.body.position.x-t.x)*t.dx+(j.body.position.z-t.z)*t.dz,radius:j.radius};
  });
  expect(r.exists).toBe(true);expect(r.loose).toBe(false);expect(r.travel).toBeLessThan(.15);
  expect(r.front).toBeGreaterThanOrEqual(t.extent+r.radius-.08);
});

for(const action of ['scurry','roll'])test(`lean ${action} loses momentum against a standing person`,async({page})=>{
  await boot(page);const t=await arrange(page,'person');
  if(action==='scurry'){await page.keyboard.down('w');await page.keyboard.down('Shift');}
  else await page.keyboard.down('c');
  await adv(page,1.2);
  const s=await state(page);
  expect(s.ragdolls.count).toBe(0);
  expect(s.jimothy.z).toBeGreaterThan(t.z+.8);
});

test('growing gives rolls human knockdown power, and giant car collection still works',async({page})=>{
  await boot(page,{withRig:true});const t=await arrange(page,'person',{fatness:25});
  await page.keyboard.down('c');await adv(page,.65);await page.keyboard.up('c');
  const knocked=await state(page);
  expect(knocked.ragdolls.items.some(p=>p.id===t.id)||knocked.collection.items.some(p=>p.id===t.id)).toBe(true);
  await page.evaluate(()=>window.restartGame());
  const car=await arrange(page,'car',{fatness:90});
  await page.keyboard.down('c');await adv(page,.8);await page.keyboard.up('c');
  const grown=await state(page);
  expect(grown.collection.items.some(p=>p.id===car.id)).toBe(true);
});

test('a deliberate lean headbutt topples one person but spends the lunge momentum',async({page})=>{
  await boot(page);const t=await arrange(page,'person');
  await page.evaluate(({x,z})=>window.teleportJimothy(x,z+1.5),t);
  await page.keyboard.press('e');await adv(page,.15);
  const s=await state(page);
  expect(s.ragdolls.items.some(p=>p.id===t.id)).toBe(true);
  expect(s.ragdolls.items.find(p=>p.id===t.id).speed).toBeLessThan(4);
  expect(s.jimothy.speed).toBeLessThan(3);
});
