// Milestone 07: destructible voxels (ADR-0003).
import { test, expect } from '@playwright/test';
import { DEBRIS } from '../src/core/Constants.js';
import { state, adv, boot } from './helpers.mjs';

// The city is procedurally generated, so specs target the ground slab rather
// than a hardcoded building — it's destructible everywhere and its position
// can't drift when the layout changes.
const TARGET = { x: 4, y: 0.2, z: -6 };
const blast = (page) => page.evaluate((w) => window.blastAtWorld(w.x, w.y, w.z), TARGET);

async function goToWall(page) {
  await adv(page, 0.1);
}

test('district builds into chunked meshes', async ({ page }) => {
  await boot(page);
  const s = await state(page);
  expect(s.voxels.chunks).toBeGreaterThan(0);
  expect(s.voxels.meshes).toBeGreaterThan(0);
  // The whole point: chunks, not one mesh per voxel.
  expect(s.voxels.drawCalls).toBeLessThan(300);
});

test('damage removes voxels and remeshes', async ({ page }) => {
  await boot(page);
  await goToWall(page);
  const before = await state(page);
  const removed = await blast(page);
  expect(removed).toBeGreaterThan(0);
  const after = await state(page);
  expect(after.voxels.removed).toBeGreaterThan(before.voxels.removed);
});

test('debris spawns, is capped, and despawns', async ({ page }) => {
  await boot(page);
  await goToWall(page);
  await blast(page);
  await adv(page, 0.2);
  let s = await state(page);
  expect(s.voxels.debris).toBeGreaterThan(0);
  expect(s.voxels.debris).toBeLessThanOrEqual(DEBRIS.MAX);
  // Blast a lot: the pool must recycle, never grow.
  for (let i = 0; i < 20; i++) {
    await blast(page);
    await adv(page, 0.1);
  }
  s = await state(page);
  expect(s.voxels.debris).toBeLessThanOrEqual(DEBRIS.MAX);
  await adv(page, DEBRIS.LIFETIME + 1);
  s = await state(page);
  expect(s.voxels.debris).toBe(0);
});

test('stays sane after twenty blasts', async ({ page }) => {
  await boot(page);
  await goToWall(page);
  for (let i = 0; i < 20; i++) {
    await blast(page);
    await adv(page, 0.1);
  }
  const s = await state(page);
  expect(s.voxels.drawCalls).toBeLessThan(300);
});

test('restart rebuilds the district', async ({ page }) => {
  await boot(page);
  await goToWall(page);
  await blast(page);
  const damaged = await state(page);
  expect(damaged.voxels.removed).toBeGreaterThan(0);
  await page.evaluate(() => window.restartGame());
  await adv(page, 0.2);
  const fresh = await state(page);
  expect(fresh.voxels.removed).toBe(0);
  expect(fresh.voxels.meshes).toBeGreaterThan(0);
  expect(fresh.voxels.debris).toBe(0);
});
