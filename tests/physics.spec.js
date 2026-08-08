// Milestone 22 / JIM-42: dynamic bodies collide with the world you can see.
//
// The physics floor was a plane at y = 0 — the flat 250 m block from before the
// island existed — and the voxel world has no collision bodies at all by design
// (ADR-0003). So every can and every chunk of rubble fell through the terrain
// and slept at sea level, 35–75 m under the ground it spawned on.
//
// Every assertion here is written against THE GROUND UNDER THE BODY, never
// against an absolute y. A fixed height is the exact mistake that caused this:
// `y = 0` meant "grade" when it was written and means "the waterline" now.
import { test, expect } from '@playwright/test';
import { state, adv, boot } from './helpers.mjs';
import { VOXEL } from '../src/core/Constants.js';

/** Every live can's height above the surface directly beneath it.
 *
 *  Against `groundHeightAt`, NOT the terrain height: roads, kerbs and
 *  foundations sit on top of the terrain, so a bin standing correctly on a
 *  4.5 m plinth reads as 4.5 m of error against the bare height field. That
 *  distinction is also the bug that had one bin per run spawning inside a kerb. */
const canDrops = (page) => page.evaluate(() => window.__game.trashCans.cans.map((c) => {
  const p = c.body.position;
  return p.y - window.__game.voxels.groundHeightAt(p.x, p.z, p.y + 1);
}));

/** Every live debris chunk's height above whatever is under it — the floor it
 *  is standing on, which underground is a tunnel floor and not the terrain. */
const debrisRest = (page) => page.evaluate(() => window.__game.debris.slots
  .filter((s) => s.alive)
  .map((s) => {
    const p = s.body.position;
    // Scan from a little above it, so a chunk resting ON the floor reports the
    // floor it is on rather than the next one down.
    return p.y - window.__game.voxels.groundHeightAt(p.x, p.z, p.y + 1);
  }));

test('trash cans are still on their own ground long after they spawn (JIM-42)', async ({ page }) => {
  // The regression, and the measurement that found it: median −8 m after one
  // second, all thirty asleep at the waterline by eight. Fifteen seconds is
  // well past that terminal state and cheap; a minute is 3600 full game updates
  // and proves nothing the eighth second did not.
  await boot(page);
  await page.evaluate(() => window.teleportJimothy(0, 0));
  await adv(page, 0.3);

  const spawned = await canDrops(page);
  expect(spawned.length, 'no cans to test').toBeGreaterThan(5);

  await adv(page, 15);
  const later = await canDrops(page);
  const worst = Math.min(...later);
  expect(worst, `a can sank ${(-worst).toFixed(1)} m through the island`)
    .toBeGreaterThan(-VOXEL.SIZE * 2);
  // …and did not get shoved UP through it either, which a clamp with the wrong
  // scan origin does just as readily.
  expect(Math.max(...later)).toBeLessThan(3);
});

test('blast debris lands on the ground instead of falling to sea level (JIM-42)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.teleportJimothy(0, 0));
  await page.evaluate(() => window.setFatness(60));
  await adv(page, 0.5);

  await page.evaluate(() => window.blastAtJimothy());
  await adv(page, 3);

  const rest = await debrisRest(page);
  expect(rest.length, 'the blast threw no debris at all').toBeGreaterThan(3);
  // Settled ON something, within a chunk's own thickness of it.
  const worst = Math.min(...rest);
  expect(worst, `debris ended ${(-worst).toFixed(1)} m below the floor`)
    .toBeGreaterThan(-VOXEL.SIZE);
  expect(Math.max(...rest), 'debris is hovering').toBeLessThan(VOXEL.SIZE * 3);
});

test('debris in a sewer settles on the tunnel floor (JIM-42)', async ({ page }) => {
  // The case Chris was actually looking at. Nine metres of open tunnel under
  // the rubble is why it read as "blocks disappearing" down here and not up on
  // the street, where the fall is hidden by everything else going on.
  await boot(page);
  const entrances = await page.evaluate(() => window.sewerEntrances());
  const e = entrances.reduce((a, c) => (Math.hypot(c.x, c.z) < Math.hypot(a.x, a.z) ? c : a));
  await page.evaluate((q) => window.teleportJimothy(q.x, q.z), e);
  await page.evaluate(() => window.setFatness(60));
  await adv(page, 1.5);
  const s = await state(page);
  expect(s.underground.below, 'never got underground').toBe(true);

  await page.evaluate(() => window.blastAtJimothy());
  await adv(page, 3);

  // Still down here with him, not 36 m below at the waterline. The tolerance is
  // the blast's own radius plus a voxel, because the swing takes the tunnel
  // FLOOR out too — rubble dropping into the crater it just made is the system
  // working, and a tighter bound would be asserting that digging does nothing.
  const depths = await page.evaluate(() => window.__game.debris.slots
    .filter((sl) => sl.alive)
    .map((sl) => window.terrainSurfaceAt(sl.body.position.x, sl.body.position.z)
      - sl.body.position.y));
  const radius = await page.evaluate(() => window.__game.blastRadius(1));
  expect(depths.length, 'no debris survived the blast').toBeGreaterThan(3);
  expect(Math.max(...depths), 'debris fell out of the tunnel and through the island')
    .toBeLessThan(s.underground.depth + radius + VOXEL.SIZE);
});

