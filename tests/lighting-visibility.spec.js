import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {boot,adv,state} from './helpers.mjs';

test('sun and moon cast visible shadows on the rendered street',async({page})=>{
 await page.setViewportSize({width:640,height:480});await boot(page,{withRig:true});
 const reports=await page.evaluate(()=>{
  const g=window.__game,canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const ctx=canvas.getContext('2d'),reports=[];
  const render=()=>{g.renderer.render(g.scene,g.camera);ctx.drawImage(g.renderer.domElement,0,0);return ctx.getImageData(0,0,640,480).data;};
  for(const hour of [14,0]){
   g.dayNight.setHour(hour);g.dayNight.update(0,false);g.streetLife.update(0);g.scene.updateMatrixWorld(true);g.renderer.shadowMap.needsUpdate=true;
   render();const on=render(),png=canvas.toDataURL('image/png');
   g.sun.shadow.intensity=g.dayNight.moon.shadow.intensity=0;const off=render();let changed=0,darkening=0;
   for(let y=240;y<480;y++)for(let x=0;x<640;x++){const i=(y*640+x)*4,d=(off[i]+off[i+1]+off[i+2]-on[i]-on[i+1]-on[i+2])/3;if(d>3)changed++;darkening+=Math.max(0,d);}
   g.sun.shadow.intensity=g.dayNight.moon.shadow.intensity=1;
   reports.push({hour,changed,darkening:darkening/(640*240),png,active:[g.sun,g.dayNight.moon].filter(l=>l.castShadow).map(l=>({intensity:l.intensity,map:!!l.shadow.map}))});
  }return reports;
 });
 await mkdir('output/iterate',{recursive:true});
 for(const r of reports){await writeFile(`output/iterate/lighting-${r.hour===0?'night':'day'}-shadows.png`,Buffer.from(r.png.split(',')[1],'base64'));delete r.png;}
 console.log('RENDERED_SHADOWS',JSON.stringify(reports));
 for(const r of reports){expect(r.changed,`visible ground shadow pixels at hour ${r.hour}`).toBeGreaterThan(150);expect(r.active).toHaveLength(1);expect(r.active[0].intensity).toBeGreaterThan(0);expect(r.active[0].map).toBe(true);}
});

test('the running clock traverses a full day and the HUD and time slider follow it',async({page})=>{
 await boot(page);const before=(await state(page)).dayNight.hour;await adv(page,1);expect((await state(page)).dayNight.hour).toBeGreaterThan(before);
 const r=await page.evaluate(()=>{
  const g=window.__game,phases=[],colours=new Set();
  for(let i=0;i<48;i++){
   g.dayNight.update(g.dayNight.snapshot().period/48,false);g.streetLife.update(0);
   phases.push({hour:g.dayNight.hour,label:document.getElementById('world-clock')?.textContent,slider:Number(document.getElementById('dt-time')?.value)});
   colours.add(g.level.sky.material.uniforms.topColor.value.getHex());
  }
  const end=g.dayNight.hour;window.restartGame();window.advanceTime(.1);return{phases,end,colours:colours.size,reset:document.getElementById('world-clock')?.textContent};
 });
 console.log('LIVE_CLOCK',JSON.stringify(r));
 expect(r.end).toBeCloseTo(before+1/30,2);expect(r.colours).toBeGreaterThanOrEqual(3);
 for(const p of r.phases){expect(p.label).toMatch(/^\d{2}:\d{2} · (Dawn|Day|Dusk|Night)$/);expect(p.slider).toBeCloseTo(p.hour,1);}
 expect(r.reset).toMatch(/^17:00 · Dusk$/);
});

test('one celestial shadow follows Jimothy, switches at sunset and survives restart',async({page})=>{
 await boot(page);
 const r=await page.evaluate(()=>{
  const g=window.__game,samples=[];const lights=[g.sun,g.dayNight.moon];
  for(const hour of [12,0,12,0]){
   g.dayNight.setHour(hour);g.dayNight.update(.3,false);g.scene.updateMatrixWorld(true);g.renderer.render(g.scene,g.camera);
   const active=lights.filter(l=>l.castShadow);samples.push({count:active.length,intensity:active[0]?.intensity,target:active[0]?.target.position.distanceTo(g.jimothy.group.position),maps:lights.filter(l=>l.shadow.map).length});
  }
  g.dayNight.update(.3,true);const underground=lights.filter(l=>l.castShadow).length;
  window.restartGame();window.advanceTime(.1);return{samples,underground,reset:lights.filter(l=>l.castShadow).length};
 });
 for(const s of r.samples){expect(s.count).toBe(1);expect(s.intensity).toBeGreaterThan(0);expect(s.target).toBeLessThan(.001);expect(s.maps).toBeLessThanOrEqual(2);}
 expect(r.underground).toBe(0);expect(r.reset).toBe(1);
});

test('physical trash bins cast a visible ground shadow',async({page})=>{
 await page.setViewportSize({width:640,height:480});await boot(page);
 const r=await page.evaluate(()=>{
  const g=window.__game,can=g.trashCans.cans[0],mesh=can.mesh,p=mesh.position;
  // A bin inside a building's shadow cannot darken that same ground again.
  // Use the sunlit spawn road to isolate this physical prop's contribution.
  mesh.geometry.computeBoundingBox();p.set(0,g.voxels.groundHeightAt(0,0,100)-mesh.geometry.boundingBox.min.y,0);mesh.quaternion.identity();
  g.dayNight.setHour(14);g.dayNight.update(0,false);g.scene.updateMatrixWorld(true);
  const camera=new g.camera.constructor(45,640/480,.1,1000);camera.position.set(p.x+4,p.y+5,p.z+6);camera.lookAt(p.x,p.y,p.z);g.jimothy.group.visible=false;
  const c=document.createElement('canvas');c.width=640;c.height=480;const ctx=c.getContext('2d');
  const draw=()=>{g.renderer.shadowMap.needsUpdate=true;g.renderer.render(g.scene,camera);ctx.drawImage(g.renderer.domElement,0,0);return ctx.getImageData(0,0,640,480).data;};
  const on=draw();mesh.castShadow=false;const off=draw();let changed=0;
  for(let i=0;i<on.length;i+=4)if((off[i]+off[i+1]+off[i+2]-on[i]-on[i+1]-on[i+2])/3>3)changed++;
  return{changed};
 });
 console.log('BIN_SHADOW',JSON.stringify(r));expect(r.changed).toBeGreaterThan(100);
});
