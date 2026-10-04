import test from 'node:test';
import assert from 'node:assert/strict';
import {driveStep,boxesOverlap} from '../src/core/DrivingMath.js';
import {DRIVING as C} from '../src/core/Constants.js';

test('throttle reaches the same speed at 30, 60 and 120 Hz',()=>{
 const results=[30,60,120].map(hz=>{let s={speed:0,steer:0};for(let i=0;i<hz*2;i++)s=driveStep(s.speed,s.steer,{throttle:1,steer:.4,handbrake:false},1/hz);return s;});
 for(const s of results){assert.ok(Math.abs(s.speed-results[0].speed)<1e-9);assert.ok(s.steer<0&&Number.isFinite(s.steer));}
});
test('low gear pulls away strongly in both directions without increasing cruising limits',()=>{
 const forward=driveStep(0,0,{throttle:1,steer:0},1),reverse=driveStep(0,0,{throttle:-1,steer:0},1);
 assert.ok(forward.speed>=9,'reach at least 9 m/s in the first second');
 assert.ok(reverse.speed<=-5,'reverse has enough low-speed pull to back out');
 assert.equal(driveStep(12,0,{throttle:1,steer:0},1).speed,12+C.ACCEL);
});
test('braking cannot switch forward velocity to reverse during the same frame',()=>{
 const s=driveStep(.1,0,{throttle:-1,steer:0,handbrake:false},.1);assert.equal(s.speed,0);
 assert.ok(driveStep(s.speed,0,{throttle:-1,steer:0,handbrake:false},.1).speed<0);
 assert.equal(driveStep(-.1,0,{throttle:1,steer:0,handbrake:false},.1).speed,0);
});
test('handbrake beats throttle, has bounded speed, and does not turn a stationary car',()=>{
 assert.equal(driveStep(0,0,{throttle:1,steer:0,handbrake:true},1).speed,0);
 assert.equal(driveStep(C.TOP_SPEED,0,{throttle:1,steer:0,handbrake:false},1).speed,C.TOP_SPEED);
 assert.equal(driveStep(-C.REVERSE_SPEED,0,{throttle:-1,steer:0,handbrake:false},1).speed,-C.REVERSE_SPEED);
});
test('rotated car footprints include side contact and reject separated lanes',()=>{
 const a={x:0,z:0,yaw:Math.PI/4,half:[1,1,2]},b={...a,x:.9,z:.9};assert.ok(boxesOverlap(a,b));
 assert.ok(!boxesOverlap(a,{...b,x:4,z:-4}));assert.ok(boxesOverlap(a,{x:1,z:1,yaw:-Math.PI/4,half:[.2,1,.2]}));
});
