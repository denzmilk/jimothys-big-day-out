import {test,expect} from '@playwright/test';
import {boot} from './helpers.mjs';

test('new traffic appears behind stop lines instead of inside a red junction',async({page})=>{
 await boot(page);
 const cars=await page.evaluate(()=>window.__game.streetLife.items.filter(p=>p.driving&&!p.route.committed&&!p.route.connector).map(p=>({id:p.id,front:p.route.distance+p.half[2],line:p.route.road.length})));
 for(const car of cars)expect(car.front,JSON.stringify(car)).toBeLessThanOrEqual(car.line-.5);
});
