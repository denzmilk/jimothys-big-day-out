import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PhysicsSystem} from '../src/systems/PhysicsSystem.js';
import {eventBus,Events} from '../src/core/EventBus.js';
import {STREET,GLASS_SHARDS,RAGDOLL} from '../src/core/Constants.js';

function collision(a,b){
 eventBus.listeners.clear();
 const physics=new PhysicsSystem();physics.world.gravity.setZero();
 for(const [i,filter] of [a,b].entries()){
  const mesh=new THREE.Object3D();mesh.position.set(i?1:-1,10,0);
  eventBus.emit(Events.PROP_CREATE,{id:`collision-${i}`,mesh,half:[.4,.4,.4],mass:1,loose:true,...filter});
  const body=physics.props.get(`collision-${i}`).body;body.linearDamping=body.angularDamping=0;body.velocity.x=i?-2:2;
 }
 for(let i=0;i<45;i++)physics.update(1/60);
 const [aBody,bBody]=[0,1].map(i=>physics.props.get(`collision-${i}`).body);
 return {left:aBody.position.x,right:bBody.position.x,speed:Math.abs(aBody.velocity.x)+Math.abs(bBody.velocity.x)};
}
const part=()=>({collisionFilterGroup:STREET.CAR.PART_GROUP,collisionFilterMask:STREET.CAR.PART_MASK});
test('car fragments collide with one another instead of crossing through',()=>{
 const r=collision(part(),part());assert.ok(r.left<r.right,JSON.stringify(r));assert.ok(r.speed<2,JSON.stringify(r));
});
test('glass shards can hit other debris',()=>{
 const r=collision({collisionFilterMask:GLASS_SHARDS.COLLISION_MASK},part());assert.ok(r.left<r.right,JSON.stringify(r));
});
test('ragdoll limbs can meet car wreckage',()=>{
 const r=collision({collisionFilterGroup:RAGDOLL.GROUP,collisionFilterMask:RAGDOLL.MASK},part());assert.ok(r.left<r.right,JSON.stringify(r));
});

test('a driven kinematic prop gives a loose piece momentum',()=>{
 eventBus.listeners.clear();const p=new PhysicsSystem();p.world.gravity.setZero();
 for(const [id,x,loose] of [['car',-2,false],['piece',0,true]]){const mesh=new THREE.Object3D();mesh.position.set(x,10,0);eventBus.emit(Events.PROP_CREATE,{id,mesh,half:[.4,.4,.4],mass:loose?2:1100,loose});}
 for(let i=0;i<35;i++){eventBus.emit(Events.PROP_POSE,{id:'car',position:new THREE.Vector3(-2+(i+1)*.06,10,0),quaternion:new THREE.Quaternion()});p.update(1/60);}
 assert.ok(p.props.get('piece').body.velocity.x>1,'driving must transfer its velocity');
});
for(const kind of ['person','animal','crab-person'])test(`${kind} movement contacts rubble and collection removes its collision body`,()=>{
 eventBus.listeners.clear();const p=new PhysicsSystem();p.world.gravity.setZero();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(.5,1,.5));mesh.position.set(-2,10,0);eventBus.emit(Events.ENTITY_REGISTER,{id:'walker',kind,mesh,size:1});
 const rubble=new THREE.Object3D();rubble.position.set(0,10.4,0);eventBus.emit(Events.PROP_CREATE,{id:'rubble',mesh:rubble,half:[.2,.2,.2],mass:.4,loose:true});
 for(let i=0;i<35;i++){mesh.position.x=-2+(i+1)*.06;p.update(1/60);}
 assert.ok(p.props.get('rubble').body.position.x>.3,'walking actor must move rubble');
 const count=p.world.bodies.length;eventBus.emit(Events.ENTITY_ATTACH,{id:'walker'});assert.equal(p.world.bodies.length,count-1);
 eventBus.emit(Events.ENTITY_RELEASE,{id:'walker',position:mesh.position,ground:10});assert.equal(p.world.bodies.length,count);
 eventBus.emit(Events.ENTITY_UNREGISTER,{id:'walker'});assert.equal(p.world.bodies.length,count-1);
});

test('overlapping fragments separate gently at birth and collide on a later meeting',()=>{
 eventBus.listeners.clear();const p=new PhysicsSystem();p.world.gravity.setZero();
 for(const id of ['a','b']){const mesh=new THREE.Object3D();mesh.position.set(0,10,0);eventBus.emit(Events.PROP_CREATE,{id,mesh,half:[.3,.3,.3],mass:3,loose:true,spawnSafe:true});}
 const a=p.props.get('a').body,b=p.props.get('b').body;a.velocity.x=-2;b.velocity.x=2;
 for(let i=0;i<30;i++)p.update(1/60);
 assert.ok(a.velocity.length()<3&&b.velocity.length()<3);assert.equal(p.grace.size,0);
 a.velocity.x=2;b.velocity.x=-2;for(let i=0;i<60;i++)p.update(1/60);assert.ok(a.position.x<b.position.x);
 eventBus.emit(Events.PROP_REMOVE,{id:'a'});eventBus.emit(Events.PROP_REMOVE,{id:'b'});assert.equal(p.grace.size,0);
});

test('heavy falling debris reports its incoming impact before the solver stops it',()=>{
 eventBus.listeners.clear();const p=new PhysicsSystem(),mesh=new THREE.Object3D();mesh.position.set(0,10,0);eventBus.emit(Events.ENTITY_REGISTER,{id:'human',kind:'person',mesh});
 let impacts=0;eventBus.on(Events.HUMAN_IMPACT,()=>impacts++);
 const rubble=new THREE.Object3D();rubble.position.set(0,13,0);eventBus.emit(Events.PROP_CREATE,{id:'fall',mesh:rubble,half:[.5,.35,.5],mass:120,loose:true});
 for(let i=0;i<60;i++)p.update(1/60);assert.ok(impacts>0);
});

test('substantial fallen sections join traffic obstacles while gravel stays pushable',()=>{
 eventBus.listeners.clear();const p=new PhysicsSystem();
 for(const [id,mass]of [['slab',1200],['gravel',.4]]){const mesh=new THREE.Object3D();mesh.position.set(0,10,0);eventBus.emit(Events.PROP_CREATE,{id,mesh,half:[1,.5,1],mass,loose:true});}
 const q={obstacles:[]};eventBus.emit(Events.TRAFFIC_OBSTACLES,q);assert.ok(q.obstacles.some(o=>o.id==='slab'));assert.ok(!q.obstacles.some(o=>o.id==='gravel'));
});

test('fragments still overlapping when spawn grace ends separate without a second explosion',()=>{
 eventBus.listeners.clear();const p=new PhysicsSystem();p.world.gravity.setZero();
 for(const [i,id]of ['a','b'].entries()){const mesh=new THREE.Object3D();mesh.position.set(i*.1,10,0);eventBus.emit(Events.PROP_CREATE,{id,mesh,half:[.6,.6,.6],mass:20,loose:true,spawnSafe:true});}
 let speed=0;for(let i=0;i<180;i++){p.update(1/60);for(const {body}of p.props.values())speed=Math.max(speed,body.velocity.length());}
 assert.ok(speed<2,`spawn separation reached ${speed} m/s`);
 assert.ok(p.props.get('a').body.position.distanceTo(p.props.get('b').body.position)>1.15);
});
