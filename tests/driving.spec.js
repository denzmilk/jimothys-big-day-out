import {test,expect} from '@playwright/test';
import {boot,adv,state} from './helpers.mjs';

const errors=new WeakMap();
test.beforeEach(async({page})=>{const log=[];errors.set(page,log);page.on('pageerror',e=>log.push(String(e)));page.on('console',m=>{if(m.type()==='error')log.push(m.text());});});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

async function setup(page,options){
 await boot(page,options);expect((await state(page)).driving,'player vehicle system exists').toBeDefined();
 return page.evaluate(()=>{
  const g=window.__game,s=g.streetLife,d=g.driving;
  d.syncDrivers();const p=[...d.cars.values()].find(p=>d.drivers.has(p.id));
  if(!p)throw Error('No visibly occupied car');
  const road=s.routes.roads.find(r=>r.length>70&&Math.hypot(r.start.x,r.start.z)<100);
  for(const q of s.items)q.driving=false;
  s.assignRoute(p,road,road.length*.35);p.driving=false;p.route.speed=0;
  window.testCar=p;const side=d.exitPoint(p,g.jimothy.radius);
  if(!side)throw Error('No clear fixture door');window.teleportJimothy(side.x,side.z);d.afterUpdate(0);
  return {id:p.id,driver:d.drivers.get(p.id).id};
 });
}

test('seated people are owned by the car, so tools and rolling cannot borrow them twice',async({page})=>{
 const f=await setup(page);const r=await page.evaluate(id=>{const g=__game;return {registry:g.collector.entities.get(id).attached,body:g.physics.actors.get(id).active};},f.driver);
 expect(r.registry).toBe(true);expect(r.body).toBe(false);
});
async function enter(page){await page.locator('canvas').first().focus();await page.keyboard.press('y');await adv(page,.2);expect((await state(page)).driving.phase).toBe('boarding');await adv(page,2);expect((await state(page)).driving.phase).toBe('driving');}

test('a stopped car can pull out of a shallow ditch forwards or backwards while walls still block it',async({page})=>{
 await setup(page);await enter(page);
 const rows=await page.evaluate(()=>{
  const g=__game,d=g.driving,p=testCar,origin=p.mesh.position.clone(),floor=origin.y-p.half[1],originalGround=d.ground,originalSolid=g.voxels.solidAtWorld,originalContacts=d.contacts,rows=[];
  // A repeatable cross-section isolates the ditch lip from random road props.
  // The loaded six-car road check separately covers generated terrain contact.
  d.contacts=()=>[];
  for(const throttle of [1,-1]){
   const ground=(x,z)=>floor+Math.min(.9,Math.max(0,Math.abs(z-origin.z)-2)*.45);
   d.ground=ground;g.voxels.solidAtWorld=(x,y,z)=>y<ground(x,z);
   p.mesh.position.copy(origin);p.yaw=0;p.mesh.rotation.set(0,0,0);d.speed=0;d.steer=0;
   g.input.codes.clear();g.input.codes.add(throttle>0?'KeyW':'KeyS');
   for(let i=0;i<120;i++){g.input.update(1/60);d.update(1/60);}
   rows.push({throttle,distance:(p.mesh.position.z-origin.z)*throttle,rise:p.mesh.position.y-origin.y,phase:d.phase,contact:d.lastContact});
  }
  // Supply the same wall to height and occupancy queries, as real voxels do.
  d.ground=(x,z)=>z>origin.z+p.half[2]+1?floor+3:floor;g.voxels.solidAtWorld=(x,y,z)=>y<floor||(z>origin.z+p.half[2]+1&&y<floor+3);
  p.mesh.position.copy(origin);p.yaw=0;p.mesh.rotation.set(0,0,0);d.speed=0;d.steer=0;g.input.codes.clear();g.input.codes.add('KeyW');
  for(let i=0;i<60;i++){g.input.update(1/60);d.update(1/60);}
  rows.push({wall:true,distance:p.mesh.position.z-origin.z});g.input.codes.clear();d.ground=originalGround;g.voxels.solidAtWorld=originalSolid;d.contacts=originalContacts;return rows;
 });console.log('DITCH_PULL',rows);
 for(const row of rows.filter(r=>!r.wall)){expect(row.phase).toBe('driving');expect(row.distance).toBeGreaterThan(5);expect(row.rise).toBeGreaterThan(.7);}
 expect(rows.at(-1).distance).toBeLessThan(1.4);
});

