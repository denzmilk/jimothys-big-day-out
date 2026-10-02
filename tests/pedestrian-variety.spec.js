import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {PEDESTRIANS} from '../src/core/Constants.js';
import {boot} from './helpers.mjs';

const manifest=JSON.parse(fs.readFileSync('public/assets/models/people/manifest.json','utf8'));

test('twelve authored neighbours retain varied source recipes and bounded game assets',()=>{
  expect(manifest).toHaveLength(12);
  expect(PEDESTRIANS.MODELS).toEqual(manifest.map(p=>p.id));
  expect(new Set(manifest.map(p=>p.outfit)).size).toBeGreaterThanOrEqual(10);
  expect(new Set(manifest.map(p=>p.skin)).size).toBeGreaterThanOrEqual(9);
  expect(new Set(manifest.map(p=>p.hair)).size).toBeGreaterThanOrEqual(8);
  for(const p of manifest){
    expect(fs.existsSync(`assets/blender/people/${p.id}-editable.blend`)).toBe(true);
    expect(fs.existsSync(`assets/blender/people/${p.id}-game.blend`)).toBe(true);
    expect(p.triangles).toBeLessThan(18000);
    expect(p.bytes).toBeLessThan(3000000);
  }
});

test('every neighbour has a distinct physique, animated skin and working ragdoll joints',async({page})=>{
  await boot(page);
  const result=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const g=window.__game,seen=new Set(),reports=[],baseline=g.physics.world.bodies.length;
    for(const p of g.pedestrians.people){
      if(seen.has(p.model))continue;seen.add(p.model);
      const hip=p.visual.getObjectByName('thigh_l'),ankle=p.visual.getObjectByName('foot_l');
      const length=p.grounding.legs[0].l1+p.grounding.legs[0].l2;
      const shoulder=p.visual.getObjectByName('upperarm_l').getWorldPosition(new THREE.Vector3()).distanceTo(p.visual.getObjectByName('upperarm_r').getWorldPosition(new THREE.Vector3()));
      const head=p.visual.getObjectByName('head').getWorldPosition(new THREE.Vector3()).y-p.mesh.position.y;
      const skin=[];p.visual.traverse(o=>{if(o.isSkinnedMesh)skin.push(o);});
      const vertices=()=>{p.visual.updateMatrixWorld(true);return skin.map(m=>{m.skeleton.update();return Array.from({length:Math.ceil(m.geometry.attributes.position.count/100)},(_,i)=>m.getVertexPosition(i*100,new THREE.Vector3()));});};
      g.pedestrians._animate(p,'Run');p.mixer.update(.3);const before=vertices();p.mixer.update(.3);const after=vertices();
      const motion=Math.max(...before.flatMap((points,j)=>points.map((v,i)=>v.distanceTo(after[j][i]))));
      const person=g.ragdolls.people.get(p.id);g.ragdolls.knock(person,{x:p.x-1,z:p.z,radius:2});
      const rag=g.ragdolls.active.get(p.id),parts=rag?.physics.bodies.length??0,joints=rag?.physics.constraints.length??0;
      g.ragdolls.stop(p.id);
      reports.push({id:p.model,clips:Object.keys(p.actions).sort(),legs:p.grounding.legs.length,head,shoulder,length,motion,parts,joints,legBones:!!hip&&!!ankle});
    }
    return {reports,bodyLeak:g.physics.world.bodies.length-baseline,count:g.pedestrians.people.length};
  });
  console.log('PEDESTRIAN_VARIETY',JSON.stringify(result));
  expect(result.reports).toHaveLength(12);expect(result.count).toBe(36);expect(result.bodyLeak).toBe(0);
  const heads=result.reports.map(p=>p.head),widths=result.reports.map(p=>p.shoulder);
  expect(Math.max(...heads)-Math.min(...heads)).toBeGreaterThan(.25);
  expect(Math.max(...widths)-Math.min(...widths)).toBeGreaterThan(.07);
  for(const p of result.reports){
    expect(p.clips,p.id).toEqual(['Idle','Run','Walk']);expect(p.legs,p.id).toBe(2);expect(p.legBones,p.id).toBe(true);
    expect(p.motion,p.id).toBeGreaterThan(.02);expect(p.parts,p.id).toBe(11);expect(p.joints,p.id).toBe(10);
  }
});
