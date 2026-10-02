import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('loading the rig during a tumble produces the same grounded pose as upright loading',async({page})=>{
  await boot(page,{withRig:true});
  const difference=await page.evaluate(()=>{
    const c=window.__game.jimothy,rig=c.rig,mesh=rig.skinned,ground=()=>20;
    window.setFatness(0);c.voxels={groundHeightAt:ground,terrainHeightAt:ground,solidAtWorld:()=>false};
    const loadAt=pitch=>{
      c.reset();c.yaw=0;c.elapsed=0;c.body.position.set(0,20+c.radius,0);rig.root.position.y=rig.baseY;
      for(const name of Object.keys(rig.bones)){
        rig.pose(name);rig.bones[name].scale.set(1,1,1);rig.bones[name].position.copy(rig.restPos[name]);
      }
      c.group.position.set(0,20,0);c.group.rotation.set(pitch,0,0);c.group.updateMatrixWorld(true);
      c.legs.useBones(rig);for(let frame=0;frame<20;frame++)c.postUpdate(1/60);
      return Array.from({length:mesh.geometry.attributes.position.count},(_,v)=>mesh.getVertexPosition(v,c.group.position.clone()).applyMatrix4(mesh.matrixWorld));
    };
    const upright=loadAt(0),tumbling=loadAt(1.3);
    return Math.max(...tumbling.map((p,i)=>p.distanceTo(upright[i])));
  });
  console.log('LOAD_POSE_DIFFERENCE',difference);expect(difference).toBeLessThan(.001);
});
