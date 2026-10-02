import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {FOOD_MODELS,SNACKS,FOODS} from '../src/core/Constants.js';
test('sixteen food deliveries have matching labels, metre bounds and a shared-draw palette',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../public/assets/models/food/manifest.json',import.meta.url)));
 assert.deepEqual(manifest.map(f=>f.id),FOOD_MODELS.IDS);assert.deepEqual(manifest.map(f=>f.name),[...SNACKS.NAMES,...FOODS.FEAST.NAMES]);
 for(const f of manifest){const b=fs.readFileSync(new URL(`../public/assets/models/food/${f.id}.glb`,import.meta.url)),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));let triangles=0;assert.equal(g.meshes.length,1);
 for(const p of g.meshes[0].primitives){const a=g.accessors[p.attributes.POSITION];assert.ok(p.attributes.COLOR_0!==undefined);assert.ok(a.count>0);assert.ok(a.min[1]>=-.001);assert.ok(Math.max(...a.max.map((v,i)=>v-a.min[i]))<=f.size+.001);triangles+=g.accessors[p.indices].count/3;}
 assert.ok(triangles<6000,`${f.id}: ${triangles}`);assert.ok(b.length<150000);
 }
});
