import{test}from'node:test';import assert from'node:assert/strict';
const {segmentSphere}=await import('../src/core/ProjectileContact.js');
test('a fast shell hits the near skin even when both sampled endpoints miss',()=>{
 assert.equal(segmentSphere({x:-30,y:0,z:0},{x:30,y:0,z:0},{x:0,y:0,z:0},20),1/6);
 assert.equal(segmentSphere({x:-30,y:21,z:0},{x:30,y:21,z:0},{x:0,y:0,z:0},20),null);
 assert.equal(segmentSphere({x:0,y:0,z:0},{x:1,y:0,z:0},{x:0,y:0,z:0},20),0);
});
