// Milestone 07: destructible voxels (ADR-0003).
import { test, expect } from '@playwright/test';
import { DEBRIS, PLAYER_CONFIG, VOXEL } from '../src/core/Constants.js';
import { state, adv, boot } from './helpers.mjs';

// The city is procedurally generated, so specs target the ground slab rather
// than a hardcoded building — it's destructible everywhere and its position
// can't drift when the layout changes.
//
// The height is resolved AT RUNTIME against the terrain (milestone 17). It used
// to be a literal 0.2, which meant "just above grade" — and on the island that
// point is 41 m inside Compost Hill, where the strata are bedrock and a blast
// correctly removes nothing.
const TARGET = { x: 4, z: -6, above: 0.2 };
const blast = (page) => page.evaluate(
  (w) => window.blastAtWorld(w.x, window.terrainSurfaceAt(w.x, w.z) + w.above, w.z),
  TARGET,
);

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

// --- Milestone 08: headbutt demolishes, roll travels; neither ploughs the road ---

// Open road well clear of the spawn props, so nothing but ground is in range.
const ROAD = { x: 30, z: 30 };

/** How far BELOW its own undug surface the ground sits, on a short line ahead
 *  of Jimothy — the honest test of "did that move dig?", since voxel counts
 *  alone can't tell a wall from a pavement.
 *
 *  Measured as a drop rather than an absolute height (milestone 17). The
 *  absolute version compared against a literal 0 and was only ever asking "is
 *  this below grade"; on a hill that passes however deep the crater is. */
function digDepthLine(page, yaw, samples = 6) {
  return page.evaluate(([y, n]) => {
    const j = JSON.parse(window.render_game_to_text()).jimothy;
    const out = [];
    for (let i = 1; i <= n; i++) {
      const d = i * 0.8;
      const x = j.x + Math.sin(y) * d;
      const z = j.z + Math.cos(y) * d;
      out.push(window.terrainSurfaceAt(x, z) - window.groundHeightAtWorld(x, z));
    }
    return out;
  }, [yaw, samples]);
}

async function setupOnRoad(page, yaw) {
  await page.evaluate(([x, z]) => window.teleportJimothy(x, z), [ROAD.x, ROAD.z]);
  await page.evaluate(() => window.setFatness(90)); // maximum blast power
  await page.evaluate((y) => window.faceJimothy(y), yaw);
  await adv(page, 0.2);
}

// An intact surface has dropped nothing; any dig shows as a positive drop. One
// voxel of slack absorbs the rounding between a bilinear height field and the
// voxel grid it is quantised onto. Unlike comparing whole height lines this
// doesn't fail when the move legitimately flattens a BUILDING on that line.
const sparedGround = (drops) => expect(Math.max(...drops)).toBeLessThan(0.6);

/** Prove the terrain under the test actually is diggable, so a passing
 *  "spared the ground" can't just mean the move did nothing. */
async function assertGroundIsDiggableAhead(page, yaw, distance) {
  const drop = await page.evaluate(([y, d]) => {
    const j = JSON.parse(window.render_game_to_text()).jimothy;
    const x = j.x + Math.sin(y) * d;
    const z = j.z + Math.cos(y) * d;
    window.blastAtWorld(x, window.terrainSurfaceAt(x, z), z);
    return window.terrainSurfaceAt(x, z) - window.groundHeightAtWorld(x, z);
  }, [yaw, distance]);
  expect(drop, 'the ground here was not diggable, so sparing it proves nothing')
    .toBeGreaterThan(0.6);
}

test('headbutt spares the ground', async ({ page }) => {
  await boot(page);
  const yaw = 0.7;
  await setupOnRoad(page, yaw);

  await page.keyboard.press('e');
  await adv(page, 1.2); // full windup + lunge + recover

  // A fat headbutt used to crater the street it lunged over, digging the pit
  // it then had to climb out of. It should demolish structures only.
  sparedGround(await digDepthLine(page, yaw));
  await assertGroundIsDiggableAhead(page, yaw, 2.4);
});

test('roll scrapes instead of trenching', async ({ page }) => {
  await boot(page);
  const yaw = 0.7;
  await setupOnRoad(page, yaw);

  await page.keyboard.press('c');
  await adv(page, 1.2);

  // The roll covers ~10 m, and every metre of it used to become a trench.
  sparedGround(await digDepthLine(page, yaw, 12));
  await assertGroundIsDiggableAhead(page, yaw, 2.4);
});

test('roll removes far less than a headbutt', async ({ page }) => {
  // Both moves fired into the same structure from the same spot, so the only
  // variable is the move. Roll is mobility; headbutt is the demolition tool.
  const damageFrom = async (page, key) => {
    await boot(page);
    await page.evaluate(() => window.setFatness(90));
    const target = await page.evaluate(() => window.findWallTarget());
    await page.evaluate(([x, z]) => window.teleportJimothy(x, z), [target.x, target.z]);
    await page.evaluate((y) => window.faceJimothy(y), target.yaw);
    await adv(page, 0.2);
    const before = (await state(page)).voxels.removed;
    await page.keyboard.press(key);
    await adv(page, 1.2);
    return (await state(page)).voxels.removed - before;
  };
  const headbutt = await damageFrom(page, 'e');
  const roll = await damageFrom(page, 'c');
  expect(headbutt).toBeGreaterThan(0);
  expect(roll).toBeLessThan(headbutt * 0.5);
});

test('lands beside a building instead of hovering beside it', async ({ page }) => {
  await boot(page);
  const wall = await page.evaluate(() => window.findWallTarget());
  expect(wall).not.toBeNull();
  // Falling past a building used to trigger the auto-step every frame: probe
  // blocked, air above, lift, fall, repeat. He hovered against the wall
  // forever — never grounded, unable to hop, and holding a big negative
  // velocity for the next gap he met.
  // 40 m above the ground HERE, not 40 m above the waterline — the latter is
  // underground on any of the island's hills.
  await page.evaluate(
    (w) => window.dropJimothy(w.x, w.z, window.terrainSurfaceAt(w.x, w.z) + 40),
    wall,
  );
  await adv(page, 5);

  const s = await state(page);
  expect(s.jimothy.grounded).toBe(true);
  // His FEET are on the floor that is actually there. The literal `>= -0.01`
  // this replaces meant "never below grade", which on a 40 m hill stays true
  // however deeply he is buried; and measuring his centre rather than his feet
  // hid a whole body radius of slack. One voxel of tolerance, because the floor
  // is a quantisation of a continuous height field.
  const floor = await page.evaluate((j) => window.groundHeightAtWorld(j.x, j.z), s.jimothy);
  const feet = s.jimothy.y - PLAYER_CONFIG.RADIUS;
  expect(feet, `feet ${feet} vs floor ${floor}`).toBeGreaterThanOrEqual(floor - VOXEL.SIZE);
  expect(feet, 'hovering above the floor').toBeLessThan(floor + VOXEL.SIZE);
  // …and it must be a resting state, not a frame of a bouncing cycle.
  const settled = s.jimothy.y;
  await adv(page, 2);
  expect((await state(page)).jimothy.y).toBeCloseTo(settled, 2);
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
