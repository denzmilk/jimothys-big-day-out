// Milestone 20: the aimable headbutt.
//
// `MOVES.HEADBUTT.DIGS_TERRAIN` has been false since 2026-07-23 with a comment
// saying digging becomes something you AIM at once the headbutt can be aimed.
// This is that. The flag was never "Jimothy cannot dig" — it was "an unaimed dig
// is an accident".
//
// So the pair of assertions that matter are opposites, and both are needed: a
// downward swing must dig, and a flat one must still spare the road. Either on
// its own passes on a world where the headbutt does nothing at all.
import { test, expect } from '@playwright/test';
import { state, adv, boot } from './helpers.mjs';
import { MOVES, CAMERA } from '../src/core/Constants.js';

const SPOT = { x: 40, z: 24 };

async function standing(page, { fat = 90 } = {}) {
  await boot(page);
  await page.evaluate((p) => window.teleportJimothy(p.x, p.z), SPOT);
  await page.evaluate((f) => window.setFatness(f), fat);
  await page.evaluate(() => window.faceJimothy(0.7));
  await adv(page, 0.3);
}

/** How far the ground under him has dropped below its undug surface. */
const shaftDepth = (page) => page.evaluate(
  (p) => window.terrainSurfaceAt(p.x, p.z) - window.groundHeightAtWorld(p.x, p.z),
  SPOT,
);

test('the aim is reported, and it follows the camera', async ({ page }) => {
  await standing(page);
  const flat = (await state(page)).jimothy.aim;
  expect(flat, 'no aim in the snapshot').toBeDefined();
  // The default follow camera looks slightly down at him, and that has to stay
  // under the dig threshold or every ordinary swing becomes a hole.
  expect(flat).toBeLessThan(MOVES.HEADBUTT.DIG_ANGLE);

  await page.evaluate((d) => window.aimJimothy(d), CAMERA.PITCH_MAX);
  await adv(page, 0.1);
  expect((await state(page)).jimothy.aim).toBeGreaterThan(MOVES.HEADBUTT.DIG_ANGLE);
});

test('aiming down digs; aiming flat still spares the road', async ({ page }) => {
  // Half of this spec is milestone 08's guarantee, restated. A flat headbutt
  // cratering the street it lunged over is the playtest bug that made
  // DIGS_TERRAIN false in the first place, and aiming must not bring it back.
  await standing(page);
  await page.keyboard.press('e');
  await adv(page, 1.2);
  const flat = await shaftDepth(page);
  expect(flat, 'a flat headbutt dug the road').toBeLessThan(0.6);

  await page.evaluate((d) => window.aimJimothy(d), CAMERA.PITCH_MAX);
  await adv(page, 0.2);
  await page.keyboard.press('e');
  await adv(page, 1.2);
  const dug = await shaftDepth(page);
  expect(dug, 'aiming down did not dig').toBeGreaterThan(flat + 1);
});

test('repeated downward headbutts sink a shaft he can get into', async ({ page }) => {
  // The thing Chris actually asked for: a way underground. Measured as a hole
  // with a depth, and then by putting him in it — a voxel count would pass on a
  // wide scrape that goes nowhere.
  await standing(page);
  await page.evaluate((d) => window.aimJimothy(d), CAMERA.PITCH_MAX);
  await adv(page, 0.2);

  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('e');
    await adv(page, 0.8);
  }
  const depth = await shaftDepth(page);
  expect(depth, `only got ${depth.toFixed(1)} m down`).toBeGreaterThan(3);

  // …and he is standing in it, not beside it.
  const s = await state(page);
  const below = await page.evaluate(
    (j) => window.terrainSurfaceAt(j.x, j.z) - j.y, s.jimothy,
  );
  expect(below, 'he dug a hole and stayed on top of it').toBeGreaterThan(1);
});

test('the reticle is where the blast lands', async ({ page }) => {
  // A reticle that lies is worse than none, and the way it comes to lie is two
  // copies of the same arithmetic. Both come from one function; this asserts it.
  // A digging aim on purpose: that branch uses a different standoff from a flat
  // swing, so it is the one where two copies of the arithmetic would diverge.
  await standing(page);
  await page.evaluate((d) => window.aimJimothy(d), CAMERA.PITCH_MAX);
  await adv(page, 0.2);

  const predicted = await page.evaluate(() => {
    const r = window.__game.reticle;
    return { x: r.position.x, y: r.position.y, z: r.position.z, visible: r.visible };
  });
  expect(predicted.visible, 'no reticle while aiming').toBe(true);

  // Capture, then step. Awaiting a promise that only settles inside
  // advanceTime deadlocks under __MANUAL_TIME__ — nothing ticks until the
  // evaluate returns.
  await page.evaluate(() => {
    window.__lastBlast = null;
    window.__game.onBlast = (p) => { window.__lastBlast = { x: p.x, y: p.y, z: p.z }; };
  });
  await page.keyboard.press('e');
  await adv(page, 1.0);
  const hit = await page.evaluate(() => window.__lastBlast);
  expect(hit, 'the headbutt never fired').toBeTruthy();
  expect(Math.hypot(hit.x - predicted.x, hit.y - predicted.y, hit.z - predicted.z))
    .toBeLessThan(0.35);
});

test('the roll is unaffected — it is not an aimed move', async ({ page }) => {
  // The roll commits to a flop and has its own destruction policy. Aiming the
  // headbutt must not quietly turn the roll into a drill.
  await standing(page);
  await page.evaluate((d) => window.aimJimothy(d), CAMERA.PITCH_MAX);
  await adv(page, 0.2);
  await page.keyboard.press('c');
  await adv(page, 1.4);
  expect(await shaftDepth(page), 'the roll dug while aiming down').toBeLessThan(0.6);
  expect(MOVES.ROLL.DIGS_TERRAIN).toBe(false);
});
