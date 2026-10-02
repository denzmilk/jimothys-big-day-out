import {test,expect} from '@playwright/test';
import {boot,state} from './helpers.mjs';

async function traffic(page){await boot(page);expect(await page.evaluate(()=>!!window.__game.streetLife.flow),'controlled junction traffic exists').toBe(true);}

async function fixture(page,count=1){
 return page.evaluate(n=>{
  const s=window.__game.streetLife;for(const p of s.items)p.driving=false;
  const road=s.routes.roads.find(r=>r.axis===0&&r.to.outgoing.length>=3&&Math.hypot(r.end.x,r.end.z)<95&&r.length>40);
  if(!road)throw Error('No nearby crossroad approach');
  window.teleportJimothy(road.start.x+30,road.start.z+30);s.center={x:window.__game.jimothy.body.position.x,z:window.__game.jimothy.body.position.z};
  s.flow.time=0;road.to.offset=0;
  const cars=s.items.filter(p=>p.kind==='car'&&!p.fragment).slice(0,n);
  for(let i=0;i<n;i++)s.assignRoute(cars[i],road,road.length-cars[i].half[2]-1-7-i*8);
  window.trafficFixture={s,road,cars};return {ids:cars.map(p=>p.id),road:road.id};
 },count);
}

test('authored lanes keep vehicle centres on the right in normal and rotated districts',async({page})=>{
 await traffic(page);
 const r=await page.evaluate(()=>{
  const s=window.__game.streetLife;const lanes=s.routes.roads.map(r=>({right:-(r.start.x-r.centreStart.x)*r.dir.z+(r.start.z-r.centreStart.z)*r.dir.x,clear:s.roadClear(r.start.x,r.start.z)&&s.roadClear(r.end.x,r.end.z),rotated:Math.abs(r.dir.x)>.1&&Math.abs(r.dir.z)>.1}));
  return {lanes,count:s.items.filter(p=>p.driving&&p.route).length};
 });
 expect(r.count).toBeGreaterThan(3);expect(r.lanes.length).toBeGreaterThan(30);expect(r.lanes.some(l=>l.rotated)).toBe(true);
 for(const lane of r.lanes){expect(lane.right).toBeGreaterThan(1);expect(lane.clear).toBe(true);}
});

test('signals alternate with amber and clearance; cars queue on red then clear on green',async({page})=>{
 await traffic(page);await fixture(page,2);
 const r=await page.evaluate(async()=>{
  const {TRAFFIC:C}=await import('/src/core/Constants.js');const {s,road,cars}=window.trafficFixture;
  const phases=[];for(let t=0;t<2*(C.GREEN+C.AMBER+C.ALL_RED);t+=.1){s.flow.time=t;phases.push([s.flow.signal(road.to,0),s.flow.signal(road.to,1)]);}
  s.flow.time=C.GREEN+C.AMBER+C.ALL_RED;
  let minGap=Infinity,maxFront=-Infinity;
  for(let i=0;i<240;i++){s.update(1/60);maxFront=Math.max(maxFront,cars[0].route.distance+cars[0].half[2]);minGap=Math.min(minGap,cars[0].mesh.position.distanceTo(cars[1].mesh.position)-cars[0].half[2]-cars[1].half[2]);}
  const stopped=cars.map(p=>p.route.speed);const before=cars.map(p=>p.mesh.position.clone());s.flow.time=0;
  for(let i=0;i<360;i++)s.update(1/60);
  return {phases,minGap,maxFront,line:road.length,stopped,moved:cars.map((p,i)=>p.mesh.position.distanceTo(before[i])),holders:[...s.flow.reservations.values()].length,debug:cars.map(p=>({reason:p.route.reason,next:p.route.next?.id,road:p.route.road.id,dist:p.route.distance,pos:p.mesh.position.toArray()}))};
 });
 console.log('QUEUE',JSON.stringify({...r,phases:undefined}));
 expect(r.phases.some(p=>p.includes('amber'))).toBe(true);expect(r.phases.some(p=>p.every(c=>c==='red'))).toBe(true);
 expect(r.phases.every(p=>p.filter(c=>c==='green').length<=1)).toBe(true);
 expect(r.maxFront).toBeLessThanOrEqual(r.line-.4);expect(r.minGap).toBeGreaterThan(.4);
 expect(Math.max(...r.stopped)).toBeLessThan(.05);expect(Math.min(...r.moved)).toBeGreaterThan(3);
});

