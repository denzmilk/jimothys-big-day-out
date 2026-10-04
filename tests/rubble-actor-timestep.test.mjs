import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PhysicsSystem} from '../src/systems/PhysicsSystem.js';
import {eventBus,Events} from '../src/core/EventBus.js';

for(const hz of [30,60,120])test(`walking collision proxies converge after route placement at ${hz} Hz`,()=>{
 eventBus.listeners.clear();const physics=new PhysicsSystem();physics.world.gravity.setZero();
 const mesh=new THREE.Object3D();mesh.position.set(0,10,0);
 eventBus.emit(Events.ENTITY_REGISTER,{id:'walker',kind:'person',mesh});
 const actor=physics.actors.get('walker');mesh.position.x=3;
 let error=0,speed=0;
 for(let i=0;i<hz*2;i++){
  mesh.position.x+=3.6/hz;physics.update(1/hz);
  if(i<2)continue;
  error=Math.max(error,Math.abs(actor.body.position.x-mesh.position.x));
  speed=Math.max(speed,actor.body.velocity.length());
 }
 assert.ok(error<.12,`${hz} Hz collision body drifted ${error} m`);
 assert.ok(speed<8,`${hz} Hz walking proxy reached ${speed} m/s`);
});
