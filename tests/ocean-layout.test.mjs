import test from 'node:test';import assert from 'node:assert/strict';
import {oceanSites,ruinPieces}from '../src/level/OceanLayout.js';
import {OCEAN}from '../src/core/Constants.js';
import * as Terrain from '../src/level/Terrain.js';
test('ocean sites have separated wreck and ruin families, stable damage and quiet space',()=>{
 const sites=oceanSites();assert(sites.length>14);assert.deepEqual(sites,oceanSites());
 assert.equal(new Set(sites.filter(s=>s.kind==='wreck').map(s=>s.family)).size,3);
 assert.equal(new Set(sites.filter(s=>s.kind==='ruin').map(s=>s.family)).size,4);
 for(let i=0;i<sites.length;i++){const a=sites[i];assert(Terrain.surfaceHeight(a.x,a.z)<-OCEAN.SITE_DEPTH);for(let j=i+1;j<sites.length;j++){const b=sites[j],d=Math.hypot(a.x-b.x,a.z-b.z);assert(d>=OCEAN.SITE_GAP);if(d<OCEAN.REPEAT_GAP)assert.notEqual(a.signature,b.signature);}}
 const layouts=sites.filter(s=>s.kind==='ruin').map(s=>ruinPieces(s));assert(new Set(layouts.map(x=>JSON.stringify(x))).size>3);
 assert(layouts.every(a=>a.length>5&&a.length<=OCEAN.MAX_RUIN_PIECES));
});
