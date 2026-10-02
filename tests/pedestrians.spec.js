import { test, expect } from '@playwright/test';
import { boot, adv, state } from './helpers.mjs';

test('MPFB neighbours populate the street, animate and stay out of solid walls', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__game.pedestrians.ready === true);
  const a = await state(page);
  expect(a.people.models).toBe(12);
  expect(a.people.nearby).toBeGreaterThanOrEqual(12);
  const first = a.people.items;
  await adv(page, 5);
  const b = await state(page);
  expect(b.people.items.filter(p => {
    const old = first.find(o => o.id === p.id);
    return old && Math.hypot(p.x-old.x,p.z-old.z)>1;
  }).length).toBeGreaterThan(8);
  expect(b.people.items.every(p => p.animation === 'Walk' || p.animation === 'Idle' || p.animation === 'Run')).toBe(true);
  const blocked = await page.evaluate(() => window.__game.pedestrians.people.filter(p => window.voxelSolidAt(p.x,p.y+1,p.z)).length);
  expect(blocked).toBe(0);
});

test('neighbours follow exploration and restart does not accumulate rigs', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__game.pedestrians.ready === true);
  const baseline = (await state(page)).people.count;
  await page.evaluate(() => window.teleportJimothy(420,-140));
  await adv(page, 2);
  expect((await state(page)).people.nearby).toBeGreaterThanOrEqual(12);
  for(let i=0;i<3;i++) {
    await page.evaluate(() => window.restartGame());
    await adv(page,.1);
    expect((await state(page)).people.count).toBe(baseline);
  }
});


test('a close encounter emits one scare per person and clothes write depth', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__game.pedestrians.ready === true);
  const id = await page.evaluate(async () => {
    const {eventBus,Events}=await import('/src/core/EventBus.js');
    window.__scares=[];eventBus.on(Events.LOCAL_SCARED,e=>window.__scares.push(e.id));
    const {HIDE_SPOTS}=await import('/src/core/Constants.js');
    const p=window.__game.pedestrians.people.find(p=>HIDE_SPOTS.POSITIONS.every(([x,z])=>Math.hypot(p.x+1-x,p.z-z)>HIDE_SPOTS.RADIUS+1));
    window.teleportJimothy(p.x+1,p.z);return p.id;
  });
  await adv(page,.3);
  expect(await page.evaluate(id=>window.__scares.filter(x=>x===id).length,id)).toBe(1);
  await adv(page,.3);
  expect(await page.evaluate(id=>window.__scares.filter(x=>x===id).length,id)).toBe(1);
  expect(await page.evaluate(()=>{
    let bad=0;window.__game.pedestrians.people[0].visual.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m.transparent||!m.depthWrite)bad++;});return bad;
  })).toBe(0);
});