test('hijack has a visible occupant and boarding delay, then releases the same person alive',async({page})=>{
 const f=await setup(page);const before=await page.evaluate(id=>{const p=window.__game.pedestrians.people.find(p=>p.id===id);return {attached:p.attached,visible:p.mesh.visible,seated:!!p.vehicleSeat};},f.driver);
 expect(before).toEqual({attached:true,visible:true,seated:true});await enter(page);
 const r=await page.evaluate(id=>{const g=window.__game,p=g.pedestrians.people.find(p=>p.id===id);return {count:g.pedestrians.people.filter(p=>p.id===id).length,attached:p.attached,flee:p.flee,mask:g.jimothy.body.collisionFilterMask,carActive:g.physics.props.get(window.testCar.id).active};},f.driver);
 expect(r.count).toBe(1);expect(r.attached).toBe(false);expect(r.flee).toBeGreaterThan(0);expect(r.mask).toBe(0);expect(r.carActive).toBe(true);
});

test('throttle moves the car and rider, braking stops before reverse, and on-foot actions stay off',async({page})=>{
 await setup(page);await enter(page);const start=await page.evaluate(()=>window.testCar.mesh.position.toArray());
 await page.keyboard.down('w');await page.keyboard.press('e');await page.keyboard.press('c');await adv(page,1.3);await page.keyboard.up('w');
 const moving=await state(page);expect(moving.driving.speed).toBeGreaterThan(1);expect(moving.jimothy.move).toBe(null);
 const distance=await page.evaluate(p=>window.testCar.mesh.position.distanceTo({x:p[0],y:p[1],z:p[2]}),start);expect(distance).toBeGreaterThan(2);
 await page.keyboard.down('s');await adv(page,.15);expect((await state(page)).driving.speed).toBeGreaterThanOrEqual(0);await adv(page,1.4);await page.keyboard.up('s');expect((await state(page)).driving.speed).toBeLessThan(0);
});

test('exit is grounded, blocks at speed, and oversized or distant entry fails',async({page})=>{
 await setup(page);await enter(page);await page.keyboard.down('w');await adv(page,1);await page.keyboard.up('w');await page.keyboard.press('y');await adv(page,.05);expect((await state(page)).driving.phase).toBe('driving');
 await page.keyboard.down(' ');await adv(page,1);await page.keyboard.up(' ');await page.keyboard.press('y');await adv(page,.2);expect((await state(page)).driving.phase).toBe('onFoot');
 const r=await page.evaluate(()=>{const g=window.__game;return {gap:g.jimothy.body.position.y-g.jimothy.radius-g.voxels.groundHeightAt(g.jimothy.position.x,g.jimothy.position.z,g.jimothy.body.position.y),mask:g.jimothy.body.collisionFilterMask};});expect(Math.abs(r.gap)).toBeLessThan(.08);expect(r.mask).not.toBe(0);
 await page.evaluate(()=>window.setFatness(400));await page.keyboard.press('y');await adv(page,.05);expect((await state(page)).driving.phase).toBe('onFoot');
});

test('wall sweep stops a driven car and a hard crash damages it and restores the rider',async({page})=>{
 await setup(page);await enter(page);
 const r=await page.evaluate(()=>{
  const g=window.__game,d=g.driving,p=window.testCar,origin=p.mesh.position.clone(),dir={x:Math.sin(p.yaw),z:Math.cos(p.yaw)},original=g.voxels.solidAtWorld.bind(g.voxels);
  const originalGround=d.ground,wall=(x,z)=>(x-origin.x)*dir.x+(z-origin.z)*dir.z>p.half[2]+2;
  d.ground=(x,z,from)=>wall(x,z)?origin.y+3:originalGround.call(d,x,z,from);
  g.voxels.solidAtWorld=(x,y,z)=>(wall(x,z)&&y>origin.y-p.half[1]+.3)||original(x,y,z);
  d.speed=22;g.input.codes.add('KeyW');window.advanceTime(.5);g.input.codes.clear();g.voxels.solidAtWorld=original;d.ground=originalGround;
  return {travel:(p.mesh.position.x-origin.x)*dir.x+(p.mesh.position.z-origin.z)*dir.z,phase:d.phase,crashes:d.crashes,broken:g.streetLife.destroyed.has(p.id),mask:g.jimothy.body.collisionFilterMask};
 });expect(r.travel).toBeLessThan(2.3);expect(r.crashes).toBeGreaterThan(0);expect(r.broken).toBe(true);expect(r.phase).toBe('onFoot');expect(r.mask).not.toBe(0);
});

