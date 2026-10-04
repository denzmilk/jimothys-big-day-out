import {test,expect} from '@playwright/test';import {boot} from './helpers.mjs';
for(const hz of [30,60,120])for(const yaw of [0,Math.PI])test(`original Jimothy exits the real crater at ${hz} Hz, heading ${yaw}`,async({page})=>{
 await boot(page,{withRig:true,arrival:true});const r=await page.evaluate(({hz,yaw})=>{
  const g=__game;g.pursuers.update=()=>{};g.military.update=()=>{};
   advanceTime(7.3);faceJimothy(yaw);const start=g.jimothy.position.clone();g.input.codes.add('KeyW');let stall=0,maxStall=0;
   for(let n=0;n<hz*2;n++){const before=g.jimothy.position.clone();g.update(1/hz);stall=before.distanceTo(g.jimothy.position)<.001?stall+1:0;maxStall=Math.max(stall,maxStall);}
   g.input.codes.clear();return{hz,yaw,distance:start.distanceTo(g.jimothy.position),grounded:g.jimothy.grounded,stall:maxStall/hz};
 },{hz,yaw});console.log('COMET_EXIT',JSON.stringify(r));expect(r.distance).toBeGreaterThan(3);expect(r.stall).toBeLessThan(.2);expect(r.grounded).toBe(true);
});
