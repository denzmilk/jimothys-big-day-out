import{test,expect}from'@playwright/test';import{boot}from'./helpers.mjs';
test('the first explosion keeps the world light layout stable',async({page})=>{
 await boot(page);const r=await page.evaluate(()=>{const g=__game,lights=()=>{const ids=[];g.scene.traverseVisible(o=>{if(o.isPointLight)ids.push(o.uuid)});return ids.sort()};const before=lights(),p=g.jimothy.position;g.carExplosions.spawn({x:p.x+3,y:p.y,z:p.z,radius:5});g.carExplosions.update(.1);return{before,after:lights()};});expect(r.after).toEqual(r.before);
});
