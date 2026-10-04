import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';
import fs from 'node:fs/promises';

test('parked cars keep their individual tyre contacts when a graded street streams out and back',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));await boot(page);
 const report=await page.evaluate(()=>{
  const g=__game,s=g.streetLife;window.__STATE_ONLY_TEST__=true;advanceTime(.2);
  const measure=p=>{
   p.mesh.updateMatrixWorld(true);
   const gaps=p.mesh.children.filter(w=>/wheel-(front|back)-(left|right)$/.test(w.name)).map(w=>{
    let gap=Infinity;const a=w.geometry.attributes.position;
    for(let i=0;i<a.count;i++){const v=w.localToWorld(p.mesh.position.clone().fromBufferAttribute(a,i));gap=Math.min(gap,v.y-g.voxels.groundHeightAt(v.x,v.z,v.y+1));}return gap;
   });return {id:p.id,model:p.seed%6,pitch:p.grounding?.pitch,yaw:p.yaw,at:p.mesh.position.toArray(),gaps};
  };
  const before=s.items.filter(p=>p.kind==='car'&&!p.loose&&!p.driving).map(measure),at=g.jimothy.position.clone();
  const steep=before.toSorted((a,b)=>a.pitch-b.pitch)[0].id;
  const capture=()=>{const p=s.items.find(p=>p.id===steep);g.freeCamera=true;g.camera.position.copy(p.mesh.position.clone().set(6,2.5,6).applyQuaternion(p.mesh.quaternion).add(p.mesh.position));g.camera.lookAt(p.mesh.position);g.renderer.render(g.scene,g.camera);const canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;canvas.getContext('2d').drawImage(g.renderer.domElement,0,0);return canvas.toDataURL();};
  const imageBefore=capture();
  teleportJimothy(420,-140);advanceTime(.2);const removed=before.every(p=>!s.items.some(q=>q.id===p.id));teleportJimothy(at.x,at.z);advanceTime(.2);
  return {removed,imageBefore,imageAfter:capture(),rows:before.map(p=>{const q=s.items.find(q=>q.id===p.id);return {before:p,after:q?measure(q):null};}),state:JSON.parse(render_game_to_text()).streetLife};
 });
 for(const [key,name]of[['imageBefore','before'],['imageAfter','returned']]){await fs.writeFile(`output/iterate/car-grade-${name}.png`,Buffer.from(report[key].split(',')[1],'base64'));delete report[key];}
 await fs.writeFile('output/iterate/car-grade-verified.json',JSON.stringify(report,null,2));
 console.log('PARKED_GRADE_CONTACT',JSON.stringify(report.rows));expect(errors).toEqual([]);expect(report.removed).toBe(true);expect(report.rows.length).toBeGreaterThanOrEqual(8);
 expect(Math.max(...report.rows.map(r=>Math.abs(r.before.pitch)))).toBeGreaterThan(.4);
 for(const r of report.rows){expect(r.after).not.toBe(null);expect(Number.isFinite(r.after.yaw),'saved heading exists before another hijack').toBe(true);expect(r.after.yaw).toBe(r.before.yaw);expect(r.after.gaps).toHaveLength(4);for(const gap of [...r.before.gaps,...r.after.gaps])expect(Math.abs(gap),r.before.id).toBeLessThan(.08);for(let i=0;i<3;i++)expect(Math.abs(r.after.at[i]-r.before.at[i])).toBeLessThan(.01);}
});
