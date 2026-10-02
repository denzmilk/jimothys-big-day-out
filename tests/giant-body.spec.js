import {test,expect} from '@playwright/test';
import {boot,adv} from './helpers.mjs';

test('giant skin becomes round and meets its physical centre at every heading',async({page})=>{
 await boot(page,{withRig:true});
 const samples=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const j=window.__game.jimothy,r=j.rig,m=r.skinned,a=m.geometry.attributes,torso=new Set(['body','neck'].map(n=>m.skeleton.bones.indexOf(r.bones[n]))),out=[];
  for(const fat of [90,250,400])for(const yaw of [0,1.1,2.4]){
   setFatness(fat);teleportJimothy(10,20);faceJimothy(yaw);j.postUpdate(0);j.group.updateMatrixWorld(true);m.skeleton.update();const box=new T.Box3(),local=new T.Matrix4().copy(j.group.matrixWorld).invert(),p=new T.Vector3();
   for(let i=0;i<a.position.count;i++){let w=0;for(let k=0;k<4;k++)if(torso.has(a.skinIndex.getComponent(i,k)))w+=a.skinWeight.getComponent(i,k);if(w<.8)continue;m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld).applyMatrix4(local);box.expandByPoint(p);}
   const size=box.getSize(new T.Vector3()),center=j.group.localToWorld(box.getCenter(new T.Vector3()));out.push({fat,yaw,ratio:Math.max(...size.toArray())/Math.min(...size.toArray()),offset:center.distanceTo(new T.Vector3().copy(j.body.position))/j.radius,size:size.toArray()});
  }return out;
 });
 console.log(JSON.stringify(samples));
 for(const s of samples){expect(s.ratio,JSON.stringify(s)).toBeLessThan(s.fat===90?1.5:1.2);expect(s.offset,JSON.stringify(s)).toBeLessThan(.2);}
});

test('holding a giant roll keeps turning beyond the first tumble',async({page})=>{
 await boot(page,{withRig:true});await page.evaluate(()=>{setFatness(250);teleportJimothy(10,20);});await page.keyboard.down('c');await adv(page,1.05);
 const first=await page.evaluate(()=>window.__game.jimothy.rollSpin);await adv(page,.4);const second=await page.evaluate(()=>({spin:window.__game.jimothy.rollSpin,move:JSON.parse(render_game_to_text()).jimothy.move}));await page.keyboard.up('c');
 expect(second.move).toBe('roll');expect(Math.abs(second.spin-first)).toBeGreaterThan(.15);
});

test('carried people remain on visible skin and keep their size',async({page})=>{
 await boot(page,{withRig:true});
 await page.evaluate(()=>{setFatness(250);teleportJimothy(60,10);const g=window.__game,p=g.pedestrians.people[0];p.x=62;p.z=10;p.y=g.voxels.terrainHeightAt(62,10);p.mesh.position.set(p.x,p.y,p.z);});
 await page.keyboard.down('c');await adv(page,.3);
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),g=window.__game,j=g.jimothy,m=j.rig.skinned,out=[];
  for(const t of [.1,.3,.5]){
   advanceTime(t);j.group.updateMatrixWorld(true);m.skeleton.update();m.computeBoundingSphere();m.computeBoundingBox();
   for(const e of g.collector.attached.filter(e=>e.kind==='person')){
    const p=e.mesh.getWorldPosition(new T.Vector3()),normal=new T.Vector3(0,1,0).applyQuaternion(e.mesh.getWorldQuaternion(new T.Quaternion()));
    const ray=new T.Raycaster(p.clone().addScaledVector(normal,2),normal.clone().negate()),hit=ray.intersectObject(m)[0];
    if(hit)out.push({id:e.id,gap:Math.abs(hit.distance-2-(e.baseOffset||0)),scale:e.mesh.getWorldScale(new T.Vector3()).toArray()});
   }
  }return out;
 });
 expect(report.length).toBeGreaterThan(2);
 for(const r of report){expect(r.gap,JSON.stringify(r)).toBeLessThan(.2);for(const s of r.scale)expect(s).toBeCloseTo(1,3);}
 await page.keyboard.up('c');await adv(page,1);expect(await page.evaluate(()=>window.__game.collector.attached.length)).toBe(0);
});
