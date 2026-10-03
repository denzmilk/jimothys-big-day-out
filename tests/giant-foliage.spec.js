import {test,expect} from '@playwright/test';import {boot,adv} from './helpers.mjs';
test('rolling uproots real plant clumps and carries wildlife with clean release and reset',async({page})=>{
 await boot(page);await page.evaluate(()=>{const g=__game,e=g.environmentLife;g.military.update=()=>{};const a=e.animals.find(a=>!a.bird);window.__carryAnimal=a;setFatness(250);teleportJimothy(a.mesh.position.x,a.mesh.position.z);faceJimothy(0);});await adv(page,.1);await page.keyboard.down('c');await adv(page,.4);
 const during=await page.evaluate(()=>{const g=__game,e=g.environmentLife;return {kinds:g.collector.snapshot().items.map(e=>e.kind),uprooted:e.uprooted?.size||0,animalAttached:!!__carryAnimal.attached,materialArrays:e.batches.map(b=>Array.isArray(b.mesh.material))};});console.log(JSON.stringify(during));expect(during.uprooted).toBeGreaterThan(0);expect(during.kinds).toContain('plants');expect(during.animalAttached).toBe(true);
 await page.keyboard.up('c');await adv(page,1);expect(await page.evaluate(()=>({attached:__carryAnimal.attached,parent:__carryAnimal.mesh.parent===__game.scene}))).toEqual({attached:false,parent:true});
 await page.evaluate(()=>restartGame());expect(await page.evaluate(()=>({clumps:__game.environmentLife.clumps.length,uprooted:__game.environmentLife.uprooted.size,attached:__game.collector.attached.length}))).toEqual({clumps:0,uprooted:0,attached:0});
});
