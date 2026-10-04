import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('the uphill tourist keeps torso clearance while ordinary fleeing advances across the street',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));await boot(page);
 await page.evaluate(()=>{restartGame();advanceTime(.1);const g=__game,sites=[];for(let x=-24;x<=24;x+=3)for(let z=-24;z<=24;z+=3){const h=g.voxels.terrainHeightAt(x,z),other=g.voxels.terrainHeightAt(x,z-1);if(Math.abs(h-other)<.04&&!g.voxels.physicalSolidAtWorld(x,h+1,z)&&!g.voxels.physicalSolidAtWorld(x,other+1,z-1))sites.push({x,z});}sites.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));teleportJimothy(sites[0].x,sites[0].z);advanceTime(.1);});
 const report=await page.evaluate(()=>{
  const g=__game,rows=[];for(let i=0;i<90;i++){
   advanceTime(1/30);const p=g.pedestrians.people.find(p=>p.id==='ped-21');if(!p)throw Error('Missing reproduced tourist');
   const at=p.mesh.position.clone();rows.push({time:i/30,root:at.toArray(),model:p.model,activity:p.activity?.kind,seat:p.vehicleSeat,flee:p.flee,length:p.grounding.legLength,drop:p.grounding.baseY-p.visual.position.y,feet:p.grounding.contacts,legs:p.grounding.legs.map(l=>({swing:!!l.swing,target:l.target?.toArray(),end:l.swing?.end.toArray(),hip:l.hip.getWorldPosition(at.clone()).toArray()}))});
  }return{player:g.jimothy.position.toArray(),rows,maxDrop:Math.max(...rows.map(r=>r.drop/r.length))};
 });console.log('UPHILL_TOURIST',JSON.stringify(report));expect(report.rows[0].model).toBe('tourist');expect(report.rows[0].flee).toBeGreaterThan(0);expect(report.rows.every(r=>!r.activity&&!r.seat)).toBe(true);expect(report.maxDrop).toBeLessThan(.5);expect(errors).toEqual([]);
});

test('all twelve bodies keep their torso above the same steep pavement at 30, 60 and 120 Hz',async({page})=>{
 await boot(page);
 const reports=await page.evaluate(async()=>{
  const g=__game,s=g.pedestrians,{gameState}=await import('/src/core/GameState.js'),reports=[];
  teleportJimothy(-6,-6);s.activities.enabled=false;
  // Exercise the real navigation/grounding path with one isolated actor so
  // crowd avoidance cannot make a body pass by standing still.
  for(const p of [...s.people])s._remove(p);s.graphWork=null;s.populationPending=false;s.center={x:-6,z:-6};
  const node=[...s.graph.values()].sort((a,b)=>Math.hypot(a.x+9,a.z+8)-Math.hypot(b.x+9,b.z+8))[0];
  for(let model=0;model<s.models.length;model++)for(const hz of [30,60,120]){
   const p=s._spawn(node,model);p.x=-9;p.z=-8;p.y=g.voxels.physicalGroundHeightAt(p.x,p.z,50,0);p.mesh.position.set(p.x,p.y+.035,p.z);p.mesh.rotation.y=Math.PI/2;p.yaw=Math.PI/2;p.target={x:-4,z:-8,key:'fixture-end'};p.pause=0;p.grounding.reset();
   let drop=0,distance=0,previous=p.mesh.position.clone();const contacts=[];
   for(let i=0;i<hz*2;i++){
    gameState.player.hidden=i<hz/4;s.update(1/hz);distance+=p.mesh.position.distanceTo(previous);previous.copy(p.mesh.position);drop=Math.max(drop,(p.grounding.baseY-p.visual.position.y)/p.grounding.legLength);
    for(const f of p.grounding.contacts)if(f.stance)contacts.push(Math.abs(f.error));
   }
   reports.push({model:p.model,hz,drop,distance,contact:Math.max(...contacts)});s._remove(p);
  }gameState.player.hidden=false;return reports;
 });console.log('UPHILL_BODIES',JSON.stringify(reports));expect(reports).toHaveLength(36);for(const r of reports){expect(r.drop,JSON.stringify(r)).toBeLessThan(.5);expect(r.distance,JSON.stringify(r)).toBeGreaterThan(2);expect(r.contact,JSON.stringify(r)).toBeLessThan(.15);}
});