test('debris does not pass through a tunnel wall (JIM-42)', async ({ page }) => {
  await boot(page);
  const entrances = await page.evaluate(() => window.sewerEntrances());
  const e = entrances.reduce((a, c) => (Math.hypot(c.x, c.z) < Math.hypot(a.x, a.z) ? c : a));
  await page.evaluate((q) => window.teleportJimothy(q.x, q.z), e);
  await page.evaluate(() => window.setFatness(60));
  await adv(page, 1.5);
  await page.evaluate(() => window.blastAtJimothy());
  await adv(page, 3);

  const buried = await page.evaluate(() => window.__game.debris.slots
    .filter((sl) => sl.alive)
    .filter((sl) => window.voxelSolidAt(
      sl.body.position.x, sl.body.position.y, sl.body.position.z,
    )).length);
  expect(buried, 'debris came to rest inside solid rock').toBe(0);
});

test('blasting the ground out from under a can drops it, even asleep (JIM-42)', async ({ page }) => {
  // The half that turns "voxels were removed" into destruction you can watch.
  // There are no collision events to lose here — there is no collider — so if
  // the clamp does not wake it, a sleeping can hangs in the air over its own
  // crater forever.
  await boot(page);
  await page.evaluate(() => window.teleportJimothy(0, 0));
  await adv(page, 8); // long enough that everything has settled and slept

  const target = await page.evaluate(() => {
    const g = window.__game;
    const jp = g.jimothy.group.position;
    // The NEAREST sleeping can, not the first in the list. Outside the streamed
    // disc `groundHeightAt` deliberately answers from the bare height field and
    // knows nothing about craters, so a can 115 m away cannot notice its floor
    // has gone — correct behaviour, and it made the first version of this spec
    // assert something the game never promises.
    const asleep = g.trashCans.cans
      .filter((c) => c.body.sleepState === 2
        && g.voxels.isLoadedAtWorld(c.body.position.x, c.body.position.z));
    if (!asleep.length) return null;
    const can = asleep.reduce((a, c) => (
      Math.hypot(c.body.position.x - jp.x, c.body.position.z - jp.z)
        < Math.hypot(a.body.position.x - jp.x, a.body.position.z - jp.z) ? c : a));
    const p = can.body.position;
    return { x: p.x, y: p.y, z: p.z };
  });
  expect(target, 'no loaded can ever went to sleep').toBeTruthy();

  // Take out the ground beneath it, not the can itself.
  await page.evaluate((t) => {
    window.setFatness(60);
    window.blastAtWorld(t.x, t.y - 2.2, t.z);
  }, target);
  await adv(page, 2.5);

  const dropped = await page.evaluate((t) => {
    const can = window.__game.trashCans.cans.reduce((a, c) => (
      Math.hypot(c.body.position.x - t.x, c.body.position.z - t.z)
        < Math.hypot(a.body.position.x - t.x, a.body.position.z - t.z) ? c : a));
    return t.y - can.body.position.y;
  }, target);
  expect(dropped, 'the can hung in the air over its own crater').toBeGreaterThan(0.5);
});

test('jimothy is not clamped twice — he does his own (JIM-42)', async ({ page }) => {
  // He is KINEMATIC and hand-clamps against the same grid. A second clamp on
  // top of his would fight the auto-step and the hop, which is a far worse bug
  // than the one being fixed.
  await boot(page);
  await page.evaluate(() => window.dropJimothy(0, 0, 60));
  await adv(page, 4);
  const s = await state(page);
  expect(s.jimothy.grounded, 'he never landed').toBe(true);

  // Hopping still leaves the ground and comes back.
  await page.keyboard.press('Space');
  await adv(page, 0.2);
  const mid = await state(page);
  expect(mid.jimothy.y, 'the hop was clamped away').toBeGreaterThan(s.jimothy.y + 0.2);
  await adv(page, 2);
  expect((await state(page)).jimothy.grounded).toBe(true);
});