test('car destruction and repeated restart release all ownership',async({page})=>{
 await setup(page);await enter(page);
 await page.evaluate(()=>{const g=window.__game,p=window.testCar;g.streetLife.fracture(p,p.mesh.position.x,p.mesh.position.z,4);});await adv(page,.2);expect((await state(page)).driving.phase).toBe('onFoot');
 const counts=await page.evaluate(()=>{const g=window.__game,out=[];for(let i=0;i<3;i++){window.restartGame();window.advanceTime(.2);out.push({b:g.physics.world.bodies.length,p:g.pedestrians.people.length,d:g.driving.drivers.size,mask:g.jimothy.body.collisionFilterMask});}return out;});expect(counts[1]).toEqual(counts[2]);expect(counts[2].d).toBeGreaterThan(0);expect(counts[2].mask).not.toBe(0);
});

test('engine produces an audio signal and effects/loops stop on focus loss, exit and reset',async({page})=>{
 await setup(page);await enter(page);await page.keyboard.down('w');await adv(page,.4);await page.keyboard.up('w');
 await page.waitForTimeout(120);
 const sound=await page.evaluate(()=>window.__game.driving.effects.audioSnapshot());expect(sound.running).toBe(true);expect(sound.rms).toBeGreaterThan(.0001);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await adv(page,.1);expect((await state(page)).driving.audio.running).toBe(false);
 await page.evaluate(()=>window.restartGame());await adv(page,.1);const s=await state(page);expect(s.driving.phase).toBe('onFoot');expect(s.driving.effects).toBeLessThanOrEqual(s.driving.effectLimit);expect(s.driving.audio.running).toBe(false);
});

test('an outside blast ejects the rider without cancelling the physical launch',async({page})=>{
 await setup(page);await enter(page);
 const r=await page.evaluate(()=>{const g=window.__game,j=g.jimothy;g.military.explode(j.vel.clone().copy(j.body.position).add({x:0,y:-.5,z:0}),.7);return {phase:g.driving.phase,type:j.body.type,vy:j.body.velocity.y,launched:j.launched};});
 expect(r.phase).toBe('onFoot');expect(r.type).toBe(1);expect(r.vy).toBeGreaterThan(1);expect(r.launched).toBeGreaterThan(0);
});

test('a released driver restores full standing height and grounded feet',async({page})=>{
 const f=await setup(page);await enter(page);await adv(page,1);
 const r=await page.evaluate(id=>{const p=__game.pedestrians.people.find(p=>p.id===id);p.mesh.updateMatrixWorld(true);return {height:p.height,head:p.visual.getObjectByName('head').getWorldPosition(p.mesh.position.clone()).y-p.y,base:p.grounding.baseY,visual:p.visual.position.y,feet:p.grounding.contacts};},f.driver);
 console.log('DRIVER_RELEASE',r);expect(r.head).toBeGreaterThan(r.height*.7);for(const f of r.feet)expect(Math.abs(f.error)).toBeLessThan(.2);
 const turns=await page.evaluate(id=>{const p=__game.pedestrians.people.find(p=>p.id===id),rows=[];for(let i=0;i<24;i++){advanceTime(.1);p.mesh.updateMatrixWorld(true);rows.push({head:p.visual.getObjectByName('head').getWorldPosition(p.mesh.position.clone()).y-p.y,error:Math.max(0,...p.grounding.contacts.filter(f=>f.stance).map(f=>Math.abs(f.error)))});}return rows;},f.driver);console.log('DRIVER_TURNS',turns);
 // A raised kerb briefly bends the knees. Reject a retained seated crouch,
 // while allowing that short supported step rather than demanding a rigid torso.
 let low=0,longest=0;for(const row of turns){low=row.head<r.height*.7?low+.1:0;longest=Math.max(longest,low);}expect(longest).toBeLessThanOrEqual(.3);expect(Math.min(...turns.map(row=>row.head))).toBeGreaterThan(r.height*.55);expect(Math.max(...turns.map(row=>row.error))).toBeLessThan(.2);
});

