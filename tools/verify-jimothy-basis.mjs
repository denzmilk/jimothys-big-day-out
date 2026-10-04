import fs from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const hash=b=>createHash('sha256').update(b).digest('hex');
function inspect(file){
 const b=fs.readFileSync(file),length=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+length)),data=b.subarray(28+length);
 const view=i=>{const v=j.bufferViews[i],offset=v.byteOffset||0;return data.subarray(offset,offset+v.byteLength);};
 const attribute=i=>hash(view(j.accessors[i].bufferView)),p=j.meshes[0].primitives[0];
 return{triangles:j.accessors[p.indices].count/3,attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,attribute(v)])),indices:attribute(p.indices),
  images:j.images.map(i=>hash(view(i.bufferView))),skins:j.skins.map(s=>({joints:s.joints,bind:attribute(s.inverseBindMatrices)})),
  nodes:j.nodes.map(({name,translation,rotation,scale,matrix,children,skin,mesh})=>({name,translation,rotation,scale,matrix,children,skin,mesh}))};
}
const before=inspect(process.argv[2]),after=inspect(process.argv[3]||'public/assets/models/jimothy-skinned.glb');
assert.deepEqual(after,before,'Growth export changed the original basis, skin, texture or rig');console.log(JSON.stringify({identicalBasisSkinUVTexturesRig:true,triangles:after.triangles,bones:after.skins[0].joints.length,images:after.images}));
