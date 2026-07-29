// Milestone 02 acceptance specs: heat tiers, paparazzi, flash stun, the net,
// hide spots, and the run lifecycle. Tuning is seeded via dev overrides so
// scenarios reach the right tier fast (e.g. one tipped can = tier 3).
import { test, expect } from '@playwright/test';
import { HEAT, PAPARAZZI, TRASH_CAN } from '../src/core/Constants.js';
import { state, adv, boot, nearestSnack, seek, tipNearestCan, seedTuning } from './helpers.mjs';

function nearestPursuerDist(s, type) {
  let bd = Infinity;
  for (const p of s.pursuers) {
    if (type && p.type !== type) continue;
    const d = Math.hypot(p.x - s.jimothy.x, p.z - s.jimothy.z);
    if (d < bd) bd = d;
  }
  return bd;
}

// Step the sim in slices until cond(state) holds or the time budget runs out.
async function advUntil(page, cond, { slice = 0.4, maxSeconds = 20 } = {}) {
  for (let t = 0; t < maxSeconds; t += slice) {
    const s = await state(page);
    if (cond(s)) return s;
    await adv(page, slice);
  }
  return state(page);
}

test('heat rises with chaos but not with eating', async ({ page }) => {
  await boot(page);
  const s1 = await tipNearestCan(page);
  expect(s1.heat.points).toBeGreaterThanOrEqual(HEAT.PER_CAN_TIPPED);
  // Eating is fat, not chaos — heat may only move by cans incidentally
  // bonked while waddling to the snack, never by the snack itself.
  const pointsBefore = s1.heat.points;
  const tippedBefore = s1.cans.filter((c) => c.tipped).length;
  const s2 = await seek(page, (st) => (st.score > 0 ? null : nearestSnack(st)));
  const tippedAfter = s2.cans.filter((c) => c.tipped).length;
  expect(s2.heat.points).toBe(pointsBefore + (tippedAfter - tippedBefore) * HEAT.PER_CAN_TIPPED);
  // A second can crosses the tier-1 threshold and lights a HUD star.
  const s3 = await seek(page, (st) =>
    st.cans.filter((c) => c.tipped).length >= 2 ? null : nearestUntipped(st),
  );
  expect(s3.heat.tier).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#heat')).toContainText('★');
});

