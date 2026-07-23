// Milestone 04 acceptance specs. Pointer lock is stubbed (headless Chromium
// can't truly capture the mouse); everything else drives the real UI.
import { test, expect } from '@playwright/test';

const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const adv = (page, s) => page.evaluate((secs) => window.advanceTime(secs), s);

async function boot(page) {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await adv(page, 0.1);
}

async function openPanel(page) {
  await page.keyboard.press('`');
  await expect(page.locator('#devtools')).toBeVisible();
}

test('panel toggles', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#devtools')).toBeHidden();
  await page.keyboard.press('`');
  await expect(page.locator('#devtools')).toBeVisible();
  await page.keyboard.press('`');
  await expect(page.locator('#devtools')).toBeHidden();
});

test('speed tuning changes movement and persists', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await page.locator('#dt-PLAYER_CONFIG-SPEED input[type="number"]').fill('15');
  // Click back onto the game (like a player would) so the tuning field
  // releases keyboard focus, then close the panel.
  await page.locator('#game-container canvas').click({ position: { x: 200, y: 500 } });
  await page.keyboard.press('`');
  await page.keyboard.down('w');
  let before = await state(page);
  await adv(page, 1);
  await page.keyboard.up('w');
  let after = await state(page);
  expect(before.jimothy.z - after.jimothy.z).toBeGreaterThan(10);

  // Override must survive a reload (localStorage persistence).
  await page.reload();
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await adv(page, 0.1);
  await page.keyboard.down('w');
  before = await state(page);
  await adv(page, 1);
  await page.keyboard.up('w');
  after = await state(page);
  expect(before.jimothy.z - after.jimothy.z).toBeGreaterThan(10);
});

test('rebind forward key', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await page.locator('#devtools [data-tab="keys"]').click();
  const chip = page.locator('.dt-chip[data-action="FORWARD"][data-index="0"]');
  await expect(chip).toHaveText('KeyW');
  await chip.click();
  await page.keyboard.press('i');
  await expect(chip).toHaveText('KeyI');
  await page.keyboard.press('`');

  const start = await state(page);
  await page.keyboard.down('i');
  await adv(page, 0.5);
  await page.keyboard.up('i');
  await adv(page, 0.5); // bleed off arcade momentum before testing W
  const afterI = await state(page);
  expect(afterI.jimothy.z).toBeLessThan(start.jimothy.z - 0.5);

  await page.keyboard.down('w');
  await adv(page, 0.5);
  await page.keyboard.up('w');
  const afterW = await state(page);
  expect(Math.abs(afterW.jimothy.z - afterI.jimothy.z)).toBeLessThan(0.3);
});

test('spawn and remove can', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await page.locator('#devtools [data-tab="level"]').click();
  const baseline = (await state(page)).cans.length;

  await page.locator('#dt-spawn-can').click();
  let s = await state(page);
  expect(s.cans.length).toBe(baseline + 1);
  const nearest = Math.min(
    ...s.cans.map((c) => Math.hypot(c.x - s.jimothy.x, c.z - s.jimothy.z)),
  );
  expect(nearest).toBeLessThan(5);

  await page.locator('#dt-remove-can').click();
  s = await state(page);
  expect(s.cans.length).toBe(baseline);
});

test('export layout', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await page.locator('#devtools [data-tab="level"]').click();
  await page.locator('#dt-export-layout').click();
  const text = await page.locator('#dt-layout-json').inputValue();
  const layout = JSON.parse(text);
  const s = await state(page);
  expect(layout.length).toBe(s.cans.length);
  expect(layout[0].length).toBe(2);
});

test('pointer lock orbit', async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      Object.defineProperty(document, 'pointerLockElement', {
        configurable: true, get: () => this,
      });
      document.dispatchEvent(new Event('pointerlockchange'));
    };
    document.exitPointerLock = () => {
      Object.defineProperty(document, 'pointerLockElement', {
        configurable: true, get: () => null,
      });
      document.dispatchEvent(new Event('pointerlockchange'));
    };
  });
  await boot(page);
  expect((await state(page)).cameraMode).toBe('follow');
  await page.keyboard.press('l');
  await adv(page, 0.1);
  expect((await state(page)).cameraMode).toBe('orbit');

  const before = await state(page);
  await page.evaluate(() => {
    const e = new MouseEvent('mousemove');
    Object.defineProperty(e, 'movementX', { value: 300 });
    Object.defineProperty(e, 'movementY', { value: 0 });
    window.dispatchEvent(e);
  });
  await adv(page, 1);
  const after = await state(page);
  const moved = Math.hypot(after.camera.x - before.camera.x, after.camera.z - before.camera.z);
  expect(moved).toBeGreaterThan(1);

  await page.keyboard.press('l');
  await adv(page, 0.1);
  expect((await state(page)).cameraMode).toBe('follow');
});

test('input debug', async ({ page }) => {
  await boot(page);
  await openPanel(page);
  await page.locator('#devtools [data-tab="keys"]').click();
  await page.keyboard.down('w');
  await adv(page, 0.3);
  await expect(page.locator('#dt-input-debug')).toContainText('KeyW');
  await page.keyboard.up('w');
});
