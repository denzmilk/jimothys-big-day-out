import {test,expect} from '@playwright/test';
import {boot,adv} from './helpers.mjs';

async function sample(page){
  return page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const p=window.__game.pursuers.animalControl,net=p.group.getObjectByName('capture-net');
    p.group.updateWorldMatrix(true,true);
    const rim=net.children.find(m=>m.geometry?.type==='TorusGeometry').getWorldPosition(new T.Vector3());
    const shaft=net.children.find(m=>m.geometry?.type==='CylinderGeometry'),half=shaft.geometry.parameters.height/2;
    const a=shaft.localToWorld(new T.Vector3(0,half,0)),b=shaft.localToWorld(new T.Vector3(0,-half,0));
    const rear=a.distanceTo(rim)>b.distanceTo(rim)?a:b;
    const forward=new T.Vector3(0,0,1).applyQuaternion(p.group.getWorldQuaternion(new T.Quaternion()));
    const line=new T.Line3(a,b),hands=['l','r'].map(side=>{
      const hand=p.visual.getObjectByName(`hand_${side}`),finger=p.visual.getObjectByName(`index_01_${side}`);
      const palm=hand.getWorldPosition(new T.Vector3()).lerp(finger.getWorldPosition(new T.Vector3()),.65);
      return {gap:palm.distanceTo(line.closestPointToPoint(palm,true,new T.Vector3())),
        elbow:p.group.worldToLocal(p.visual.getObjectByName(`lowerarm_${side}`).getWorldPosition(new T.Vector3())).toArray()};
    });
    return {phase:p.netPhase,lead:rim.clone().sub(rear).dot(forward),hands,rim:rim.toArray(),capture:JSON.parse(window.render_game_to_text()).capture};
  });
}
async function setup(page){
  await boot(page);await page.evaluate(()=>{
    window.restartGame();window.setFatness(0);const j=window.__game.jimothy.group.position;
    window.spawnPursuerAt('animal-control',j.x,j.z+1);
  });
}

test('animal control presents the hoop ahead of the handle during the wind-up and swing',async({page})=>{
  await setup(page);await adv(page,.7);
  expect((await sample(page)).lead).toBeGreaterThan(.3);
  await adv(page,.35);expect((await sample(page)).lead).toBeGreaterThan(.3);
});

test('both palms grip the shaft and both elbows move through the net swing',async({page})=>{
  await setup(page);await adv(page,.05);const carry=await sample(page);
  await adv(page,.8);const windup=await sample(page);
  await adv(page,.4);const hold=await sample(page);
  for(const pose of [carry,windup,hold])for(const hand of pose.hands)expect(hand.gap).toBeLessThan(.05);
  for(let i=0;i<2;i++){
    expect(Math.hypot(...windup.hands[i].elbow.map((v,j)=>v-carry.hands[i].elbow[j]))).toBeGreaterThan(.12);
    expect(Math.hypot(...windup.hands[i].elbow.map((v,j)=>v-hold.hands[i].elbow[j]))).toBeGreaterThan(.12);
  }
  expect(hold.capture.phase).toBe('hold');
});

test('missed swings recover continuously on slopes and the held net follows a ragdoll hand',async({page})=>{
  await setup(page);
  const result=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {CAPTURE}=await import('/src/core/Constants.js');
    const g=window.__game,p=g.pursuers.animalControl,net=p.group.getObjectByName('capture-net');
    const rim=net.children.find(m=>m.geometry?.type==='TorusGeometry');
    const phases=new Set();let previous=null,maxStep=0,minClearance=Infinity,maxGripError=0;
    for(let i=0;i<180;i++){
      if(i===40){const j=g.jimothy.group.position;window.teleportJimothy(j.x+15,j.z);}
      window.advanceTime(1/60);phases.add(p.netPhase);p.group.updateWorldMatrix(true,true);
      const point=rim.getWorldPosition(new T.Vector3());
      if(previous&&p.netPhase!=='idle')maxStep=Math.max(maxStep,point.distanceTo(previous));previous=point;
      for(const arm of p.netArms)maxGripError=Math.max(maxGripError,arm.hand.getWorldPosition(new T.Vector3()).distanceTo(p.netPose.localToWorld(arm.wrist.clone())));
      for(let k=0;k<16;k++){
        const a=k/16*Math.PI*2,edge=rim.localToWorld(new T.Vector3(Math.cos(a)*CAPTURE.NET_RADIUS,Math.sin(a)*CAPTURE.NET_RADIUS,0));
        minClearance=Math.min(minClearance,edge.y-g.pursuers._groundY(edge.x,edge.z));
      }
    }
    const {eventBus,Events}=await import('/src/core/EventBus.js');
    const before=net.getWorldPosition(new T.Vector3());
    eventBus.emit(Events.HUMAN_IMPACT,{id:`pursuer-${p.id}`,x:p.group.position.x-1,z:p.group.position.z,radius:2});
    const relative=net.matrix.clone();window.advanceTime(.3);p.group.updateWorldMatrix(true,true);
    const down=p.ragdoll,held=net.parent===p.visual.getObjectByName('hand_r');
    const relativeDrift=Math.max(...net.matrix.elements.map((v,i)=>Math.abs(v-relative.elements[i])));
    const travelled=net.getWorldPosition(new T.Vector3()).distanceTo(before);
    window.advanceTime(12);const recovered=!p.ragdoll;
    window.restartGame();
    return {phases:[...phases],maxStep,minClearance,maxGripError,down,held,relativeDrift,travelled,recovered,remaining:JSON.parse(window.render_game_to_text()).ragdolls.count};
  });
  expect(result.phases).toEqual(expect.arrayContaining(['windup','swing','recovery','idle']));
  expect(result.maxStep).toBeLessThan(.25);
  expect(result.minClearance).toBeGreaterThan(0);
  expect(result.maxGripError).toBeLessThan(.015);
  expect(result.down).toBe(true);expect(result.held).toBe(true);
  expect(result.relativeDrift).toBeLessThan(1e-6);expect(result.travelled).toBeGreaterThan(.1);
  expect(result.recovered).toBe(true);expect(result.remaining).toBe(0);
});

test('a catcher arriving during a bubble shield retains a valid held pose and can swing afterwards',async({page})=>{
  await boot(page);
  const shielded=await page.evaluate(async()=>{
    const {gameState}=await import('/src/core/GameState.js');
    window.restartGame();gameState.tools.shield=3;
    const g=window.__game,j=g.jimothy.position;
    window.spawnPursuerAt('animal-control',j.x,j.z+1);window.advanceTime(.2);
    const p=g.pursuers.animalControl;p.group.updateWorldMatrix(true,true);
    return {finite:p.group.matrixWorld.elements.every(Number.isFinite),holding:gameState.capture.holding};
  });
  expect(shielded.finite).toBe(true);expect(shielded.holding).toBe(false);
  await adv(page,3);await adv(page,1.5);
  const active=await sample(page);expect(active.capture.phase).toBe('hold');
  expect(active.lead).toBeGreaterThan(.3);for(const hand of active.hands)expect(hand.gap).toBeLessThan(.05);
});
