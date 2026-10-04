import {test,expect} from '@playwright/test';import {boot} from './helpers.mjs';

test('fat rolling accelerates, responds to slopes and coasts at different frame rates',async({page})=>{
 await boot(page,{withRig:true});
 const rows=await page.evaluate(async()=>{
  const {PLAYER_CONFIG:P}=await import('/src/core/Constants.js'),j=__game.jimothy,g=__game,input=g.input,rows=[];
  const step=(dt,yaw=0)=>{j.update(dt,yaw);j.body.position.x+=j.body.velocity.x*dt;j.body.position.y+=j.body.velocity.y*dt;j.body.position.z+=j.body.velocity.z*dt;j.postUpdate(dt);};
  for(const hz of [30,60,120])for(const grade of [-.3,0,.3]){
   const height=(x,z)=>100+(z-300)*grade;
   j.voxels={terrainHeightAt:height,groundHeightAt:(x,z)=>height(x,z),physicalGroundHeightAt:(x,z)=>height(x,z),solidAtWorld:(x,y,z)=>y<height(x,z),raycast:()=>null};
   j.reset();setFatness(90);j.body.position.set(300,100+j.radius,300);j.yaw=0;j.legs.reset();j.postUpdate(0);j.onImpact=()=>{};
   input.codes.clear();input.codes.add('KeyC');input._rollQueued=true;input.moveX=0;input.moveZ=0;
   let early=0,late=0,maxJump=0;const samples=[];
   for(let i=0;i<hz*2;i++){const q=j.group.quaternion.clone();step(1/hz);maxJump=Math.max(maxJump,q.angleTo(j.group.quaternion));if(i===Math.round(hz*.1)-1)early=j.speed;if(i===hz-1)late=j.speed;}
   const heldSpeed=j.speed,start=j.body.position.clone();input.codes.delete('KeyC');
   for(let i=0;i<hz*2;i++){const q=j.group.quaternion.clone();step(1/hz);maxJump=Math.max(maxJump,q.angleTo(j.group.quaternion));if(i===0)samples.push(j.speed);}
   rows.push({hz,grade,early,late,heldSpeed,releasedSpeed:samples[0],coast:Math.hypot(j.body.position.x-start.x,j.body.position.z-start.z),finalSpeed:j.speed,move:j.move?.kind||null,maxJump,finite:j.group.matrixWorld.elements.every(Number.isFinite)});
  }
  return rows;
 });console.log('MOMENTUM_ROLL',JSON.stringify(rows));
 for(const r of rows){expect(r.early,JSON.stringify(r)).toBeLessThan(r.late*.8);expect(r.releasedSpeed).toBeGreaterThan(r.heldSpeed*.8);expect(r.coast).toBeGreaterThan(1);expect(r.finalSpeed).toBeLessThan(.5);expect(r.move).toBe(null);expect(r.maxJump).toBeLessThan(.7);expect(r.finite).toBe(true);}
 for(const hz of [30,60,120]){const speeds=rows.filter(r=>r.hz===hz).map(r=>r.heldSpeed);expect(speeds[0]).toBeGreaterThan(speeds[1]+.5);expect(speeds[1]).toBeGreaterThan(speeds[2]+.5);}
 for(const grade of [-.3,0,.3]){const speeds=rows.filter(r=>r.grade===grade).map(r=>r.heldSpeed);expect(Math.max(...speeds)-Math.min(...speeds)).toBeLessThan(.5);}
});

