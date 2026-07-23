// Milestone 01 acceptance specs. All assertions go through the harness hooks
// (render_game_to_text / advanceTime) — the first advanceTime call freezes
// wall-clock updates so simulated time is fully test-controlled.
import { test, expect } from '@playwright/test';
import { SCORE, CAMERA, SNACKS } from '../src/core/Constants.js';

const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const adv = (page, s) => page.evaluate((secs) => window.advanceTime(secs), s);

async function boot(page) {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await adv(page, 0.1); // switch the sim to deterministic manual time
}

function nearestUntippedCan(s) {
  let best = null;
  let bd = Infinity;
  for (const c of s.cans) {
    if (c.tipped) continue;
    const d = Math.hypot(c.x - s.jimothy.x, c.z - s.jimothy.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function nearestSnack(s) {
  let best = null;
  let bd = Infinity;
  for (const sn of s.snacks) {
    const d = Math.hypot(sn.x - s.jimothy.x, sn.z - s.jimothy.z);
    if (d < bd) { bd = d; best = sn; }
  }
  return best;
}

// Controls are camera-relative, so steering toward a world target means
// decomposing the world delta into the camera frame: screen-forward is the
// camera→Jimothy bearing ψ, screen-right is ψ rotated -90°.
function keysToward(s, target) {
  const dx = target.x - s.jimothy.x;
  const dz = target.z - s.jimothy.z;
  const psi = Math.atan2(s.jimothy.x - s.camera.x, s.jimothy.z - s.camera.z);
  const fwd = dx * Math.sin(psi) + dz * Math.cos(psi);
  const right = -dx * Math.cos(psi) + dz * Math.sin(psi);
  const keys = [];
  if (fwd > 0.15) keys.push('w'); else if (fwd < -0.15) keys.push('s');
  if (right > 0.15) keys.push('d'); else if (right < -0.15) keys.push('a');
  return keys;
}

// Crude greedy seek: hold keys toward the target, step sim, re-read. pick(s)
// returns the current target, or null once the goal condition is met.
async function seek(page, pick, { maxIters = 80 } = {}) {
  for (let i = 0; i < maxIters; i++) {
    const s = await state(page);
    const target = pick(s);
    if (!target) return s;
    const keys = keysToward(s, target);
    if (!keys.length) return s;
    for (const k of keys) await page.keyboard.down(k);
    await adv(page, 0.25);
    for (const k of keys) await page.keyboard.up(k);
  }
  return state(page);
}

const tipNearestCan = (page) =>
  seek(page, (s) => (s.cans.some((c) => c.tipped) ? null : nearestUntippedCan(s)));

test('keyboard moves jimothy', async ({ page }) => {
  await boot(page);
  const before = await state(page);
  await page.keyboard.down('w');
  await adv(page, 1);
  await page.keyboard.up('w');
  const after = await state(page);
  expect(after.jimothy.z).toBeLessThan(before.jimothy.z - 1);
  expect(Math.abs(after.jimothy.x - before.jimothy.x)).toBeLessThan(0.5);
});

test('gamepad moves jimothy', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = {
      id: 'fake-pad', index: 0, connected: true, mapping: 'standard',
      axes: [0, -1], // left stick pushed up = forward
      buttons: Array.from({ length: 10 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await boot(page);
  const before = await state(page);
  await adv(page, 1);
  const after = await state(page);
  expect(after.jimothy.z).toBeLessThan(before.jimothy.z - 1);
});

// Camera-relative controls: W must mean "away from the camera" and S "toward
// it" no matter how Jimothy has turned — at spawn this coincides with the old
// world-aligned scheme, so the assertions only bite after a turn.
test('W moves away from camera and S toward it after turning', async ({ page }) => {
  await boot(page);
  await page.keyboard.down('d');
  await adv(page, 1.2);
  await page.keyboard.up('d');
  await adv(page, 1.5); // settle camera + bleed momentum

  let s = await state(page);
  let psi = Math.atan2(s.jimothy.x - s.camera.x, s.jimothy.z - s.camera.z);
  await page.keyboard.down('w');
  await adv(page, 1);
  await page.keyboard.up('w');
  let s2 = await state(page);
  let dx = s2.jimothy.x - s.jimothy.x;
  let dz = s2.jimothy.z - s.jimothy.z;
  let len = Math.hypot(dx, dz);
  expect(len).toBeGreaterThan(1);
  expect((dx * Math.sin(psi) + dz * Math.cos(psi)) / len).toBeGreaterThan(0.7);

  await adv(page, 1.5);
  s = await state(page);
  psi = Math.atan2(s.jimothy.x - s.camera.x, s.jimothy.z - s.camera.z);
  await page.keyboard.down('s');
  await adv(page, 1);
  await page.keyboard.up('s');
  s2 = await state(page);
  dx = s2.jimothy.x - s.jimothy.x;
  dz = s2.jimothy.z - s.jimothy.z;
  len = Math.hypot(dx, dz);
  expect(len).toBeGreaterThan(1);
  expect((dx * Math.sin(psi) + dz * Math.cos(psi)) / len).toBeLessThan(-0.7);
});

test('camera follows jimothy', async ({ page }) => {
  await boot(page);
  await page.keyboard.down('w');
  await adv(page, 1.5);
  await page.keyboard.up('w');
  await adv(page, 1.5); // let the lerp settle
  const s = await state(page);
  const dx = s.camera.x - s.jimothy.x;
  const dz = s.camera.z - s.jimothy.z;
  const horiz = Math.hypot(dx, dz);
  expect(horiz).toBeGreaterThan(CAMERA.FOLLOW_DISTANCE - 2);
  expect(horiz).toBeLessThan(CAMERA.FOLLOW_DISTANCE + 2);
  expect(s.camera.y - s.jimothy.y).toBeGreaterThan(1);
  // Jimothy waddled toward -z, so the camera should trail on the +z side.
  expect(dz).toBeGreaterThan(0);
});

test('can tips and spills snacks', async ({ page }) => {
  await boot(page);
  const final = await tipNearestCan(page);
  expect(final.cans.filter((c) => c.tipped).length).toBeGreaterThan(0);
  // Jimothy may waddle through the spill ring and eat some on the same pass,
  // so count remaining + eaten rather than expecting the full ring intact.
  expect(final.snacks.length + final.snacksEaten).toBeGreaterThanOrEqual(SNACKS.PER_CAN);
  expect(final.snacks.length).toBeGreaterThan(0);
});

test('score and combo', async ({ page }) => {
  await boot(page);
  await tipNearestCan(page);
  let s = await seek(page, (st) => (st.score > 0 ? null : nearestSnack(st)));
  const scoreAfterFirst = s.score;
  expect(scoreAfterFirst).toBeGreaterThanOrEqual(SCORE.SNACK);
  s = await seek(page, (st) => (st.score > scoreAfterFirst ? null : nearestSnack(st)));
  expect(s.combo).toBeGreaterThanOrEqual(2);
  expect(s.score).toBeGreaterThanOrEqual(scoreAfterFirst + SCORE.SNACK * 2);
  await adv(page, SCORE.COMBO_WINDOW_SECONDS + 0.5);
  s = await state(page);
  expect(s.combo).toBe(1);
});

test('hud shows live score and combo', async ({ page }) => {
  await boot(page);
  await tipNearestCan(page);
  const s = await seek(page, (st) => (st.combo >= 2 ? null : nearestSnack(st)));
  expect(s.combo).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#score')).toHaveText(`SCORE ${s.score}`);
  await expect(page.locator('#combo')).toContainText(`x${s.combo}`);
});
