import{test,expect}from'@playwright/test';import{boot,adv,state}from'./helpers.mjs';
async function army(page){await boot(page);expect((await state(page)).military).toBeDefined();await page.waitForFunction(()=>__game.military.ready);}
async function heat(page,fat=250){await page.evaluate(async fat=>{const {gameState}=await import('/src/core/GameState.js');setFatness(fat);const{HEAT}=await import('/src/core/Constants.js');gameState.heat.points=HEAT.TIER_THRESHOLDS[5];gameState.heat.tier=5;__game.heat._retier();},fat);}
test('heat and size gate bounded tank and jet attacks with a dodge warning',async({page})=>{
 await army(page);await adv(page,1);expect((await state(page)).military.units).toHaveLength(0);
 await heat(page);await adv(page,.2);let s=(await state(page)).military;expect(s.units.some(u=>u.kind==='tank')).toBe(true);expect(s.units.some(u=>u.kind==='jet')).toBe(true);expect(s.warning).toBeTruthy();expect(s.impacts).toBe(0);
 await adv(page,10);s=(await state(page)).military;expect(s.shots).toBeGreaterThan(0);expect(s.impacts).toBeGreaterThan(0);expect(s.units.filter(u=>u.kind==='tank').length).toBeLessThanOrEqual(2);expect(s.projectiles).toBeLessThanOrEqual(6);expect((await state(page)).game.netted).toBe(false);
});
test('military blast launches through physics then returns control without ending the run',async({page})=>{
 await army(page);const r=await page.evaluate(async()=>{const {gameState}=await import('/src/core/GameState.js');gameState.player.combo=4;const g=__game,p=g.jimothy.position.clone();g.military.explode({x:p.x-1,y:p.y,z:p.z},5);return{combo:gameState.player.combo,dynamic:g.jimothy.body.type===1,vy:g.jimothy.body.velocity.y};});expect(r.combo).toBe(1);expect(r.dynamic).toBe(true);expect(r.vy).toBeGreaterThan(0);
 await adv(page,4);const s=await state(page);expect(s.game.isPlaying).toBe(true);expect(await page.evaluate(()=>__game.jimothy.body.type)).toBe(4);
 const z=s.jimothy.z;await page.keyboard.down('w');await adv(page,1);await page.keyboard.up('w');expect(Math.abs((await state(page)).jimothy.z-z)).toBeGreaterThan(.5);
});
test('tank parts break away, can be collected and clean up on restart',async({page})=>{
 await army(page);await heat(page);await adv(page,.2);const r=await page.evaluate(async()=>{const g=__game,t=g.military.units.find(u=>u.kind==='tank');const{eventBus,Events}=await import('/src/core/EventBus.js');eventBus.emit(Events.WORLD_IMPACT,{...t.mesh.position,radius:10});return g.military.snapshot();});expect(r.wreckage).toBeGreaterThan(1);
 await page.evaluate(()=>{const p=__game.military.wreckage[0].mesh.position;teleportJimothy(p.x,p.z);});
 await page.keyboard.down('c');await adv(page,.2);expect((await state(page)).collection.items.some(p=>p.kind==='military-part')).toBe(true);await page.keyboard.up('c');await adv(page,1);
 await page.evaluate(()=>restartGame());await adv(page,.1);const s=(await state(page)).military;expect(s.units).toHaveLength(0);expect(s.wreckage).toBe(0);expect(s.projectiles).toBe(0);expect(s.impacts).toBe(0);
});

test('a tank follows a road, stays grounded and turns its barrel toward Jimothy',async({page})=>{
 await army(page);await heat(page);await adv(page,.2);const before=(await state(page)).military.units.find(u=>u.kind==='tank');await adv(page,.6);
 const r=await page.evaluate(()=>{const g=__game,u=g.military.units.find(u=>u.kind==='tank'),forward=u.mesh.position.clone().set(0,0,1).applyQuaternion(u.turret.getWorldQuaternion(u.turret.quaternion.clone())),toward=g.jimothy.position.clone().sub(u.mesh.position);toward.y=0;return{bearing:forward.normalize().dot(toward.normalize()),x:u.mesh.position.x,z:u.mesh.position.z,height:u.mesh.position.y,ground:g.military.ground(u.mesh.position.x,u.mesh.position.z),half:u.half[1],warning:g.military.units.find(u=>u.kind==='jet').warning.userData.radius,radius:g.jimothy.radius};});
 expect(Math.hypot(r.x-before.x,r.z-before.z)).toBeGreaterThan(1);expect(Math.abs(r.height-r.half-r.ground)).toBeLessThan(.5);expect(r.warning).toBeGreaterThan(r.radius);expect(r.bearing).toBeGreaterThan(.9);
});
test('a shell hits an intervening wall before its marked destination',async({page})=>{
 await army(page);await page.evaluate(()=>{const g=__game,s=.22,y=g.voxels.terrainHeightAt(20,20)+5;for(let z=Math.floor(18/s);z<=Math.ceil(22/s);z++)for(let v=Math.floor((y-2)/s);v<=Math.ceil((y+15)/s);v++)g.voxels.setEdit(Math.floor(23/s),v,z,6);
  const position=g.jimothy.position.clone().set(20,y,20),target=position.clone().setX(28);window.shotTarget=target;const explode=g.military.explode.bind(g.military);g.military.explode=(at,r)=>{window.shotHit={...at};explode(at,r);};g.military.fire({kind:'tank',mesh:{position},half:[0,0,0],warning:null},target,.3);
 });await adv(page,1.4);const r=await page.evaluate(()=>({hit:window.shotHit,target:window.shotTarget}));expect(r.hit).toBeDefined();expect(r.hit.x).toBeLessThan(r.target.x-3);
});

test('tier four stays police for every size; giant tanks and jets arrive at five',async({page})=>{
 await army(page);await page.evaluate(async()=>{const{gameState}=await import('/src/core/GameState.js');const{HEAT}=await import('/src/core/Constants.js');gameState.heat.points=HEAT.TIER_THRESHOLDS[4];gameState.heat.tier=4;});await adv(page,.1);expect((await state(page)).military.units).toHaveLength(0);
 await page.evaluate(()=>setFatness(250));await adv(page,.1);expect((await state(page)).military.units).toHaveLength(0);await heat(page);await adv(page,.1);expect((await state(page)).military.units.map(u=>u.kind).sort()).toEqual(['jet','tank']);
});
