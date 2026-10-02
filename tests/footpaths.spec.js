import {test,expect} from '@playwright/test';
import * as Layout from '../src/level/Layout.js';
import * as Terrain from '../src/level/Terrain.js';
import {PAVING,VOXEL} from '../src/core/Constants.js';
import * as THREE from 'three';
import {VoxelWorld} from '../src/level/VoxelWorld.js';
import {boot,adv,state} from './helpers.mjs';

test('streets reserve raised pedestrian strips with level cross-sections and no buildings',()=>{
  const paths=[];
  for(let z=-70;z<70;z+=2)for(let x=-70;x<70;x+=2){
    const p=Layout.pavingAtWorld?.(x+1,z+1);
    if(p?.kind==='footpath')paths.push({x:x+1,z:z+1,...p});
  }
  expect(paths.length).toBeGreaterThan(100);
  const buildings=Layout.Masterplan.buildingsIn(-80,-80,80,80);
  for(const p of paths){
    expect(Layout.roadAtWorld(p.x,p.z)).toBe(false);
    expect(buildings.some(b=>p.x>=b.x&&p.x<=b.x+b.w&&p.z>=b.z&&p.z<=b.z+b.d)).toBe(false);
    expect(p.height-p.roadHeight).toBeGreaterThan(.15);
    expect(p.height-p.roadHeight).toBeLessThan(.3);
  }
  const straight=paths.filter(p=>Layout.Masterplan.regionInteriorAtWorld(p.x+p.normal[0]*.35,p.z+p.normal[1]*.35)>=PAVING.SEAM_BLEND
    &&Layout.Masterplan.regionInteriorAtWorld(p.x-p.normal[0]*.35,p.z-p.normal[1]*.35)>=PAVING.SEAM_BLEND&&Layout.pavingAtWorld?.(p.x+p.normal[0]*.35,p.z+p.normal[1]*.35)?.kind==='footpath'
    &&Layout.pavingAtWorld?.(p.x-p.normal[0]*.35,p.z-p.normal[1]*.35)?.kind==='footpath');
  expect(straight.length).toBeGreaterThan(50);
  for(const p of straight){
    const a=Layout.terrain.surfaceHeight(p.x+p.normal[0]*.35,p.z+p.normal[1]*.35);
    const b=Layout.terrain.surfaceHeight(p.x-p.normal[0]*.35,p.z-p.normal[1]*.35);
    expect(Math.abs(a-b)).toBeLessThan(.025);
  }
});

test('different district street grids meet without introducing cliffs',()=>{
  let joins=0;
  for(let z=-998;z<998;z+=2)for(let x=-998;x<998;x+=2){
    const p=Layout.pavingAtWorld(x+1,z+1);if(!p)continue;
    for(const [dx,dz] of [[2,0],[0,2]]){
      const q=Layout.pavingAtWorld(x+1+dx,z+1+dz);
      if(!q||Layout.Masterplan.regionAtWorld(x+1,z+1)===Layout.Masterplan.regionAtWorld(x+1+dx,z+1+dz))continue;
      const natural=Terrain.surfaceHeight(x+1,z+1)-Terrain.surfaceHeight(x+1+dx,z+1+dz);
      expect(Math.abs(p.roadHeight-q.roadHeight-natural)).toBeLessThan(.01);joins++;
    }
  }
  expect(joins).toBeGreaterThan(500);
});

test('kerb meshing preserves exposed walls inside tunnels below intact ground',()=>{
  const w=new VoxelWorld(new THREE.Scene()),s=VOXEL.SIZE;
  w.terrain={surfaceHeight:()=>4*s,cornerHeight:()=>4*s,topSolidVoxelY:()=>3};
  w.set(0,3,0,PAVING.SLAB_MATERIAL);w.set(1,3,0,PAVING.SLAB_MATERIAL);
  w.set(0,1,0,6);w.set(1,1,0,VOXEL.EMPTY);w.remeshDirty();
  let wallVertices=0;
  for(const chunk of w.chunks.values())if(chunk.mesh){
    const {position:p,normal:n}=chunk.mesh.geometry.attributes;
    for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-s)<1e-6&&p.getY(i)>=s-1e-6&&p.getY(i)<=2*s+1e-6
      &&p.getZ(i)>=-1e-6&&p.getZ(i)<=s+1e-6&&n.getX(i)>.99)wallVertices++;
  }
  expect(wallVertices).toBeGreaterThanOrEqual(6);w.clear();
});