test('traffic brakes for a person and damaged road then resumes when clear',async({page})=>{
 await traffic(page);await fixture(page);
 const result=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js');const {s,road,cars:[p]}=window.trafficFixture;
  s.assignRoute(p,road,road.length/3);const start=p.route.distance;let active=true;
  const point={x:p.mesh.position.x+road.dir.x*8,z:p.mesh.position.z+road.dir.z*8,y:p.mesh.position.y,radius:.45,id:'crossing-person'};
  const off=eventBus.on(Events.TRAFFIC_OBSTACLES,e=>{if(active)e.obstacles.push(point);});
  for(let i=0;i<240;i++)s.update(1/60);const human={speed:p.route.speed,advance:p.route.distance-start};active=false;
  const original=s.ground.bind(s),holeAt=p.route.distance+8;
  s.ground=(x,z)=>{const d=(x-road.start.x)*road.dir.x+(z-road.start.z)*road.dir.z;return original(x,z)-(Math.abs(d-holeAt)<2?2:0);};
  for(let i=0;i<240;i++)s.update(1/60);const hole={speed:p.route.speed,distance:p.route.distance,holeAt};s.ground=original;
  const before=p.mesh.position.clone();for(let i=0;i<120;i++)s.update(1/60);if(typeof off==='function')off();
  return {human,hole,resumed:p.mesh.position.distanceTo(before)};
 });
 console.log('OBSTACLES',JSON.stringify(result));
 expect(result.human.speed).toBeLessThan(.05);expect(result.human.advance).toBeLessThan(6);
 expect(result.hole.speed).toBeLessThan(.05);expect(result.hole.distance).toBeLessThan(result.hole.holeAt-2);expect(result.resumed).toBeGreaterThan(2);
});

test('junction reservations exclude crossing traffic and blocked exits',async({page})=>{
 await traffic(page);await fixture(page,2);
 const r=await page.evaluate(()=>{
  const {s,road,cars:[p,q]}=window.trafficFixture;s.assignRoute(p,road,road.length-p.half[2]-1.1);
  const next=p.route.next;s.assignRoute(q,next,2);q.driving=false;
  for(let i=0;i<120;i++)s.update(1/60);
  const blocked={entered:!!p.route.committed,reason:p.route.reason};q.mesh.position.x+=30;s.flow.time=0;
  for(let i=0;i<240;i++){s.update(1/60);if(p.route.connector)break;}
  const committed=!!p.route.connector;s.flow.time=1000;
  const prior=p.mesh.position.clone();for(let i=0;i<240;i++)s.update(1/60);
  return {blocked,committed,cleared:!p.route.connector,moved:p.mesh.position.distanceTo(prior)};
 });
 console.log('EXIT',JSON.stringify(r));
 expect(r.blocked.entered).toBe(false);expect(r.committed).toBe(true);expect(r.cleared).toBe(true);expect(r.moved).toBeGreaterThan(3);
});

test('regular pavement lamps and signals light, break, stream and reset',async({page})=>{
 await traffic(page);
 const r=await page.evaluate(async()=>{
  const {gameState}=await import('/src/core/GameState.js'),{isFootpathAtWorld}=await import('/src/level/Layout.js');const g=window.__game,s=g.streetLife;
  gameState.world.daylight=0;s.update(0);const lamps=s.items.filter(p=>p.kind==='lamp'&&!p.fragment),signals=s.items.filter(p=>p.kind==='signal'&&!p.fragment);
  const before={lamps:lamps.length,signals:signals.length,paved:lamps.every(p=>isFootpathAtWorld(p.mesh.position.x,p.mesh.position.z)),lights:s.streetLights.filter(l=>l.intensity>0).length};
  const signal=signals[0],id=signal.id,junction=signal.junction;s.fracture(signal,signal.mesh.position.x,signal.mesh.position.z);s.update(0);
  const broken=s.flow.broken.has(junction),fragments=s.items.filter(p=>p.sourceId===id||p.kind==='signal'&&p.fragment).length;
  const old=s.center;window.teleportJimothy(420,-140);s.populate();window.teleportJimothy(old.x,old.z);s.populate();const persisted=!s.items.some(p=>p.id===id);
  window.restartGame();s.update(0);const counts=()=>({b:g.physics.world.bodies.length,e:g.collector.entities.size,signals:s.items.filter(p=>p.kind==='signal'&&!p.fragment).length});const first=counts();window.restartGame();s.update(0);
  return {before,broken,fragments,persisted,restored:!s.flow.broken.size,stable:JSON.stringify(first)===JSON.stringify(counts())};
 });
 expect(r.before.lamps).toBeGreaterThanOrEqual(10);expect(r.before.signals).toBeGreaterThanOrEqual(4);expect(r.before.paved).toBe(true);expect(r.before.lights).toBeGreaterThan(0);
 expect(r.broken).toBe(true);expect(r.fragments).toBeGreaterThan(0);expect(r.persisted).toBe(true);expect(r.restored).toBe(true);expect(r.stable).toBe(true);
 expect((await state(page)).streetLife.traffic).toBeGreaterThan(3);
});

