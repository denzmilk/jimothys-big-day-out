import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('SUV spare retains its authored size and mounting point through export and road tilt',async({page})=>{
  await boot(page);
  const report=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {groundVehicle}=await import('/src/core/Grounding.js');
    const {STREET}=await import('/src/core/Constants.js');
    const original=(await new GLTFLoader().loadAsync('/assets/vehicles/kenney-source/suv.glb')).scene;
    const car=window.__game.streetLife.template('car',STREET.VEHICLES.indexOf('suv'));
    const measure=root=>{
      root.updateMatrixWorld(true);const spares=[];
      root.traverse(o=>{if(o.isMesh&&o.name==='wheel-back')spares.push(o);});
      const spare=spares[0],bounds=new THREE.Box3().setFromObject(spare);
      const axle=['wheel-back-left','wheel-back-right'].reduce((v,name)=>v.add(root.getObjectByName(name).getWorldPosition(new THREE.Vector3())),new THREE.Vector3()).multiplyScalar(.5);
      return {count:spares.length,size:bounds.getSize(new THREE.Vector3()),offset:bounds.getCenter(new THREE.Vector3()).sub(axle)};
    };
    const source=measure(original),game=measure(car),spare=car.getObjectByName('wheel-back'),mounted=spare.position.clone();
    let drift=0;
    for(const slope of [-.3,0,.3])for(const yaw of [0,1,2,3]){
      car.rotation.y=yaw;groundVehicle(car,car.userData.half,(x,z)=>slope*z+.1*x);
      drift=Math.max(drift,spare.position.distanceTo(mounted));
    }
    return {count:game.count,sizeError:game.size.distanceTo(source.size.multiplyScalar(1.6)),mountError:game.offset.distanceTo(source.offset.multiplyScalar(1.6)),drift,
      breakawayWheels:window.__game.streetLife.carParts(STREET.VEHICLES.indexOf('suv')).filter(p=>p.userData.part==='wheel').length};
  });
  console.log('SUV_SPARE',JSON.stringify(report));
  expect(report.count).toBe(1);
  expect(report.sizeError).toBeLessThan(.001);
  expect(report.mountError).toBeLessThan(.001);
  expect(report.drift).toBeLessThan(.00001);
  expect(report.breakawayWheels).toBe(5);
});
