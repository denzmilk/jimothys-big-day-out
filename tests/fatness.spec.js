// Milestone 05 acceptance specs: two-tier food economy (scoop vs. stop-and-
// chomp) and the fatness body distortion.
import { test, expect } from '@playwright/test';
import { FOODS, SNACKS, HIDE_SPOTS } from '../src/core/Constants.js';
import { state, adv, boot, seek, tipNearestCan, seedTuning } from './helpers.mjs';

function nearestOfType(s, type) {
  let best = null;
  let bd = Infinity;
  for (const sn of s.snacks) {
    if (sn.type !== type) continue;
    const d = Math.hypot(sn.x - s.jimothy.x, sn.z - s.jimothy.z);
    if (d < bd) { bd = d; best = sn; }
  }
  return best;
}

test('spills contain scraps and a feast', async ({ page }) => {
  await boot(page);
  const s = await tipNearestCan(page);
  const scraps = s.snacks.filter((sn) => sn.type === 'scrap').length;
  const feasts = s.snacks.filter((sn) => sn.type === 'feast').length;
  expect(scraps + s.snacksEaten).toBeGreaterThanOrEqual(SNACKS.SCRAPS_PER_CAN);
  expect(feasts).toBeGreaterThanOrEqual(1);
});

test('scraps scoop on the move', async ({ page }) => {
  await boot(page);
  await tipNearestCan(page);
  const s = await seek(page, (st) => (st.score > 0 ? null : nearestOfType(st, 'scrap')));
  expect(s.score).toBeGreaterThanOrEqual(FOODS.SCRAP.POINTS);
  expect(s.fatness).toBeGreaterThanOrEqual(FOODS.SCRAP.FAT);
});

test('feasts require stopping', async ({ page }) => {
  await boot(page);
  await tipNearestCan(page);
  // Park right next to the feast (not on it), then sprint across it — a
  // moving Jimothy must not hoover up a whole pizza.
  let s = await seek(page, (st) => {
    const f = nearestOfType(st, 'feast');
    if (!f) return null;
    const d = Math.hypot(f.x - st.jimothy.x, f.z - st.jimothy.z);
    return d > 1.6 ? f : null;
  }, { maxIters: 60 });
  const feast = nearestOfType(s, 'feast');
  expect(feast).not.toBeNull();
  await page.keyboard.down('w'); // any direction: just be moving through
  await adv(page, 1.5);
  await page.keyboard.up('w');
  s = await state(page);
  // THE feast we parked next to must survive the drive-by (incidental bonks
  // may spill additional feasts elsewhere — count comparisons flake).
  const survived = s.snacks.some(
    (sn) => sn.type === 'feast' && Math.hypot(sn.x - feast.x, sn.z - feast.z) < 0.5,
  );
  expect(survived).toBe(true);

  // Now walk onto it and STAND — the channel completes and pays out.
  s = await seek(page, (st) => {
    const f = nearestOfType(st, 'feast');
    if (!f) return null;
    const d = Math.hypot(f.x - st.jimothy.x, f.z - st.jimothy.z);
    return d > 0.6 ? f : null;
  }, { maxIters: 60 });
  const scoreBefore = s.score;
  const fatBefore = s.fatness;
  await adv(page, 0.5); // momentum settles, channel starts
  await adv(page, FOODS.FEAST.CHANNEL_SECONDS + 0.5);
  s = await state(page);
  expect(s.fatness).toBeGreaterThanOrEqual(fatBefore + FOODS.FEAST.FAT);
  expect(s.score).toBeGreaterThanOrEqual(scoreBefore + FOODS.FEAST.POINTS);
});

test('interrupted feast resets progress', async ({ page }) => {
  await boot(page);
  await tipNearestCan(page);
  let s = await seek(page, (st) => {
    const f = nearestOfType(st, 'feast');
    if (!f) return null;
    const d = Math.hypot(f.x - st.jimothy.x, f.z - st.jimothy.z);
    return d > 0.6 ? f : null;
  }, { maxIters: 60 });
  const fatBefore = s.fatness;
  await adv(page, 0.5);
  await adv(page, FOODS.FEAST.CHANNEL_SECONDS * 0.6); // 60% chomped…
  // …then panic away and come back: progress must restart from zero.
  await page.keyboard.down('s');
  await adv(page, 0.8);
  await page.keyboard.up('s');
  s = await seek(page, (st) => {
    const f = nearestOfType(st, 'feast');
    if (!f) return null;
    const d = Math.hypot(f.x - st.jimothy.x, f.z - st.jimothy.z);
    return d > 0.6 ? f : null;
  }, { maxIters: 60 });
  await adv(page, 0.5);
  await adv(page, FOODS.FEAST.CHANNEL_SECONDS * 0.6);
  const mid = await state(page);
  expect(mid.fatness).toBe(fatBefore); // 60% + 60% with a reset ≠ done
  await adv(page, FOODS.FEAST.CHANNEL_SECONDS * 0.6);
  const done = await state(page);
  expect(done.fatness).toBeGreaterThanOrEqual(fatBefore + FOODS.FEAST.FAT);
});