test('gamepad entry, throttle, steering, handbrake and exit use the vehicle controller',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{window.drivePad={connected:true,id:'test vehicle pad',axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.drivePad]});drivePad.buttons[3]={pressed:true,value:1};});
 await adv(page,.1);await page.evaluate(()=>{drivePad.buttons[3]={pressed:false,value:0};});await adv(page,1.6);expect((await state(page)).driving.phase).toBe('driving');
 await page.evaluate(()=>{drivePad.buttons[7]={pressed:true,value:1};drivePad.axes[0]=.25;});await adv(page,.8);const s=await state(page);expect(s.driving.speed).toBeGreaterThan(1);expect(Math.abs(s.driving.steer)).toBeGreaterThan(.01);
 await page.evaluate(()=>{drivePad.buttons[7]={pressed:false,value:0};drivePad.buttons[0]={pressed:true,value:1};drivePad.axes[0]=0;});await adv(page,.6);expect(Math.abs((await state(page)).driving.speed)).toBeLessThan(.1);
 await page.evaluate(()=>{drivePad.buttons[0]={pressed:false,value:0};drivePad.buttons[3]={pressed:true,value:1};});await adv(page,.1);expect((await state(page)).driving.phase).toBe('onFoot');
});

test('all six cars retain tyre contact and original rider size through boarding and movement',async({page})=>{
 await setup(page);
 const r=await page.evaluate(()=>{
  const g=__game,d=g.driving,s=g.streetLife,fixture=testCar,at=fixture.mesh.position.clone(),rows=[];for(const p of [...s.items])if(p.kind==='car')s.remove(p);
  for(let seed=0;seed<6;seed++){
   const p=s.spawn(`model-check-${seed}`,'car',{x:at.x,z:at.z,seed,key:'model-check'},false);p.yaw=0;s.poseVehicle(p);const exit=d.exitPoint(p,g.jimothy.radius);teleportJimothy(exit.x,exit.z);const before=g.jimothy.radius;d.enter(p);advanceTime(1.5);g.input.codes.add('KeyW');advanceTime(.5);g.input.codes.clear();p.mesh.updateMatrixWorld(true);
   const gaps=d.wheels.map(w=>{let min=Infinity;const a=w.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=w.localToWorld(at.clone().fromBufferAttribute(a,i));min=Math.min(min,v.y-g.voxels.groundHeightAt(v.x,v.z,v.y+1));}return min;});
   rows.push({seed,phase:d.phase,radius:g.jimothy.radius,before,gaps,parts:d.door.parts.length,riderAngle:g.jimothy.group.quaternion.angleTo(p.mesh.quaternion)});d.exit(true);s.remove(p);
  }return rows;
 });console.log('MODEL_CONTACT',r);for(const row of r){expect(row.phase).toBe('driving');expect(row.radius).toBe(row.before);expect(row.parts).toBeGreaterThan(0);expect(row.riderAngle).toBeLessThan(.001);expect(row.gaps).toHaveLength(4);for(const gap of row.gaps)expect(Math.abs(gap)).toBeLessThan(.10);}
});

test('growth, water entry, map pause and travel end the ride without leaving collision disabled',async({page})=>{
 await setup(page);await enter(page);
 await page.evaluate(()=>{__game.landmarks.toggleMap(true);advanceTime(.1);});expect((await state(page)).driving.audio.running).toBe(false);
 const fit=await page.evaluate(()=>{__game.landmarks.toggleMap(false);setFatness(20);const fits=__game.driving.fits(testCar);advanceTime(.1);return fits;});expect(fit).toBe(false);expect((await state(page)).driving.phase).toBe('onFoot');
 await page.evaluate(()=>{setFatness(0);const g=__game,p=testCar,at=g.driving.exitPoint(p,g.jimothy.radius);teleportJimothy(at.x,at.z);g.driving.enter(p);advanceTime(1.5);if(g.driving.phase!=='driving')throw Error('Water fixture failed to board');const original=g.water.sample.bind(g.water);g.water.sample=()=>({height:p.mesh.position.y+1,depth:2});advanceTime(.05);g.water.sample=original;});expect((await state(page)).driving.phase).toBe('onFoot');
 expect(await page.evaluate(()=>__game.jimothy.body.collisionFilterMask)).not.toBe(0);
 await page.evaluate(()=>{teleportJimothy(420,-140);advanceTime(.3);});const s=await state(page);expect(s.streetLife.traffic).toBeGreaterThan(0);expect(s.driving.drivers.length).toBeLessThanOrEqual(8);
});


