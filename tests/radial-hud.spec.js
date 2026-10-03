import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('the circular map clips its corners and keeps a distant diagonal waypoint on its rim',async({page})=>{
 await boot(page);
 const r=await page.evaluate(async()=>{
  const {eventBus,Events}=await import('/src/core/EventBus.js');
  const g=__game,j=g.jimothy.position;
  eventBus.on(Events.TACTICAL_QUERY,p=>{p.waypoint={x:j.x+10000,z:j.z+10000};});
  g.radar.update(.3,{x:j.x,y:j.y,z:j.z,yaw:1.2,radius:g.jimothy.radius,underground:false});
  const c=document.getElementById('radar-canvas'),ctx=c.getContext('2d'),pixels=ctx.getImageData(0,0,c.width,c.height).data,points=[];
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(pixels[i]===169&&pixels[i+1]===228&&pixels[i+2]===255&&pixels[i+3]===255)points.push({x,y});}
  return{corners:[[0,0],[c.width-1,0],[0,c.height-1],[c.width-1,c.height-1]].map(([x,y])=>pixels[(y*c.width+x)*4+3]),points:points.length,radius:points.reduce((sum,p)=>sum+Math.hypot(p.x-c.width/2,p.y-c.height/2),0)/points.length/(c.width/2),heading:JSON.parse(render_game_to_text()).radar.heading};
 });
 expect(r.corners).toEqual([0,0,0,0]);expect(r.points).toBeGreaterThan(10);expect(r.radius).toBeGreaterThan(.85);expect(r.radius).toBeLessThan(.99);expect(r.heading).toBeCloseTo(1.2);
});