test('paving is meshed with joints, matches ground contact, breaks and survives streaming',async({page})=>{
  await boot(page);
  const report=await page.evaluate(async()=>{
    const L=await import('/src/level/Layout.js'),{VOXEL:V}=await import('/src/core/Constants.js'),THREE=await import('/node_modules/three/build/three.module.js');
    const g=window.__game,w=g.voxels;let target;
    for(let z=15;z<60&&!target;z+=2)for(let x=-60;x<60;x+=2){const p=L.pavingAtWorld?.(x+1,z+1);if(p?.kind==='footpath'){target={x:x+1,z:z+1,...p};break;}}
    if(!target)return {found:false};
    const {x,z}=target,y=w.terrainHeightAt(x,z),ground=w.groundHeightAt(x,z,y+.5),v=w.worldToVoxel(x,ground-.06,z),material=w.get(...v);
    let bevelVertices=0;
    for(const c of w.chunks.values())if(c.mesh){const a=c.mesh.geometry.attributes.position;for(let i=0;i<a.count;i++)if(Math.abs(a.getX(i)-x)<2&&Math.abs(a.getZ(i)-z)<2&&Math.abs(a.getY(i)-y)<2){
      const off=q=>Math.abs(q/V.SIZE-Math.round(q/V.SIZE));if(off(a.getX(i))>.01||off(a.getZ(i))>.01)bevelVertices++;
    }}
    const meshes=[...w.chunks.values()].flatMap(c=>c.mesh?[c.mesh]:[]),renderErrors=[];
    for(const [dx,dz] of [[0,0],[.31,0],[0,.31],[-.27,.28]]) {
      const px=x+dx,pz=z+dz,py=w.terrainHeightAt(px,pz);
      const ray=new THREE.Raycaster(new THREE.Vector3(px,py+.5,pz),new THREE.Vector3(0,-1,0),0,1);
      const hit=ray.intersectObjects(meshes,false)[0];renderErrors.push(hit?Math.abs(hit.point.y-py):Infinity);
    }
    const hit={x:(v[0]+.5)*V.SIZE,y:(v[1]+.5)*V.SIZE,z:(v[2]+.5)*V.SIZE};
    g.blastAt(hit,.55,{fatShare:0,digsTerrain:true});
    const removed=!w.get(...v),debris=JSON.parse(render_game_to_text()).voxels.debris;
    const coverage=g.level.horizonCoverage,texture=coverage.texture;
    const covered=()=>coverage.data[(Math.floor(z/coverage.columnSize)-coverage.origin)*coverage.size+Math.floor(x/coverage.columnSize)-coverage.origin]===255;
    const hiddenNear=covered();window.teleportJimothy(450,-150);window.advanceTime(.1);
    const visibleFar=!covered();window.teleportJimothy(x,z);window.advanceTime(.1);
    const persists=!w.get(...v);window.restartGame();window.advanceTime(.1);
    return {found:true,error:Math.abs(y-ground),material,bevelVertices,removed,persists,restored:w.get(...v)===material,debris,renderErrors,hiddenNear,visibleFar,hiddenAgain:covered(),textureReused:g.level.horizonCoverage.texture===texture};
  });
  expect(report.hiddenNear&&report.visibleFar&&report.hiddenAgain&&report.textureReused).toBe(true);
  expect(report.found).toBe(true);expect(report.error).toBeLessThan(.025);
  expect(report.material).toBeGreaterThan(21);expect(report.bevelVertices).toBeGreaterThan(20);
  expect(Math.max(...report.renderErrors)).toBeLessThan(.025);expect(report.debris).toBeGreaterThan(0);expect(report.removed).toBe(true);expect(report.persists).toBe(true);expect(report.restored).toBe(true);
});

test('people use the paved strips and traffic stays on the road',async({page})=>{
  await boot(page);await adv(page,4);
  const s=await state(page);
  const report=await page.evaluate(async()=>{
    const L=await import('/src/level/Layout.js'),g=window.__game;
    return {people:g.pedestrians.people.filter(p=>L.pavingAtWorld?.(p.x,p.z)?.kind==='footpath').length,
      cars:g.streetLife.items.filter(p=>p.driving).every(p=>L.roadAtWorld(p.mesh.position.x,p.mesh.position.z))};
  });
  expect(report.people).toBeGreaterThan(25);expect(report.cars).toBe(true);
  const feet=s.people.items.flatMap(p=>p.feet.filter(f=>f.stance).map(f=>Math.abs(f.error))).sort((a,b)=>a-b);
  expect(feet[Math.floor(feet.length*.95)]).toBeLessThan(.12);
});
