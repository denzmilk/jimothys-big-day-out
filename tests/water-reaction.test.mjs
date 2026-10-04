import test from 'node:test';import assert from 'node:assert/strict';
import {RippleField} from '../src/core/WaterField.js';

test('a broad body displaces a broad area of water',()=>{
 const small=new RippleField(()=>-20),large=new RippleField(()=>-20);small.centerAt(0,0);large.centerAt(0,0);
 small.disturb(0,0,.3,.4);large.disturb(0,0,.3,8);
 assert.ok(Math.abs(large.sample(6,0))>.03);assert.ok(Math.abs(small.sample(6,0))<.001);
 assert.ok(large.energy()>small.energy()*10);
});
test('a giant ripple window expands without growing its buffers or losing existing waves',()=>{
 const f=new RippleField(()=>-30);f.centerAt(0,0);f.disturb(0,0,.3,6);const a=f.current,v=f.velocity,before=f.sample(0,0);
 f.centerAt(0,0,240);assert.ok(f.cell*f.size>=240);assert.equal(f.current,a);assert.equal(f.velocity,v);assert.ok(Math.abs(f.sample(0,0)-before)<.01);
 f.disturb(60,0,.5,20);f.update(1);assert.ok(Math.abs(f.sample(60,0))>.01);assert.ok(f.current.every(Number.isFinite));
 f.centerAt(3,0,240);assert.ok(f.energy()>0);f.reset();assert.equal(f.energy(),0);
});
test('broad waves stay off land and settle within the fixed simulation limit',()=>{
 const f=new RippleField((x)=>x>0?20:-30);f.centerAt(0,0,160);f.disturb(-8,0,10,20);
 for(let i=0;i<120;i++)f.update(1/60);
 assert.equal(f.sample(8,0),0);assert.ok(f.current.every(Number.isFinite));
 for(let i=0;i<1500;i++)f.update(1/60);assert.equal(f.energy(),0);
});

test('entry response grows with footprint and impact speed',async()=>{
 const {waterReaction}=await import('../src/core/WaterField.js');
 const small=waterReaction(.3,0,3,true),large=waterReaction(3,0,3,true),fast=waterReaction(.3,0,12,true);
 assert.ok(large.radius>small.radius*5);assert.ok(large.strength>small.strength*2);assert.ok(fast.strength>small.strength*2);assert.ok(fast.scale>small.scale);
});

test('a fast surface entry throws more water than a gentle horizontal entry',async()=>{
 const {waterReaction}=await import('../src/core/WaterField.js');
 const slow=waterReaction(3,2,0,true),fast=waterReaction(3,18,0,true);
 assert.ok(fast.strength>slow.strength*3);assert.ok(fast.scale>slow.scale);
});
