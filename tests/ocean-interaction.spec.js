import{test,expect}from'@playwright/test';import{boot,adv,state}from'./helpers.mjs';
test.describe.configure({mode:'parallel'});
async function setup(page){await boot(page);await page.waitForFunction(()=>__game.ocean?.ready);}
test('swimming sweep stops at an intact imported wreck face',async({page})=>{
 await setup(page);const r=await page.evaluate(async()=>{const g=__game,s=g.ocean.sites.find(s=>s.kind==='wreck');teleportJimothy(s.x,s.z);advanceTime(.6);const{eventBus,Events}=await import('/src/core/EventBus.js'),THREE=await import('/node_modules/three/build/three.module.js');let selected;
 for(const p of g.ocean.parts.filter(p=>p.kind==='wreckage')){p.mesh.updateMatrixWorld(true);p.mesh.traverse(o=>{if(selected||!o.isMesh)return;const a=o.geometry.attributes.position,n=o.geometry.attributes.normal;const indices=o.geometry.index;for(let i=0;i<(indices?.count||a.count)-2;i+=3){const ia=indices?indices.getX(i):i,ib=indices?indices.getX(i+1):i+1,ic=indices?indices.getX(i+2):i+2;const centre=new THREE.Vector3().fromBufferAttribute(a,ia).add(new THREE.Vector3().fromBufferAttribute(a,ib)).add(new THREE.Vector3().fromBufferAttribute(a,ic)).multiplyScalar(1/3).applyMatrix4(o.matrixWorld),normal=new THREE.Vector3().fromBufferAttribute(n,ia).transformDirection(o.matrixWorld);if(centre.y>g.voxels.terrainHeightAt(centre.x,centre.z)+.15&&Math.abs(normal.y)<.8){selected={centre,normal};break;}}});if(selected)break;}
 if(!selected)return null;const{centre,normal}=selected,from=centre.clone().addScaledVector(normal,1),to=centre.clone().addScaledVector(normal,-.5);let contact;eventBus.emit(Events.SWIM_CONTACT,{from,to,radius:.2,receive:p=>contact={...p}});return{contact,to};});
 expect(r).not.toBeNull();expect(r.contact).toBeDefined();expect(Math.hypot(r.contact.x-r.to.x,r.contact.y-r.to.y,r.contact.z-r.to.z)).toBeGreaterThan(.3);
});
test('rolling under water collects physical artifacts and releases them back into the sea',async({page})=>{
 await setup(page);await page.evaluate(()=>{const g=__game,s=g.ocean.sites.find(s=>s.kind==='wreck');setFatness(60);teleportJimothy(s.x,s.z);advanceTime(.6);const p=g.ocean.parts.find(p=>p.kind==='artifact');teleportJimothy(p.mesh.position.x,p.mesh.position.z);g.jimothy.diving=true;});
 await page.keyboard.down('c');await adv(page,.15);const carried=(await state(page)).collection.items;expect(carried.some(p=>p.kind==='ocean-artifact')).toBe(true);await page.keyboard.up('c');await adv(page,1.2);
 const released=await page.evaluate(ids=>__game.ocean.parts.filter(p=>ids.includes(p.id)).map(p=>({attached:p.attached,y:p.mesh.position.y,active:__game.physics.props.get(p.id)?.active})),carried.map(p=>p.id));expect(released.length).toBeGreaterThan(0);expect(released.every(p=>!p.attached&&p.active&&p.y<0)).toBe(true);
});
test('a real overhead obstruction removes the shaft passing through it',async({page})=>{
 await setup(page);const r=await page.evaluate(async()=>{const g=__game,THREE=await import('/node_modules/three/build/three.module.js');teleportJimothy(-850,0);advanceTime(.3);g.camera.position.set(-850,-4,0);g.ocean.afterCamera();const before=g.ocean.snapshot().rays,m=new THREE.Matrix4();g.ocean.rayMesh.getMatrixAt(0,m);const p=new THREE.Vector3().setFromMatrixPosition(m),s=.22;
 for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++)for(let z=-2;z<=2;z++)g.voxels.setEdit(Math.floor(p.x/s)+x,Math.floor(p.y/s)+y,Math.floor(p.z/s)+z,6);g.ocean.afterCamera();return{before,after:g.ocean.snapshot().rays};});expect(r.before).toBeGreaterThan(0);expect(r.after).toBeLessThan(r.before);
});

test('ascending stops beneath a submerged voxel ceiling',async({page})=>{
 await setup(page);const floor=await page.evaluate(()=>{
  const g=__game,s=.22,vy=Math.floor(-3/s);teleportJimothy(-850,0);g.jimothy.body.position.y=-5;g.jimothy.diving=true;g.jimothy.vy=0;g.jimothy._prevFeetY=undefined;advanceTime(.2);
  const vx=Math.floor(g.jimothy.body.position.x/s),vz=Math.floor(g.jimothy.body.position.z/s);
  for(let x=-8;x<=8;x++)for(let z=-8;z<=8;z++)g.voxels.setEdit(vx+x,vy,vz+z,6);
  return vy*s;
 });await page.keyboard.down('Space');await adv(page,2);await page.keyboard.up('Space');
 const r=await page.evaluate(()=>({top:__game.jimothy.body.position.y+__game.jimothy.radius,diving:__game.jimothy.diving}));expect(r.diving).toBe(true);expect(r.top).toBeLessThanOrEqual(floor+.001);expect(r.top).toBeGreaterThan(floor-.1);
});

test('kelp breaks into a physical part and stays removed when its habitat rebuilds',async({page})=>{
 await setup(page);const r=await page.evaluate(async()=>{
  const g=__game;teleportJimothy(-850,0);advanceTime(.6);const plant=g.ocean.plants.find(p=>p.kind==='kelp'),{eventBus,Events}=await import('/src/core/EventBus.js');
  eventBus.emit(Events.WORLD_IMPACT,{x:plant.x,y:plant.y,z:plant.z,radius:2});advanceTime(.1);
  const part=g.ocean.parts.find(p=>p.site===plant.id),loose=part?.loose,physical=!!g.physics.props.get(part?.id)?.active;g.ocean.populateHabitat();
  return{loose,physical,removed:!g.ocean.plants.some(p=>p.id===plant.id),damage:g.ocean.damage.has(plant.id)};
 });expect(r).toEqual({loose:true,physical:true,removed:true,damage:true});
});
