// Milestone 04 acceptance specs. Pointer lock is stubbed (headless Chromium
// can't truly capture the mouse); everything else drives the real UI.
import { test, expect } from '@playwright/test';
import { state, adv, boot } from './helpers.mjs';

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

// --- Fatness on a dial (Chris, 2026-08-08) ---

const jimothyTab = async (page) => {
  await openPanel(page);
  await page.locator('#devtools .dt-tabs button[data-tab="jimothy"]').click();
};

test('the fatness slider makes him fatter, and it is real fatness', async ({ page }) => {
  // Not "a number moved": the point of the dial is to reach the power curve
  // without eating eighty snacks, so what it has to change is the things
  // fatness changes — bulk and blast radius.
  await boot(page);
  const lean = await state(page);
  expect(lean.fatness).toBe(0);

  await jimothyTab(page);
  await page.locator('#dt-fatness input[type="number"]').fill('90');
  await adv(page, 0.3);

  const fat = await state(page);
  expect(fat.fatness).toBe(90);
  expect(fat.jimothy.widthScale, 'he did not actually get wider')
    .toBeGreaterThan(lean.jimothy.widthScale);
  const radius = await page.evaluate(() => window.__game.blastRadius(1));
  expect(radius, 'fatness did not buy any power').toBeGreaterThan(2);
});

test('the presets set named stops, and the readout follows the game', async ({ page }) => {
  await boot(page);
  await jimothyTab(page);

  await page.locator('#dt-fatness-presets button[data-fatness="200"]').click();
  await adv(page, 0.2);
  expect((await state(page)).fatness).toBe(200);
  // Too fat to hide is a real consequence at the top of the range, and it is
  // the one a bare number cannot tell you.
  await expect(page.locator('#dt-fatness-power')).toContainText('too fat to hide');

  await page.locator('#dt-fatness-presets button[data-fatness="0"]').click();
  await adv(page, 0.2);
  expect((await state(page)).fatness).toBe(0);

  // …and the control follows the GAME, not just its own last click: eating
  // must move it, or it sits there misreporting what Jimothy is.
  await page.evaluate(() => window.setFatness(42));
  await adv(page, 0.3);
  await expect(page.locator('#dt-fatness input[type="number"]')).toHaveValue('42');
});

test('fatness is run state, not a persisted override', async ({ page }) => {
  // The Tune tab's rows write to localStorage on purpose. This one must not:
  // a fatness that survived a reload would be a save file nobody asked for,
  // and every spec that boots lean would start failing on this machine only.
  await boot(page);
  await jimothyTab(page);
  await page.locator('#dt-fatness-presets button[data-fatness="90"]').click();
  await adv(page, 0.2);
  expect((await state(page)).fatness).toBe(90);

  await page.reload();
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await adv(page, 0.1);
  expect((await state(page)).fatness, 'the dev slider persisted into a new run').toBe(0);
});
