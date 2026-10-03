import {test,expect} from '@playwright/test';import {boot,adv} from './helpers.mjs';
test('an open crash furrow keeps daylight and sun shadows throughout the roll',async({page})=>{
 await boot(page);await page.evaluate(()=>{setFatness(250);teleportJimothy(-2,-40);faceJimothy(0);__game.military.update=()=>{};});await adv(page,.2);await page.keyboard.down('c');
 const frames=await page.evaluate(()=>{let dark=0,unshadowed=0;for(let i=0;i<180;i++){advanceTime(1/60);if(__game.underground)dark++;if(!__game.dayNight.shadowLight)unshadowed++;}return{dark,unshadowed};});await page.keyboard.up('c');expect(frames).toEqual({dark:0,unshadowed:0});
});