test('fatness distorts the body', async ({ page }) => {
  await boot(page);
  const slim = await state(page);
  expect(slim.jimothy.widthScale).toBeLessThanOrEqual(1.05);
  await tipNearestCan(page);
  await seek(page, (st) => (st.fatness >= 3 ? null : nearestOfType(st, 'scrap')));
  await adv(page, 1); // let the jiggle spring settle so scale reads cleanly
  const fatter = await state(page);
  expect(fatter.fatness).toBeGreaterThanOrEqual(3);
  expect(fatter.jimothy.widthScale).toBeGreaterThan(slim.jimothy.widthScale + 0.05);
});

// Trade-offs (Chris's design call 2026-07-23): fat = slower waddle + too
// conspicuous to hide. Low SOFTCAP seeds make a small meal count as very fat.
test('fat jimothy waddles slower', async ({ page }) => {
  await seedTuning(page, { FATNESS: { SOFTCAP: 5 } });
  await boot(page);
  const walk = async () => {
    const before = await state(page);
    await page.keyboard.down('w');
    await adv(page, 1);
    await page.keyboard.up('w');
    const after = await state(page);
    await adv(page, 1); // bleed momentum
    return Math.hypot(after.jimothy.x - before.jimothy.x, after.jimothy.z - before.jimothy.z);
  };
  const slimDistance = await walk();
  await tipNearestCan(page);
  let s = await seek(page, (st) => {
    if (st.fatness >= FOODS.FEAST.FAT) return null;
    const f = st.snacks.find((sn) => sn.type === 'feast');
    if (!f) return null;
    return Math.hypot(f.x - st.jimothy.x, f.z - st.jimothy.z) > 0.6 ? f : null;
  });
  await adv(page, 0.5);
  await adv(page, FOODS.FEAST.CHANNEL_SECONDS + 0.5);
  s = await state(page);
  expect(s.fatness).toBeGreaterThanOrEqual(FOODS.FEAST.FAT);
  const fatDistance = await walk();
  expect(fatDistance).toBeLessThan(slimDistance * 0.85);
});

test('fat jimothy cannot fit in bushes', async ({ page }) => {
  await seedTuning(page, { FATNESS: { SOFTCAP: 5, HIDE_SQUEEZE: 6 } });
  await boot(page);
  await tipNearestCan(page);
  await seek(page, (st) => {
    if (st.fatness >= FOODS.FEAST.FAT) return null;
    const f = st.snacks.find((sn) => sn.type === 'feast');
    if (!f) return null;
    return Math.hypot(f.x - st.jimothy.x, f.z - st.jimothy.z) > 0.6 ? f : null;
  });
  await adv(page, 0.5);
  await adv(page, FOODS.FEAST.CHANNEL_SECONDS + 0.5);
  // Waddle to a bush center — a slim Jimothy would be hidden here (covered by
  // the heat suite), but this blob bulges out of it.
  const s = await seek(page, (st) => {
    let best = null;
    let bd = Infinity;
    for (const h of st.hideSpots) {
      const d = Math.hypot(h.x - st.jimothy.x, h.z - st.jimothy.z);
      if (d < bd) { bd = d; best = h; }
    }
    return bd > 0.5 ? best : null;
  });
  const inBush = s.hideSpots.some(
    (h) => Math.hypot(h.x - s.jimothy.x, h.z - s.jimothy.z) < HIDE_SPOTS.RADIUS,
  );
  expect(inBush).toBe(true);
  expect(s.hidden).toBe(false);
});

test('hud shows fatness', async ({ page }) => {
  await boot(page);
  await tipNearestCan(page);
  const s = await seek(page, (st) => (st.fatness > 0 ? null : nearestOfType(st, 'scrap')));
  await expect(page.locator('#fat')).toContainText(`FAT ${s.fatness}`);
});
