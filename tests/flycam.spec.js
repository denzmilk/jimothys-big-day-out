// Milestone 17: the fly camera.
//
// It lands first in the milestone because everything after it — the coastline,
// the hills, the districts — is judged by eye, and there is currently no way to
// look at the map. `window.debugCamera` was a one-shot pose; this is flight.
//
// Both halves of every assertion matter. "The camera moved" alone passes for a
// follow camera that moved because JIMOTHY moved, which is exactly the proxy
// failure the layout specs shipped twice (see tests/layout.spec.js).
import { test, expect } from '@playwright/test';
import { state, adv, boot } from './helpers.mjs';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Enter fly mode and level the pitch. The follow camera looks DOWN at Jimothy,
 *  so inheriting its orientation (which is the right feel) means "forward" is
 *  into the road unless a spec says otherwise. */
async function fly(page) {
  await page.keyboard.press('KeyF');
  await adv(page, 0.05);
  await page.evaluate(() => { window.__game.flyCamera.pitch = 0; });
}

test('F detaches the camera from Jimothy and flies it', async ({ page }) => {
  await boot(page);
  const before = await state(page);
  expect(before.cameraMode).toBe('follow');

  await fly(page);
  expect((await state(page)).cameraMode).toBe('fly');

  await page.keyboard.down('w');
  await adv(page, 1);
  await page.keyboard.up('w');
  const after = await state(page);

  expect(dist(after.camera, before.camera), 'the camera did not fly').toBeGreaterThan(10);
  expect(flat(after.jimothy, before.jimothy), 'the raccoon walked off too').toBeLessThan(0.05);
});

test('flight controls do not leak into the raccoon', async ({ page }) => {
  // Space is HOP and the movement keys are his. The trap is a fly camera that
  // reads the same keys without taking them away from him, so inspecting the
  // map quietly walks the player off a roof.
  await boot(page);
  await fly(page);
  const before = await state(page);

  await page.keyboard.down('Space');
  await page.keyboard.down('d');
  await adv(page, 1);
  await page.keyboard.up('Space');
  await page.keyboard.up('d');
  const after = await state(page);

  expect(after.camera.y, 'Space must lift the camera').toBeGreaterThan(before.camera.y + 5);
  expect(after.jimothy.y, 'Space hopped the raccoon').toBeCloseTo(before.jimothy.y, 1);
  expect(flat(after.jimothy, before.jimothy), 'the raccoon strafed').toBeLessThan(0.05);
});

test('the speed multiplier changes how fast it flies', async ({ page }) => {
  await boot(page);
  await fly(page);
  const travel = async () => {
    const a = await state(page);
    await page.keyboard.down('w');
    await adv(page, 1);
    await page.keyboard.up('w');
    return dist(a.camera, (await state(page)).camera);
  };

  const slow = await travel();
  await page.keyboard.press('Equal');
  await page.keyboard.press('Equal');
  await adv(page, 0.05);
  const fast = await travel();
  expect((await state(page)).fly.multiplier).toBeGreaterThan(1);
  expect(fast).toBeGreaterThan(slow * 2);

  await page.keyboard.press('Minus');
  await page.keyboard.press('Minus');
  await page.keyboard.press('Minus');
  await adv(page, 0.05);
  const slower = await travel();
  expect(slower).toBeLessThan(slow);
});

test('toggling back hands control to the follow camera', async ({ page }) => {
  await boot(page);
  await fly(page);
  await page.keyboard.down('w');
  await adv(page, 1);
  await page.keyboard.up('w');

  await page.keyboard.press('KeyF');
  await adv(page, 0.2);
  const s = await state(page);
  expect(s.cameraMode).toBe('follow');
  // The camera has to be BACK on him, not lerping in from across the city:
  // controls are camera-relative, so a stale frame steers him at random
  // (the reason teleportJimothy snaps it too).
  expect(flat(s.camera, s.jimothy)).toBeLessThan(20);

  await page.keyboard.down('w');
  await adv(page, 1);
  await page.keyboard.up('w');
  const t = await state(page);
  expect(flat(t.jimothy, s.jimothy), 'input stayed suppressed after landing').toBeGreaterThan(1);
});

test('flying streams the world around the camera, not only around Jimothy', async ({ page }) => {
  // Without this the map cannot be inspected at all: you fly out over ground
  // that was never generated, and the island reads as a void.
  await boot(page);
  await fly(page);
  await page.keyboard.press('Equal');
  await adv(page, 0.05);

  await page.keyboard.down('Space');
  await adv(page, 1);
  await page.keyboard.up('Space');
  await page.keyboard.down('w');
  await adv(page, 2);
  await page.keyboard.up('w');
  await adv(page, 0.5); // let the column budget catch up

  const s = await state(page);
  expect(flat(s.camera, s.jimothy), 'did not fly far enough to leave his columns')
    .toBeGreaterThan(80);
  const loaded = await page.evaluate(
    ([x, z]) => [window.isLoadedAtWorld(x, z), window.isLoadedAtWorld(0, 0)],
    [s.camera.x, s.camera.z],
  );
  expect(loaded[0], 'no ground under the camera').toBe(true);
  // …and the raccoon's own ground did not get dropped to pay for it.
  expect(loaded[1], 'the ground under Jimothy was unloaded').toBe(true);
});
