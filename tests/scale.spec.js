// Milestone 23 / JIM-24: the fatness ceiling.
//
// `width = 1 + MAX_WIDTH_GAIN * f` where `f = fat/(fat+SOFTCAP)` is bounded by
// x1.9 for every finite input — the ceiling is arithmetic, not tuning, and no
// value of SOFTCAP moves it. Measured before this milestone: eating 24x more
// between fatness 25 and 600 bought 28% more width.
//
// Chris, 2026-08-08: "that's gotta be an issue to change and increase to an
// actual massive size. Like consume the world size." Target settled 2026-08-09:
// block-sized, x30-50, against craftsman houses at 6-16 m and CITY.BLOCK at 34.
import { test, expect } from '@playwright/test';
import { state, adv, boot } from './helpers.mjs';
import { CITY, FATNESS, PLAYER_CONFIG, HIDE_SPOTS, CAMERA } from '../src/core/Constants.js';

/** His body width in world units at a given fatness. Read off the controller
 *  rather than recomputed here — six places in the codebase used to spell this
 *  formula out longhand, which is exactly how they drift. */
const widthAt = (page, fat) => page.evaluate((f) => {
  window.setFatness(f);
  window.__game.jimothy.postUpdate(0);
  return {
    scale: window.__game.jimothy.widthScale,
    metres: window.__game.jimothy.radius * 2,
  };
}, fat);

test('eating past the old ceiling keeps making him bigger (JIM-24)', async ({ page }) => {
  await boot(page);
  await adv(page, 0.3);

  const seen = [];
  for (const fat of [0, 90, 200, 2000, 20000]) seen.push(await widthAt(page, fat));

  expect(seen[0].scale, 'lean is not x1').toBeCloseTo(1, 2);
  // Strictly increasing, with room to spare. Today 200 / 2000 / 20000 all read
  // x1.80, x1.87 and x1.90 — the three highest values differ by 5%, which is
  // the defect stated as a number.
  for (let i = 1; i < seen.length; i++) {
    expect(seen[i].scale, `fatness ${[0, 90, 200, 2000, 20000][i]} is no bigger than the step before`)
      .toBeGreaterThan(seen[i - 1].scale * 1.5);
  }
});

test('he reaches block scale at a fatness a run can actually deliver (JIM-24)', async ({ page }) => {
  await boot(page);
  await adv(page, 0.3);

  // "As big as a house" was the original ask, and `Gorged` (90) is the fatness
  // every measurement in the docs is quoted at — so that is where a house-sized
  // Jimothy belongs.
  const gorged = await widthAt(page, 90);
  expect(gorged.metres, `fatness 90 is ${gorged.metres.toFixed(1)} m, not house-sized`)
    .toBeGreaterThan(CITY.MIN_HEIGHT);

  // …and block scale is bigger than ANY building on the island, towers included.
  const huge = await widthAt(page, 250);
  expect(huge.metres, `fatness 250 is ${huge.metres.toFixed(1)} m, and the tallest building is ${CITY.MAX_HEIGHT}`)
    .toBeGreaterThan(CITY.MAX_HEIGHT);
  expect(huge.metres, 'not a city block across').toBeGreaterThan(CITY.BLOCK * 0.8);
});

test('the penalties still land where they were tuned (JIM-24)', async ({ page }) => {
  // The growth curve stops saturating; the TRADE-OFFS must not follow it. The
  // speed penalty and the hide squeeze were tuned against a curve that tops out,
  // and inheriting an unbounded one would make a moderately fat Jimothy
  // stationary and un-hideable long before he is interesting.
  await boot(page);
  await adv(page, 0.3);

  const measured = await page.evaluate((consts) => {
    const g = window.__game;
    const out = {};
    for (const fat of [25, 90]) {
      window.setFatness(fat);
      g.jimothy.postUpdate(0);
      const f = fat / (fat + consts.SOFTCAP); // the SATURATING factor, unchanged
      out[fat] = {
        speedMultiplier: 1 - f * consts.SPEED_PENALTY_MAX,
        hideRadius: g.jimothy.hideRadius,
      };
    }
    return out;
  }, { SOFTCAP: FATNESS.SOFTCAP, SPEED_PENALTY_MAX: FATNESS.SPEED_PENALTY_MAX });

  // Unchanged from the values these were signed off at.
  expect(measured[25].speedMultiplier).toBeCloseTo(1 - 0.5 * FATNESS.SPEED_PENALTY_MAX, 3);
  expect(measured[90].speedMultiplier).toBeCloseTo(1 - 0.783 * FATNESS.SPEED_PENALTY_MAX, 2);
  // A bush still fits a chunky raccoon and still refuses a gorged one — the
  // pressure valve closing is a designed trade, not a side effect of the curve.
  expect(measured[25].hideRadius, 'a bush stopped fitting a merely chunky raccoon')
    .toBeGreaterThan(0.5);
  expect(measured[90].hideRadius).toBeLessThan(HIDE_SPOTS.RADIUS);
});