test('water below an elevated road does not eject the rider',async({page})=>{
 await setup(page);await enter(page);
 await page.evaluate(()=>{const g=__game,p=testCar,original=g.water.sample.bind(g.water);g.water.sample=()=>({height:p.mesh.position.y-p.half[1]-2,depth:3});advanceTime(.1);g.water.sample=original;});
 expect((await state(page)).driving.phase).toBe('driving');
});


test('car contact shoves a light prop and knocks a pedestrian into shared ragdoll physics',async({page})=>{
 await setup(page);await enter(page);
 const r=await page.evaluate(()=>{
  const g=__game,d=g.driving,p=testCar,origin=p.mesh.position.clone(),yaw=p.yaw,at=origin.clone();at.x+=Math.sin(yaw)*(p.half[2]-.1);at.z+=Math.cos(yaw)*(p.half[2]-.1);
  const q=g.streetLife.spawn('drive-impact-hydrant','hydrant',{x:at.x,z:at.z,seed:0,key:'drive-impact'},false),human=g.pedestrians.people.find(p=>!p.attached&&!p.ragdoll);
  g.pedestrians.activities.stop(human);human.x=at.x;human.z=at.z;human.y=g.voxels.groundHeightAt(at.x,at.z,origin.y);human.mesh.position.set(at.x,human.y,at.z);human.mesh.updateMatrixWorld(true);
  d.speed=6;d.move(1/60);const body=g.physics.props.get(q.id).body;
  return {loose:q.loose,type:body.type,speed:body.velocity.length(),ragdoll:g.ragdolls.active.has(human.id),bodies:g.physics.ragdolls.get(human.id)?.bodies.length};
 });expect(r.loose).toBe(true);expect(r.type).toBe(1);expect(r.speed).toBeGreaterThan(2);expect(r.ragdoll).toBe(true);expect(r.bodies).toBeGreaterThan(5);
});

test('collecting an occupied car releases its driver once and displaced cars survive travel',async({page})=>{
 const f=await setup(page);
 const r=await page.evaluate(id=>{
  const g=__game,p=testCar,driver=g.driving.drivers.get(p.id);setFatness(90);teleportJimothy(p.mesh.position.x,p.mesh.position.z);g.jimothy.postUpdate(0);g.jimothy.move={kind:'roll',elapsed:0};g.collector.update(0);
  const result={collected:p.attached,driverDetached:!driver.attached,owned:g.driving.drivers.has(p.id),drivers:g.pedestrians.people.filter(q=>q.id===id).length};g.jimothy.move=null;g.collector.release();return result;
 },f.driver);expect(r).toEqual({collected:true,driverDetached:true,owned:false,drivers:1});
 await page.evaluate(()=>restartGame());await adv(page,.2);await setup(page);await enter(page);await page.keyboard.down('w');await adv(page,.8);await page.keyboard.up('w');await page.keyboard.down(' ');await adv(page,.8);await page.keyboard.up(' ');await page.keyboard.press('y');await adv(page,.1);
 const saved=await page.evaluate(()=>{const g=__game,p=testCar,pos=p.mesh.position.clone(),id=p.id;teleportJimothy(420,-140);advanceTime(.1);const streamed=!g.driving.cars.has(id);teleportJimothy(pos.x,pos.z);advanceTime(.1);const back=g.driving.cars.get(id);return{streamed,back:!!back,gap:back?.mesh.position.distanceTo(pos),driving:back?.driving};});expect(saved.streamed).toBe(true);expect(saved.back).toBe(true);expect(saved.gap).toBeLessThan(.1);expect(saved.driving).toBe(false);
});


