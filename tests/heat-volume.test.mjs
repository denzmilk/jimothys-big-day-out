import test from 'node:test';import assert from 'node:assert/strict';
globalThis.localStorage={getItem:()=>null};
const {HeatSystem}=await import('../src/systems/HeatSystem.js');
const {gameState}=await import('../src/core/GameState.js');
const {eventBus,Events}=await import('../src/core/EventBus.js');
const {VOXEL,HEAT}=await import('../src/core/Constants.js');
test('demolition heat follows cubic metres rather than voxel count',()=>{
 new HeatSystem();gameState.reset();gameState.game.isPlaying=true;
 eventBus.emit(Events.WORLD_DEMOLISHED,{voxels:1000,instigator:'player'});
 assert.ok(Math.abs(gameState.heat.points-1000*.22**3*HEAT.PER_DEMOLITION)<1e-8);assert.equal(gameState.heat.tier,0);
 const first=gameState.heat.points,old=VOXEL.SIZE;try{VOXEL.SIZE=old/2;eventBus.emit(Events.WORLD_DEMOLISHED,{voxels:8000,instigator:'player'});assert.ok(Math.abs(gameState.heat.points-first*2)<1e-8);}finally{VOXEL.SIZE=old;}
});