function nearestUntipped(s) {
  let best = null;
  let bd = Infinity;
  for (const c of s.cans) {
    if (c.tipped) continue;
    const d = Math.hypot(c.x - s.jimothy.x, c.z - s.jimothy.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

test('paparazzi spawn at tier 1 and close in', async ({ page }) => {
  await seedTuning(page, { HEAT: { PER_CAN_TIPPED: 12 } });
  await boot(page);
  const s1 = await tipNearestCan(page);
  expect(s1.heat.tier).toBeGreaterThanOrEqual(1);
  const s2 = await advUntil(page, (s) => s.pursuers.some((p) => p.type === 'paparazzo'), { maxSeconds: 3 });
  const d1 = nearestPursuerDist(s2, 'paparazzo');
  expect(d1).toBeLessThan(Infinity);
  await adv(page, 2);
  const s3 = await state(page);
  expect(nearestPursuerDist(s3, 'paparazzo')).toBeLessThan(d1);
});

test('tier-2 camera flash stuns jimothy', async ({ page }) => {
  await seedTuning(page, { HEAT: { PER_CAN_TIPPED: 25 } });
  await boot(page);
  const s1 = await tipNearestCan(page);
  expect(s1.heat.tier).toBeGreaterThanOrEqual(2);
  const stunned = await advUntil(page, (s) => s.stunned, { maxSeconds: 25 });
  expect(stunned.stunned).toBe(true);
  // Input is suppressed during the stagger…
  const before = await state(page);
  await page.keyboard.down('w');
  await adv(page, 0.3);
  const during = await state(page);
  expect(Math.hypot(during.jimothy.x - before.jimothy.x, during.jimothy.z - before.jimothy.z)).toBeLessThan(0.6);
  // …and restored after it passes.
  await adv(page, PAPARAZZI.STUN_SECONDS + 0.5);
  await adv(page, 1);
  await page.keyboard.up('w');
  const after = await state(page);
  expect(Math.hypot(after.jimothy.x - during.jimothy.x, after.jimothy.z - during.jimothy.z)).toBeGreaterThan(1);
});

test('animal control nets jimothy and ends the run', async ({ page }) => {
  await seedTuning(page, { HEAT: { PER_CAN_TIPPED: 40 } });
  await boot(page);
  const s1 = await tipNearestCan(page);
  expect(s1.heat.tier).toBeGreaterThanOrEqual(3);
  const s2 = await advUntil(page, (s) => s.pursuers.some((p) => p.type === 'animal-control'), { maxSeconds: 3 });
  expect(s2.pursuers.some((p) => p.type === 'animal-control')).toBe(true);
  // Stand still and accept fate.
  const netted = await advUntil(page, (s) => s.game.netted, { maxSeconds: 30 });
  expect(netted.game.netted).toBe(true);
  expect(netted.game.isPlaying).toBe(false);
  await expect(page.locator('#game-over')).toBeVisible();
  await expect(page.locator('#final-score')).toContainText(String(netted.score));
});

test('hiding drains heat and sheds pursuers', async ({ page }) => {
  await seedTuning(page, { HEAT: { PER_CAN_TIPPED: 12, DECAY_PER_SECOND_HIDDEN: 20 } });
  await boot(page);
  const s1 = await tipNearestCan(page);
  expect(s1.heat.tier).toBeGreaterThanOrEqual(1);
  const hidden = await seek(page, (st) => {
    if (st.hidden) return null;
    let best = null;
    let bd = Infinity;
    for (const h of st.hideSpots) {
      const d = Math.hypot(h.x - st.jimothy.x, h.z - st.jimothy.z);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  });
  expect(hidden.hidden).toBe(true);
  const pointsBefore = hidden.heat.points;
  await adv(page, 2);
  const after = await state(page);
  expect(after.heat.points).toBeLessThan(pointsBefore);
  const drained = await advUntil(page, (s) => s.heat.tier === 0, { maxSeconds: 10 });
  expect(drained.heat.tier).toBe(0);
  const cleared = await advUntil(page, (s) => s.pursuers.length === 0, { maxSeconds: 5 });
  expect(cleared.pursuers.length).toBe(0);
});

test('best score persists across reload', async ({ page }) => {
  await seedTuning(page, { HEAT: { PER_CAN_TIPPED: 40 } });
  await boot(page);
  await tipNearestCan(page);
  const fed = await seek(page, (st) => (st.score > 0 ? null : nearestSnack(st)));
  expect(fed.score).toBeGreaterThan(0);
  const netted = await advUntil(page, (s) => s.game.netted, { maxSeconds: 30 });
  expect(netted.bestScore).toBeGreaterThanOrEqual(netted.score);
  await page.reload();
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await adv(page, 0.1);
  const fresh = await state(page);
  expect(fresh.bestScore).toBe(netted.bestScore);
});

test('restart restores a clean slate and jimothy still moves', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await seedTuning(page, { HEAT: { PER_CAN_TIPPED: 40 } });
  await boot(page);
  const canCount = (await state(page)).cans.length;
  await tipNearestCan(page);
  await seek(page, (st) => (st.score > 0 ? null : nearestSnack(st)));
  const netted = await advUntil(page, (s) => s.game.netted, { maxSeconds: 30 });
  expect(netted.game.netted).toBe(true);

  await page.keyboard.press('r');
  const s = await state(page);
  expect(s.game.netted).toBe(false);
  expect(s.game.isPlaying).toBe(true);
  expect(s.score).toBe(0);
  expect(s.combo).toBe(1);
  expect(s.heat.points).toBe(0);
  expect(s.heat.tier).toBe(0);
  expect(s.pursuers.length).toBe(0);
  expect(s.snacks.length).toBe(0);
  expect(s.cans.length).toBe(canCount);
  expect(s.cans.every((c) => !c.tipped)).toBe(true);
  await expect(page.locator('#game-over')).toBeHidden();

  const before = await state(page);
  await page.keyboard.down('w');
  await adv(page, 1);
  await page.keyboard.up('w');
  const after = await state(page);
  expect(Math.hypot(after.jimothy.x - before.jimothy.x, after.jimothy.z - before.jimothy.z)).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});
