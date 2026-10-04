import test from 'node:test';
import assert from 'node:assert/strict';
import * as City from '../src/level/CityPlanner.js';
import * as Paving from '../src/level/StreetPaving.js';
import * as Layout from '../src/level/Layout.js';
import {PAVING,VOXEL} from '../src/core/Constants.js';
import * as THREE from 'three';
import {VoxelWorld} from '../src/level/VoxelWorld.js';
import {inPolygon} from '../src/core/MathUtils.js';

function edges(){
 City.bake();const result=[];
 for(let z=-600;z<600;z+=7)for(let x=-600;x<600;x+=7){
  const r=City.regionAtWorld(x,z);if(!r||!r.angle||City.regionInteriorAtWorld(x,z)<24)continue;
  const f=r.streetFrame,u=x*f.cos+z*f.sin-f.originU,v=-x*f.sin+z*f.cos-f.originV;
  const a=Math.floor(u/r.block[0]),b=Math.floor(v/r.block[1]),width=a%r.arterialEvery===0?15:9;
  const along=v-b*r.block[1];if(along<22||along>r.block[1]-8)continue;
  const edge=a*r.block[0]+width,wx=(edge+f.originU)*f.cos-(v+f.originV)*f.sin,wz=(edge+f.originU)*f.sin+(v+f.originV)*f.cos;
  if(City.regionAtWorld(wx,wz)!==r||City.regionInteriorAtWorld(wx,wz)<24)continue;
  if(![City.CLASS.ROAD,City.CLASS.FOOTPATH].includes(City.classAt(wx,wz)))continue;
  if([-.08,.08,PAVING.WIDTH-.08,PAVING.WIDTH+.08].some(d=>[City.CLASS.WATER,City.CLASS.PLAZA,City.CLASS.PARK].includes(City.classAt(wx+f.cos*d,wz+f.sin*d))))continue;
  result.push({x:wx,z:wz,n:[f.cos,f.sin],r});
 }
 return result;
}
test('diagonal streets follow their authored edges and keep a two-metre footpath',()=>{
 const samples=edges();assert.ok(samples.length>100);
 for(const {x,z,n}of samples){
  const at=d=>City.classAt(x+n[0]*d,z+n[1]*d);
  assert.equal(at(-.08),City.CLASS.ROAD,`road edge at ${x},${z}`);
  assert.equal(at(.08),City.CLASS.FOOTPATH,`kerb edge at ${x},${z}`);
  assert.equal(at(PAVING.WIDTH-.08),City.CLASS.FOOTPATH);
  assert.notEqual(at(PAVING.WIDTH+.08),City.CLASS.FOOTPATH);
 }
});
test('district boundaries do not cut diagonal roads into planning-grid stairs',()=>{
 City.bake();let checked=0;
 for(let x=-95;x<0;x+=.19)for(const offset of [-.04,.04]){
  const z=60+(x+110)/2+offset;
  const expected=[...City.regions].reverse().find(r=>inPolygon(x,z,r.polygon));
  assert.equal(City.regionAtWorld(x,z)?.id,expected?.id,`district seam ${x},${z}`);checked++;
 }
 assert.ok(checked>900);
});
test('rendered district-border corners follow the polygon edge',()=>{
 let checked=0;
 for(let x=-94;x<0;x+=.39){
  const z=60+(x+110)/2,px=Math.round(x/VOXEL.SIZE)*VOXEL.SIZE,pz=Math.round(z/VOXEL.SIZE)*VOXEL.SIZE;
  const sides=new Set();for(const dx of [-.11,.11])for(const dz of [-.11,.11])sides.add(City.regionAtWorld(px+dx,pz+dz)?.id);
  if(sides.size<2)continue;
  const p=Layout.terrain.cornerPosition(px,pz);
  assert.ok(p&&Math.abs(p[1]-60-(p[0]+110)/2)<1e-6,`unfitted district corner ${px},${pz}`);checked++;
 }
 assert.ok(checked>100);
});
test('uphill grade joins have continuous pitch instead of a sharp ramp step',()=>{
 for(const [x,z,dx,dz]of [[-47.7,-17.7,-1,0],[-47.7,-105.7,-1,0],[-339.7,-237.7,-.9781476007,-.2079116908]]){
  const h=d=>Paving.heightAt(x+dx*d,z+dz*d);
  const change=Math.abs(h(.1)-2*h(0)+h(-.1))/.1;
  assert.ok(change<.04,`pitch changes ${change} at ${x},${z}`);
 }
});
test('shared kerb vertices lie on the continuous edge and preserve raised collision',()=>{
 assert.equal(typeof Layout.terrain.cornerPosition,'function');
 let fitted=0;
 for(const {x,z,n}of edges().slice(0,80)){
  const vx=Math.round(x/VOXEL.SIZE)*VOXEL.SIZE,vz=Math.round(z/VOXEL.SIZE)*VOXEL.SIZE;
  const p=Layout.terrain.cornerPosition(vx,vz);
  if(!p)continue;
  fitted++;
  assert.ok(Math.abs((p[0]-x)*n[0]+(p[1]-z)*n[1])<1e-6);
  const low=Layout.terrain.surfaceHeight(x-n[0]*.02,z-n[1]*.02),high=Layout.terrain.surfaceHeight(x+n[0]*.02,z+n[1]*.02);
  assert.ok(high-low>.15&&high-low<.29,`kerb height ${high-low}`);
 }
 assert.ok(fitted>40,`only ${fitted} fitted corners checked`);
});

test('rendered diagonal kerbs agree with contact on both sides and still break',()=>{
 const {x,z,n}=edges()[0],w=new VoxelWorld(new THREE.Scene()),s=VOXEL.SIZE;
 w.terrain=Layout.terrain;
 for(let vz=Math.floor((z-3)/s);vz<=Math.ceil((z+3)/s);vz++)for(let vx=Math.floor((x-3)/s);vx<=Math.ceil((x+3)/s);vx++){
  const top=w.terrain.topSolidVoxelY((vx+.5)*s,(vz+.5)*s);
  for(let y=top-3;y<=top;y++)w.set(vx,y,vz,w.terrain.materialAtVoxel(vx,y,vz));
 }
 w.remeshDirty();
 const rendered=(px,pz)=>new THREE.Raycaster(new THREE.Vector3(px,w.terrainHeightAt(px,pz)+2,pz),new THREE.Vector3(0,-1,0)).intersectObjects([...w.chunks.values()].flatMap(c=>c.mesh?[c.mesh]:[]))[0]?.point.y;
 for(let along=-1.8;along<=1.8;along+=.23)for(const across of [-.04,.04,.3,1.5]){
  const px=x+n[0]*across-n[1]*along,pz=z+n[1]*across+n[0]*along,h=w.terrainHeightAt(px,pz);
  assert.ok(Math.abs(rendered(px,pz)-h)<.03,`render/contact gap at ${px},${pz}: ${rendered(px,pz)-h}`);
  assert.ok(Math.abs(w.groundHeightAt(px,pz,h+.5)-h)<.03);
 }
 const px=x-n[0],pz=z-n[1],h=w.terrainHeightAt(px,pz);w.damageSphere(px,h-.2,pz,.55);w.remeshDirty();
 assert.ok(rendered(px,pz)<h-.3,'road patch concealed destructive edit');w.clear();
});
