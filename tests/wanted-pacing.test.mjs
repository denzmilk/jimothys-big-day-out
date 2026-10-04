import test from 'node:test';import assert from 'node:assert/strict';
globalThis.localStorage={getItem:()=>null};
const {HeatSystem}=await import('../src/systems/HeatSystem.js'),{gameState}=await import('../src/core/GameState.js'),{eventBus,Events}=await import('../src/core/EventBus.js'),{VOXEL}=await import('../src/core/Constants.js');
const heat=new HeatSystem();
function reset(){eventBus.emit(Events.GAME_RESTART);gameState.reset();gameState.game.isPlaying=true;}
function damage(volume,extra={}){eventBus.emit(Events.WORLD_DEMOLISHED,{voxels:volume/VOXEL.SIZE**3,instigator:'player',...extra});}
test('minor nuisance cannot summon police or army even after thousands of reports',()=>{
 reset();for(let i=0;i<1000;i++){eventBus.emit(Events.LOCAL_SCARED,{id:`person-${i}`});eventBus.emit(Events.CAN_TIPPED,{id:`can-${i}`});eventBus.emit(Events.TOOL_CHAOS,{points:3});heat.update(.1);}
 assert.ok(gameState.heat.tier<=3);assert.ok(gameState.heat.points<=45);assert.ok((heat.scared?.size||0)<=256);
});
test('one frightened person does not repeatedly increase wanted level during the fear cooldown',()=>{
 reset();eventBus.emit(Events.LOCAL_SCARED,{id:'repeat'});const first=gameState.heat.points;
 for(let i=0;i<100;i++)eventBus.emit(Events.LOCAL_SCARED,{id:'repeat'});assert.equal(gameState.heat.points,first);
 heat.update(31);eventBus.emit(Events.LOCAL_SCARED,{id:'repeat'});assert.equal(gameState.heat.points,first*2);
});
test('rapid tool nuisance is rate limited independently of frame frequency',()=>{
 const rows=[];for(const hz of [30,60,120]){reset();for(let i=0;i<hz*8;i++){eventBus.emit(Events.TOOL_CHAOS,{points:3});heat.update(1/hz);}rows.push(gameState.heat.points);}
 for(const points of rows)assert.ok(points<=30.001);assert.ok(Math.max(...rows)-Math.min(...rows)<.1);
});
test('military, spawn, mixed and unknown demolition do not increase the players heat',()=>{
 reset();for(const instigator of ['military','spawn','mixed',undefined])damage(5000,{instigator,collapse:true});assert.equal(gameState.heat.points,0);
 damage(120);assert.ok(gameState.heat.points>0);
});
test('small ground marks, a house and a block have distinct wanted outcomes',()=>{
 const rows=[];for(const [name,volume,ground]of [['small-ground',20,true],['large-ground',250,true],['house',120,false],['block',5000,false]]){
  reset();damage(volume,{groundOnly:ground});for(let i=0;i<1800;i++)heat.update(1/60);rows.push({name,points:gameState.heat.points,tier:gameState.heat.tier});
 }console.log('WANTED_EXAMPLES',JSON.stringify(rows));assert.ok(rows[0].tier<=1);assert.ok(rows[1].tier<=1);assert.equal(rows[2].tier,3);assert.equal(rows[3].tier,5);
});
test('upper tiers take time at 30, 60 and 120 Hz even after a block of destruction',()=>{
 const rows=[];for(const hz of [30,60,120]){reset();damage(5000);assert.ok(gameState.heat.tier<=3);let four=null,five=null;
  for(let i=0;i<hz*25;i++){heat.update(1/hz);if(four===null&&gameState.heat.tier===4)four=(i+1)/hz;if(five===null&&gameState.heat.tier===5)five=(i+1)/hz;}
  rows.push({hz,four,five});assert.ok(four>=11.9&&four<=12.1);assert.ok(five>=23.9&&five<=24.2);
 }console.log('WANTED_TIMING',JSON.stringify(rows));
});
test('hiding cancels a pending escalation and restart clears fear and rate budgets',()=>{
 reset();damage(5000);heat.update(10);gameState.player.hidden=true;for(let i=0;i<90;i++)heat.update(1);assert.equal(gameState.heat.points,0);assert.equal(gameState.heat.tier,0);
 eventBus.emit(Events.LOCAL_SCARED,{id:'reset-person'});reset();eventBus.emit(Events.LOCAL_SCARED,{id:'reset-person'});assert.ok(gameState.heat.points>0);const before=gameState.heat.points;
 gameState.game.isPlaying=false;damage(5000);eventBus.emit(Events.TOOL_CHAOS,{points:100});heat.update(60);assert.equal(gameState.heat.points,before);
});
