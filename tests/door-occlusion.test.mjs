import test from 'node:test';import assert from 'node:assert/strict';import{doorIntersection}from'../src/level/DoorModels.js';
test('door obstruction follows every facade orientation and only the intersected leaf',()=>{
 for(let i=0;i<4;i++){
  const yaw=i*Math.PI/2,c=Math.cos(yaw),s=Math.sin(yaw),door={mesh:{position:{x:7,y:2,z:-9},rotation:{y:yaw}},half:[.735,1,.12]};
  const line={ax:7+s*2,ay:2,az:-9+c*2,bx:7-s*2,by:2,bz:-9-c*2};
  assert.ok(doorIntersection(door,line)>.4&&doorIntersection(door,line)<.5);
  assert.equal(doorIntersection(door,{...line,ay:4,by:4}),Infinity);
  assert.equal(doorIntersection(door,{...line,ax:line.ax+c*2,az:line.az-s*2,bx:line.bx+c*2,bz:line.bz-s*2}),Infinity);
  assert.equal(doorIntersection(door,{...line,bx:7+s,by:2,bz:-9+c}),Infinity);
 }
});