test('fast or obstructed boarding and blocked normal exits leave ownership unchanged',async({page})=>{
 await setup(page);
 const denied=await page.evaluate(()=>{const g=__game,d=g.driving,p=testCar;p.route.speed=6;const fast=d.enter(p);p.route.speed=0;const original=g.voxels.solidAtWorld.bind(g.voxels);g.voxels.solidAtWorld=()=>true;const blocked=d.enter(p);g.voxels.solidAtWorld=original;return{fast,blocked,phase:d.phase,mask:g.jimothy.body.collisionFilterMask};});expect(denied.fast).toBe(false);expect(denied.blocked).toBe(false);expect(denied.phase).toBe('onFoot');expect(denied.mask).not.toBe(0);
 await enter(page);const r=await page.evaluate(()=>{const g=__game,original=g.voxels.solidAtWorld.bind(g.voxels);g.voxels.solidAtWorld=()=>true;const exited=g.driving.exit();g.voxels.solidAtWorld=original;return{exited,phase:g.driving.phase,mask:g.jimothy.body.collisionFilterMask};});expect(r).toEqual({exited:false,phase:'driving',mask:0});
});


test('boarding blends the driver upright and preserves Jimothy paws until climbing starts',async({page})=>{
 const f=await setup(page,{withRig:true});const before=await page.evaluate(()=>Object.fromEntries(['FL','FR','RL','RR'].flatMap(n=>['leg_'+n,'shin_'+n]).map(n=>[n,__game.jimothy.rig.bones[n].quaternion.toArray()])));
 await page.locator('canvas').first().focus();await page.keyboard.press('y');await adv(page,.2);
 const error=await page.evaluate(before=>Math.max(...Object.entries(before).map(([n,q])=>__game.jimothy.rig.bones[n].quaternion.angleTo(__game.jimothy.rig.bones[n].quaternion.clone().fromArray(q)))),before);expect(error).toBeLessThan(.01);
 await adv(page,.45);const gap=await page.evaluate(id=>{const p=__game.pedestrians.people.find(p=>p.id===id);return Math.abs(p.visual.position.y-p.driverBase.y);},f.driver);expect(gap).toBeLessThan(.10);await adv(page,.1);const separation=await page.evaluate(id=>{const p=__game.pedestrians.people.find(p=>p.id===id),j=__game.jimothy.body.position;return Math.hypot(p.mesh.position.x-j.x,p.mesh.position.z-j.z);},f.driver);expect(separation).toBeGreaterThan(.9);
});

test('a driven car crosses the steep generated street and junction in both directions at 30/60/120 Hz',async({page})=>{
 await setup(page);await enter(page);
 const result=await page.evaluate(()=>{
  const g=__game,d=g.driving,p=testCar,s=g.streetLife,original=d.contacts,rows=[];
  // Keep live generated road/voxel queries; traffic props have separate cases.
  d.contacts=()=>[];
  for(const hz of [30,60,120])for(const direction of [1,-1]){
   p.mesh.position.set(67.35,0,direction>0?40:88);p.yaw=direction>0?0:Math.PI;p.mesh.rotation.set(0,p.yaw,0);s.poseVehicle(p);d.lastContact=null;
   const start=p.mesh.position.clone();let wheelGap=0,maxStep=0;
   for(let i=0;i<hz*6&&d.car;i++){
    const oldY=p.mesh.position.y;d.speed=8;d.move(1/hz);
    wheelGap=Math.max(wheelGap,...p.grounding.wheelGaps.map(Math.abs));maxStep=Math.max(maxStep,Math.abs(p.mesh.position.y-oldY));
    if(d.speed===0)break;
   }
   rows.push({hz,direction,distance:(p.mesh.position.z-start.z)*direction,wheelGap,maxStep,contact:d.lastContact,phase:d.phase});
  }
  d.contacts=original;d.publish();return {rows,state:JSON.parse(render_game_to_text()).driving};
 });console.log('STEEP_DRIVE',JSON.stringify(result.rows));
 for(const r of result.rows){expect(r.phase).toBe('driving');expect(r.distance,JSON.stringify(r)).toBeGreaterThan(45);expect(r.wheelGap).toBeLessThan(.2);expect(r.maxStep).toBeLessThan(.45);}
});
