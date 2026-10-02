import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
function read(path){const b=fs.readFileSync(path),n=b.readUInt32LE(12);return JSON.parse(b.subarray(20,20+n));}
for(const file of fs.readdirSync('public/assets/models/people').filter(x=>x.endsWith('.glb')))test(`${file} is one skinned draw with the original animation skeleton`,()=>{
 const j=read(`public/assets/models/people/${file}`);assert.equal(j.meshes.reduce((n,m)=>n+m.primitives.length,0),1);assert.equal(j.skins.length,1);assert.ok(j.skins[0].joints.length>20);
 assert.deepEqual(j.animations.map(a=>a.name).sort(),['Idle','Run','Walk']);assert.ok(j.meshes[0].primitives[0].attributes.JOINTS_0!==undefined);assert.equal(j.materials[0].alphaMode,'MASK');
});
