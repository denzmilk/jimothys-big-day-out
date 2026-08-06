// Input-diagnostics strip (milestone 04 append): an always-visible readout of
// every input layer — RAF frames, received key codes, move vector, velocity,
// position — so a dead layer on any machine is visible at a glance.
import { test, expect } from '@playwright/test';
import { adv, boot } from './helpers.mjs';

test('diag strip shows frames ticking', async ({ page }) => {
  await boot(page);
  const frames = async () =>
    parseInt((await page.locator('#diag').textContent()).match(/f:(\d+)/)[1], 10);
  const before = await frames();
  await page.waitForFunction(
    (prev) => parseInt(document.querySelector('#diag').textContent.match(/f:(\d+)/)[1], 10) > prev,
    before,
  );
});

test('diag strip shows key codes and movement', async ({ page }) => {
  await boot(page);
  await adv(page, 0.1);
  await page.keyboard.down('w');
  await adv(page, 0.5);
  await expect(page.locator('#diag')).toContainText('KeyW');
  // The strip refreshes on its own throttle (0.15s of RAF), so wait for it to
  // catch up with the sim rather than racing it.
  await page.waitForFunction(() => {
    const m = document.querySelector('#diag').textContent.match(/vel:([\d.]+)/);
    return m && parseFloat(m[1]) > 1;
  });
  await page.keyboard.up('w');
});

test('keyboard hint appears on click without keys and clears on first key', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#input-hint')).toBeHidden();
  await page.locator('#game-container canvas').click({ position: { x: 200, y: 500 } });
  await expect(page.locator('#input-hint')).toBeVisible();
  await page.keyboard.press('w');
  await expect(page.locator('#input-hint')).toBeHidden();
});

// Regression for the field bug: mv:-1 but vel:0 forever. A zeroed override
// persisted in localStorage (the panel's number boxes accepted out-of-range
// typed values) reapplied itself on every load, freezing movement on that
// machine only — fresh-context tests never saw it. Overrides must self-heal.
test('movement survives a zeroed speed override in storage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'jimothy-dev',
      JSON.stringify({ tuning: { PLAYER_CONFIG: { SPEED: 0, ACCEL: 0 } } }),
    );
  });
  await boot(page);
  await adv(page, 0.1);
  const before = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  await page.keyboard.down('w');
  await adv(page, 1);
  await page.keyboard.up('w');
  const after = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  expect(after.jimothy.z).toBeLessThan(before.jimothy.z - 0.5);
});

test('typing an out-of-range tuning value clamps instead of breaking movement', async ({ page }) => {
  await boot(page);
  await adv(page, 0.1);
  await page.keyboard.press('`');
  const number = page.locator('#dt-PLAYER_CONFIG-SPEED input[type="number"]');
  await number.fill('0');
  await expect(number).toHaveValue('1'); // clamped to the tunable's min
  await page.locator('#game-container canvas').click({ position: { x: 200, y: 500 } });
  await page.keyboard.press('`');
  const before = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  await page.keyboard.down('w');
  await adv(page, 1);
  await page.keyboard.up('w');
  const after = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  expect(after.jimothy.z).toBeLessThan(before.jimothy.z - 0.5);
});

// Same self-heal contract as tuning, for keybinds: an empty or corrupted
// stored bind list must fall back to defaults, never brick a key forever.
test('movement survives corrupted keybind overrides in storage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'jimothy-dev',
      JSON.stringify({ keybinds: { FORWARD: [], BACK: null, HOP: [42] } }),
    );
  });
  await boot(page);
  await adv(page, 0.1);
  const before = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  await page.keyboard.down('w');
  await adv(page, 1);
  await page.keyboard.up('w');
  const after = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  expect(after.jimothy.z).toBeLessThan(before.jimothy.z - 0.5);
});

// A drifting/stuck gamepad stick must never cancel deliberate keyboard input —
// keyboard wins while any direction key is held (threejs-game input pattern).
test('keyboard overrides a drifting gamepad', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = {
      id: 'drifty-pad', index: 0, connected: true, mapping: 'standard',
      axes: [0, 1], // stick stuck fully "down" — exactly cancels W
      buttons: Array.from({ length: 10 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await boot(page);
  await adv(page, 0.5);
  const mid = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  await page.keyboard.down('w');
  await adv(page, 1);
  await page.keyboard.up('w');
  const after = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  expect(after.jimothy.z).toBeLessThan(mid.jimothy.z - 1);
});

test('diag shows nonzero frame delta and current speed constant', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => /dt:\d+(\.\d+)?/.test(document.querySelector('#diag').textContent));
  const text = await page.locator('#diag').textContent();
  expect(parseFloat(text.match(/dt:([\d.]+)/)[1])).toBeGreaterThan(0);
  expect(parseFloat(text.match(/spd:([\d.]+)/)[1])).toBeGreaterThan(0);
});