test('the camera keeps him in frame at every size (JIM-24)', async ({ page }) => {
  // Asserted against his actual silhouette in the frustum, never against a
  // distance constant: FOLLOW_DISTANCE is 7 m, which is inside a block-sized
  // Jimothy, so a fixed number cannot be the answer.
  await boot(page);
  await page.evaluate(() => window.teleportJimothy(0, 0));
  await adv(page, 0.5);

  for (const fat of [0, 90, 250]) {
    await page.evaluate((f) => window.setFatness(f), fat);
    await adv(page, 2.5); // let the boom lerp out
    const fits = await page.evaluate((fovDeg) => {
      const g = window.__game;
      const jp = g.jimothy.group.position;
      const cp = g.camera.position;
      const dist = Math.hypot(cp.x - jp.x, cp.y - jp.y, cp.z - jp.z);
      const r = g.jimothy.radius;
      // Half-angle he subtends, against the camera's own half-FOV.
      return {
        subtended: Math.atan2(r, Math.max(dist, 0.001)),
        halfFov: (fovDeg * Math.PI) / 180 / 2,
        dist,
        r,
      };
    }, CAMERA.FOV);
    expect(fits.subtended, `at fatness ${fat} he fills the view `
      + `(radius ${fits.r.toFixed(1)} m at ${fits.dist.toFixed(1)} m)`)
      .toBeLessThan(fits.halfFov * 0.9);
  }
});

test('a block-sized Jimothy can still move (JIM-24)', async ({ page }) => {
  // At 30+ m he is bigger than everything he used to collide with, so the
  // question is not "does he clear a kerb" but "does the city stop him".
  // `CLIMB_HEIGHT` is 2.6 m — nothing to a creature this size, and if it does
  // not scale he wedges against the first house.
  await boot(page);
  await page.evaluate(() => window.teleportJimothy(0, 0));
  await page.evaluate(() => window.setFatness(250));
  await adv(page, 1.5);

  const before = (await state(page)).jimothy;
  await page.keyboard.down('w');
  await adv(page, 4);
  await page.keyboard.up('w');
  const after = (await state(page)).jimothy;

  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  expect(moved, `a block-sized Jimothy walked ${moved.toFixed(1)} m in 4 s`)
    .toBeGreaterThan(PLAYER_CONFIG.SPEED * 0.3);
  expect(after.grounded, 'he ended up off the ground').toBe(true);
});

test('the roll is how a giant gets around (JIM-24)', async ({ page }) => {
  // Chris, 2026-08-09: "The roll is supposed to turn into a katamari style roll
  // and collect at this fatness scale - so that's how you move about." The
  // on-foot penalty stays exactly as signed off, so this is the thing that has
  // to make a 2 km island crossable: today a maxed Jimothy walks at 1.8 m/s and
  // takes 12 minutes.
  await boot(page);
  await page.evaluate(() => window.teleportJimothy(0, 0));
  await page.evaluate(() => window.setFatness(250));
  await adv(page, 1.5);

  const run = async (key, seconds) => {
    await page.evaluate(() => window.teleportJimothy(0, 0));
    await adv(page, 0.5);
    const from = (await state(page)).jimothy;
    await page.keyboard.down('w');
    if (key) await page.keyboard.down(key);
    await adv(page, seconds);
    if (key) await page.keyboard.up(key);
    await page.keyboard.up('w');
    const to = (await state(page)).jimothy;
    return Math.hypot(to.x - from.x, to.z - from.z) / seconds;
  };

  const walked = await run(null, 3);
  const rolled = await run('c', 3);
  expect(rolled, `rolling ${rolled.toFixed(1)} m/s against walking ${walked.toFixed(1)} m/s`)
    .toBeGreaterThan(walked * 2.5);
  // And fast enough in absolute terms that the island is crossable: a lean
  // Jimothy walks it in 5m31s, which is the bar the gameplan sets.
  expect(rolled, 'still not fast enough to cross the island').toBeGreaterThan(PLAYER_CONFIG.SPEED);
});

test('rolling is held, not a one-shot flop, at any size (JIM-24)', async ({ page }) => {
  // The roll was a 0.9 s committed flop. Traversal needs it to continue while
  // the key is down, or "how you move about" is a keypress every second.
  await boot(page);
  await page.evaluate(() => window.setFatness(250));
  await adv(page, 1.0);

  await page.keyboard.down('c');
  await adv(page, 2.5); // comfortably past the old ROLL.DURATION of 0.9
  const during = (await state(page)).jimothy;
  await page.keyboard.up('c');
  await adv(page, 1.5);
  const after = (await state(page)).jimothy;

  expect(during.move, 'the roll ended while the key was still held').toBe('roll');
  expect(after.move, 'the roll never ended after the key came up').toBe(null);
});
