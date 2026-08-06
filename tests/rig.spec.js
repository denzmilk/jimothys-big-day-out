// Milestone 06: runtime model split + procedural stretchy legs.
import { test, expect } from '@playwright/test';
import { state, adv, boot } from './helpers.mjs';

test('rig loads and splits', async ({ page }) => {
  await boot(page, { withRig: true });
  // 40 MB GLB + 800k-tri split takes a while under headless SwiftShader.
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).rig.loaded,
    undefined,
    { timeout: 90_000 },
  );
  const s = await state(page);
  // head + body + tail + four legs, pre-split at build time by
  // tools/prep_jimothy.py (was 3 when the split happened at runtime).
  expect(s.rig.pieces).toBe(7);
  expect(s.rig.placeholderHidden).toBe(true);
});

test('legs step while waddling', async ({ page }) => {
  await boot(page);
  const before = await state(page);
  expect(before.feet.length).toBe(4);
  await page.keyboard.down('w');
  await adv(page, 2);
  await page.keyboard.up('w');
  const after = await state(page);
  // Every foot must have stepped along with the body (planted feet would
  // lag infinitely; gliding feet would mean no gait at all)…
  for (let i = 0; i < 4; i++) {
    const moved = Math.hypot(after.feet[i].x - before.feet[i].x, after.feet[i].z - before.feet[i].z);
    expect(moved).toBeGreaterThan(3);
    // …and stay near the body like legs, not drift like props.
    const near = Math.hypot(after.feet[i].x - after.jimothy.x, after.feet[i].z - after.jimothy.z);
    expect(near).toBeLessThan(2.5);
  }
});
