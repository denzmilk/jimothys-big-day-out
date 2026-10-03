import {test,expect} from '@playwright/test';import {boot,adv} from './helpers.mjs';
test('skin attachments find the original triangle without scanning the whole mesh',async({page})=>{
 await boot(page,{withRig:true});const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),j=__game.jimothy,r=j.rig,out=[];
  for(const fat of [0,250,400]){
   setFatness(fat);j.postUpdate(0);j.group.updateMatrixWorld(true);
   const box=r.bellyLocalBox(j.group),center=box.getCenter(new T.Vector3()),radii=box.getSize(new T.Vector3()).multiplyScalar(.5);
   for(const d of [[1,0,0],[0,-1,0],[0,0,1],[-1,.2,-.5]]){
    const direction=new T.Vector3(...d).normalize(),a=r.skinned.geometry.attributes.position,read=a.getX;let visits=0;a.getX=function(i){visits++;return read.call(this,i);};
    const hit=r.surfaceContact(direction,center,radii);a.getX=read;
    const reference=r.surfaceRay.intersectObject(r.surfaceMesh,false)[0];
    out.push({fat,visits,total:a.count,hit:!!hit,ids:hit?.ids,reference:reference?[reference.face.a,reference.face.b,reference.face.c]:null});
   }
  }return out;
 });console.log(JSON.stringify(result));
 for(const r of result){expect(r.hit).toBe(true);expect(r.ids).toEqual(r.reference);expect(r.visits).toBeLessThan(r.total/4);}
});
test('pedestrian navigation rebuild is spread over updates while the old routes remain usable',async({page})=>{
 await boot(page);const result=await page.evaluate(()=>{
  const g=__game,p=g.pedestrians,graph=p.graph,clear=p._clear.bind(p);let calls=0;p._clear=(...a)=>{calls++;return clear(...a);};
  teleportJimothy(45,0);p.update(1/60);return {calls,oldGraphRetained:p.graph===graph,people:p.people.length};
 });expect(result.calls).toBeLessThan(512);expect(result.oldGraphRetained).toBe(true);expect(result.people).toBeGreaterThan(0);
});