test('rolling hands pose ownership back on swimming, riding, launches, shrinking and restart',async({page})=>{
 await boot(page,{withRig:true});const result=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js'),{gameState}=await import('/src/core/GameState.js'),j=__game.jimothy,g=__game,input=g.input,ground=()=>20;
  j.voxels={terrainHeightAt:ground,groundHeightAt:ground,physicalGroundHeightAt:ground,solidAtWorld:()=>false,raycast:()=>null};j.onImpact=()=>{};
  const step=()=>{j.update(1/60,0);j.body.position.x+=j.body.velocity.x/60;j.body.position.y+=j.body.velocity.y/60;j.body.position.z+=j.body.velocity.z/60;j.postUpdate(1/60);};
  let starts=0;const start=()=>{starts++;j.reset();gameState.player.stunned=false;setFatness(90);j.body.position.set(300,20+j.radius,300);j.yaw=0;j.legs.reset();j.postUpdate(0);input.codes.clear();input.codes.add('KeyC');input._rollQueued=true;for(let i=0;i<30;i++)step();if(!j.move?.physical)throw new Error(JSON.stringify({starts,riding:j.riding,launched:j.launched,move:j.move,localStun:gameState.player.stunned,actualStun:JSON.parse(render_game_to_text()).stunned,swimming:j.swimming,cooldown:j.moveCooldown}));};
  start();const started=!!j.move?.physical&&j.rollMotion.active;
  const unsubscribe=eventBus.on(Events.WATER_SAMPLE,q=>q.receive({height:40,depth:20}));j.body.position.y=39;for(let i=0;i<90;i++)step();const swim={swimming:j.swimming,move:j.move?.kind||null,orientation:j.rollMotion.active};unsubscribe();
  start();eventBus.emit(Events.PLAYER_RIDE,{active:true});const ride={riding:j.riding,move:j.move,orientation:j.rollMotion.active};eventBus.emit(Events.PLAYER_RIDE,{active:false});
  start();eventBus.emit(Events.PLAYER_LAUNCHED,{velocity:[2,10,0],mass:35,seconds:1});const launch={launched:j.launched,move:j.move,orientation:j.rollMotion.active,type:j.body.type};
  start();setFatness(0);input.codes.delete('KeyC');for(let i=0;i<90;i++)step();const shrink={move:j.move?.kind||null,orientation:j.rollMotion.active,speed:j.speed};
  start();j.reset();const reset={move:j.move,orientation:j.rollMotion.active,spin:j.rollMotion.spin,speed:j.speed};
  return{started,swim,ride,launch,shrink,reset};
 });console.log('ROLL_TRANSITIONS',JSON.stringify(result));expect(result.started).toBe(true);expect(result.swim).toEqual({swimming:true,move:null,orientation:false});expect(result.ride).toMatchObject({riding:true,move:null,orientation:false});expect(result.launch).toEqual({launched:1,move:null,orientation:false,type:1});expect(result.shrink).toEqual({move:null,orientation:false,speed:0});expect(result.reset).toEqual({move:null,orientation:false,spin:0,speed:0});
});

test('a fat rolling landing bounces once while standing contact stays still',async({page})=>{
 await boot(page);const result=await page.evaluate(()=>{
  const j=__game.jimothy,input=__game.input,ground=()=>20;j.voxels={terrainHeightAt:ground,groundHeightAt:ground,physicalGroundHeightAt:ground,solidAtWorld:()=>false,raycast:()=>null};j.onImpact=()=>{};j.reset();setFatness(90);j.body.position.set(300,20+j.radius,300);j.postUpdate(0);input._rollQueued=true;input.codes.add('KeyC');j.update(1/60,0);j.postUpdate(1/60);
  j.grounded=false;j.vy=-12;j.body.position.y=20+j.radius-.05;j.postUpdate(1/60);const bounce=j.vy;let landings=0,previous=j.grounded;
  for(let i=0;i<120;i++){j.update(1/60,0);j.body.position.x+=j.body.velocity.x/60;j.body.position.y+=j.body.velocity.y/60;j.body.position.z+=j.body.velocity.z/60;j.postUpdate(1/60);if(j.grounded&&!previous)landings++;previous=j.grounded;}
  const landed={grounded:j.grounded,vy:j.vy},speed=j.speed;j.grounded=false;j.body.position.y+=10;j.vy=-2;input.codes.delete('KeyC');j.update(1/60,0);
  return{bounce,landings,...landed,airRelease:{before:speed,after:j.speed,move:j.move?.kind||null,vy:j.vy}};
 });expect(result.bounce).toBeGreaterThan(1);expect(result.bounce).toBeLessThan(4.1);expect(result.landings).toBe(1);expect(result.grounded).toBe(true);expect(result.vy).toBe(0);expect(result.airRelease.move).toBe(null);expect(result.airRelease.after).toBeCloseTo(result.airRelease.before,6);expect(result.airRelease.vy).toBeLessThan(-2);
});