test('a broken signal makes crossing approaches yield in turn without overlapping',async({page})=>{
 await traffic(page);await fixture(page,2);
 const r=await page.evaluate(()=>{
  const {s,road,cars:[p,q]}=window.trafficFixture,j=road.to,cross=j.incoming.find(r=>r.axis!==road.axis);
  s.flow.broken.add(j.id);s.assignRoute(p,road,road.length-p.half[2]-1);s.assignRoute(q,cross,cross.length-q.half[2]-1);
  const seen=new Set();let concurrent=0,minDistance=Infinity,offRoad=0;
  for(let i=0;i<1200;i++){
   s.update(1/60);const inside=[p,q].filter(p=>p.route.connector&&p.route.road.to===j);concurrent=Math.max(concurrent,inside.length);
   for(const car of inside)seen.add(car.id);
   minDistance=Math.min(minDistance,Math.hypot(p.mesh.position.x-q.mesh.position.x,p.mesh.position.z-q.mesh.position.z));
   for(const car of [p,q])if(!s.roadClear(car.mesh.position.x,car.mesh.position.z))offRoad++;
  }
  return {seen:seen.size,concurrent,minDistance,offRoad};
 });
 console.log('BROKEN_SIGNAL',JSON.stringify(r));expect(r.seen).toBe(2);expect(r.concurrent).toBe(1);expect(r.minDistance).toBeGreaterThan(3);expect(r.offRoad).toBe(0);
});

test('cars stop for actual pedestrians and Jimothy on their lane',async({page})=>{
 await traffic(page);await fixture(page);
 const r=await page.evaluate(()=>{
  const g=window.__game,{s,road,cars:[p]}=window.trafficFixture,person=g.pedestrians.people[0],saved=person.mesh.position.clone();
  const checks=[];
  for(const kind of ['person','jimothy']){
   s.assignRoute(p,road,road.length/3);const point=s.flow.point(p.route,8),y=s.ground(point.x,point.z);
   if(kind==='person')person.mesh.position.set(point.x,y,point.z);
   else{window.teleportJimothy(point.x,point.z);s.center={x:point.x,z:point.z};}
   const before=p.route.distance;for(let i=0;i<240;i++)s.update(1/60);
   checks.push({kind,speed:p.route.speed,travel:p.route.distance-before});person.mesh.position.copy(saved);
  }
  return checks;
 });
 console.log('REAL_CROSSING',JSON.stringify(r));for(const check of r){expect(check.speed).toBeLessThan(.05);expect(check.travel).toBeLessThan(6);}
});

test('streetlight arms reach over the road from their pavement bases',async({page})=>{
 await traffic(page);
 const lamps=await page.evaluate(async()=>{
  const {Vector3}=await import('/node_modules/three/build/three.module.js'),s=window.__game.streetLife;
  return s.items.filter(p=>p.kind==='lamp'&&!p.fragment).map(p=>{
   p.mesh.updateMatrixWorld(true);const road=s.routes.roads.find(r=>p.id.startsWith(`lamp-${r.id}-`));
   const base=p.mesh.children[0].getWorldPosition(new Vector3()),head=p.mesh.children.find(m=>m.userData.section===2).getWorldPosition(new Vector3());
   const offset=q=>Math.abs((q.x-road.centreStart.x)*road.dir.z-(q.z-road.centreStart.z)*road.dir.x);
   return {id:p.id,inward:offset(base)-offset(head)};
  });
 });
 for(const lamp of lamps)expect(lamp.inward,lamp.id).toBeGreaterThan(.8);
});
