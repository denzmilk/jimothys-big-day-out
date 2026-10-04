import {test,expect} from '@playwright/test';import {boot,state} from './helpers.mjs';
async function setup(page){await boot(page,{withRig:true});await page.waitForFunction(()=>__game.ocean.ready);await page.evaluate(()=>{teleportJimothy(-900,0);advanceTime(.2);});}

test('underwater bubbles cover the lean, medium and giant body at 30/60/120 Hz',async({page})=>{
 await setup(page);const rows=await page.evaluate(()=>{
  const g=__game,o=g.ocean,j=g.jimothy,rows=[];for(const hz of [30,60,120])for(const fat of [0,60,250]){
   setFatness(fat);o.bubbles=[];o.bubbleClock=0;j.body.position.set(-900,-j.radius-5,0);j.diving=true;j.swimming=true;j.postUpdate(0);
   for(let i=0;i<hz*3;i++)o.update(1/hz);const points=o.bubbles.filter(p=>p.source==='player'||!p.source),xs=points.map(p=>p.x),zs=points.map(p=>p.z);
   rows.push({hz,fat,radius:j.radius,count:points.length,width:Math.max(...xs)-Math.min(...xs),length:Math.max(...zs)-Math.min(...zs),finite:points.every(p=>Number.isFinite(p.x+p.y+p.z))});
  }return rows;
 });console.log('BUBBLE_BODY',JSON.stringify(rows));for(const r of rows){expect(r.count).toBeGreaterThan(3);expect(r.width).toBeGreaterThan(r.radius*.9);expect(r.length).toBeGreaterThan(r.radius*.9);expect(r.finite).toBe(true);expect(r.count).toBeLessThanOrEqual(160);}
 expect((await state(page)).ocean.bubbles).toBeLessThanOrEqual(160);
});

test('bubbles stop at actual submerged ceilings and never originate in solid or dry space',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  const g=__game,o=g.ocean,j=g.jimothy,s=.22;j.body.position.set(-900,-5,0);j.diving=false;j.postUpdate(0);o.bubbles=[];
  const roof=Math.floor(-3/s);for(let x=-10;x<=10;x++)for(let z=-10;z<=10;z++)g.voxels.setEdit(Math.floor(-900/s)+x,roof,z,6);
  o.emitBubbles({x:-900,y:-5,z:0},5);let crossed=0;for(let i=0;i<600;i++){o.update(1/60);crossed+=o.bubbles.filter(p=>p.x>-902&&p.x<-898&&p.y>=roof*s).length;}
  o.bubbles=[];o.emitBubbles({x:-900,y:1,z:0},4);const dry=o.bubbles.length;o.bubbles=[];o.emitBubbles({x:-900,y:roof*s+.1,z:0},4);return{crossed,dry,solid:o.bubbles.length};
 });console.log('BUBBLE_COVER',JSON.stringify(r));expect(r).toEqual({crossed:0,dry:0,solid:0});
});

test('sustained swimming keeps a fresh bounded wake, reuses buffers and clears on reset',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  const g=__game,o=g.ocean,j=g.jimothy;setFatness(60);j.body.position.set(-900,-8,0);j._prevFeetY=undefined;j.diving=j.swimming=true;j.vel.set(2,0,0);j.postUpdate(0);o.bubbles=[];
  const positions=o.bubbleData,style=o.bubbleStyle,times=[];let oldestNewest=0,maxCount=0,maxPlayer=0;const start=j.body.position.x;
  for(let i=0;i<1440;i++){
   j.body.position.x+=2/60;j.postUpdate(0);if(i%60===0)o.emitBubbles({x:j.body.position.x+10,y:-7,z:0},30);
   const before=performance.now();o.update(1/60);times.push(performance.now()-before);const players=o.bubbles.filter(p=>p.source==='player');maxCount=Math.max(maxCount,o.bubbles.length);maxPlayer=Math.max(maxPlayer,players.length);if(i>15)oldestNewest=Math.max(oldestNewest,Math.min(...players.map(p=>12-p.life)));
  }
  const player=o.bubbles.filter(p=>p.source==='player'),trail=j.body.position.x-Math.min(...player.map(p=>p.x)),count=player.length,environment=o.bubbles.filter(p=>p.source==='environment').length,finite=o.bubbleData.every(Number.isFinite)&&o.bubbleStyle.every(Number.isFinite),reused=o.bubbleData===positions&&o.bubbleStyle===style,sites=o.bubbleContacts.length;times.sort((a,b)=>a-b);o.reset();
  return{oldestNewest,maxCount,maxPlayer,trail,count,environment,finite,reused,sites,travel:j.body.position.x-start,median:times[720],p95:times[1368],reset:o.bubbles.length,draw:o.bubbleMesh.geometry.drawRange.count};
 });console.log('BUBBLE_WAKE',JSON.stringify(r));expect(r.oldestNewest).toBeLessThan(.2);expect(r.maxCount).toBeLessThanOrEqual(160);expect(r.maxPlayer).toBeLessThanOrEqual(144);expect(r.trail).toBeGreaterThan(5);expect(r.count).toBeGreaterThan(50);expect(r.environment).toBeGreaterThan(0);expect(r.finite&&r.reused).toBe(true);expect(r.sites).toBe(24);expect(r.travel).toBeGreaterThan(45);expect(r.reset).toBe(0);expect(r.draw).toBe(0);
});

test('partly submerged skin emits only below the moving waterline and dry skin emits nothing',async({page})=>{
 await setup(page);const r=await page.evaluate(()=>{
  const g=__game,o=g.ocean,j=g.jimothy;setFatness(60);j.body.position.set(-900,1,0);j._prevFeetY=undefined;j.swimming=true;j.diving=false;j.postUpdate(0);o.bubbles=[];
  for(let i=0;i<8;i++)o.emitPlayerBubbles();const wet=o.bubbles.length,above=o.bubbles.filter(p=>p.y>=g.water.heightAt(p.x,p.z)-.04).length;
  j.body.position.y=15;j._prevFeetY=undefined;j.postUpdate(0);o.bubbles=[];for(let i=0;i<8;i++)o.emitPlayerBubbles();return{wet,above,dry:o.bubbles.length};
 });expect(r.wet).toBeGreaterThan(5);expect(r.above).toBe(0);expect(r.dry).toBe(0);
});
