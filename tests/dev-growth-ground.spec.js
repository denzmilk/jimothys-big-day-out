import{test,expect}from'@playwright/test';import{boot,adv}from'./helpers.mjs';
test('changing the size slider preserves physical feet in both directions',async({page})=>{
 await boot(page);await page.keyboard.press('Backquote');const feet=await page.evaluate(()=>__game.jimothy.position.y);
 for(const f of [250,400,0]){await page.locator('#dt-fatness input[type=number]').evaluate((input,f)=>{input.value=f;input.dispatchEvent(new Event('input',{bubbles:true}));},f);expect(await page.evaluate(()=>__game.jimothy.position.y)).toBeCloseTo(feet,5);await adv(page,.1);expect(await page.evaluate(()=>__game.underground)).toBe(false);}
});
