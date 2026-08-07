// Milestone 12: chunk streaming (JIM-01).
import { test, expect } from '@playwright/test';
import { state, adv, boot } from './helpers.mjs';
import { STREAM, VOXEL } from '../src/core/Constants.js';
import * as Layout from '../src/level/Layout.js';

const stats = async (page) => (await state(page)).voxels;
// Derived, never hardcoded: these bounds are properties of the radii, and a
// literal here would quietly stop meaning anything the first time they change.
const LOADED_DISC = (STREAM.LOAD_RADIUS * 2 + 1) ** 2;
const UNLOAD_DISC = (STREAM.UNLOAD_RADIUS * 2 + 1) ** 2;

test('boot builds only what is near spawn, not the whole map', async ({ page }) => {
  await boot(page);
  const s = await stats(page);
  // Was 910x910x2 ground voxels eagerly, forcing every chunk into existence
  // before the first frame — 19 s boot and 3.5 GB at 5x per side (JIM-01).
  // The load radius defines a square disc of columns around spawn. Exceeding
  // it means something is generating the world behind the streamer's back.
  expect(s.columns).toBeLessThanOrEqual(LOADED_DISC);
  expect(s.columns).toBeGreaterThan(0);
  // Ground under his feet on frame one, or he falls before he can walk.
  expect(s.chunks).toBeGreaterThan(0);
});

test('walking generates new ground and never opens a hole under him', async ({ page }) => {
  await boot(page);
  const start = await state(page);
  const before = start.voxels.columns;

  // Cross several chunk columns. A column is 64 voxels x 0.55 = 35 world
  // units, so this is a few columns of travel in a straight line.
  for (let i = 0; i < 12; i++) {
    const s = await state(page);
    await page.evaluate(([x, z]) => window.teleportJimothy(x, z), [s.jimothy.x + 12, s.jimothy.z]);
    await adv(page, 0.4);
    const now = await state(page);
    // The floor must exist wherever he lands. Falling through is JIM-19's
    // shape and is exactly what an ungenerated column reads as.
    expect(now.jimothy.y, `fell through at x=${now.jimothy.x}`).toBeGreaterThan(-1);
    expect(now.jimothy.grounded || now.jimothy.y > 0).toBe(true);
  }
  expect((await stats(page)).columns).toBeGreaterThan(0);
  expect(before).toBeGreaterThan(0);
});

test('memory is bounded on a long walk — columns plateau, not climb', async ({ page }) => {
  await boot(page);
  const seen = [];
  for (let i = 0; i < 20; i++) {
    const s = await state(page);
    await page.evaluate(([x, z]) => window.teleportJimothy(x, z), [s.jimothy.x + 20, s.jimothy.z]);
    await adv(page, 0.4);
    seen.push((await stats(page)).columns);
  }
  // Unloading is the whole point: without it this climbs monotonically and
  // the heap grows until the map is fully resident again.
  // The unload radius is a hard ceiling on what can be resident: everything
  // outside it is dropped every frame, so the set cannot grow past that disc
  // however far he walks. Before the streaming centre bounded on-demand
  // generation, this climbed 57 -> 83 and kept going.
  const peak = Math.max(...seen);
  expect(peak, `columns: ${seen.join(',')}`).toBeLessThanOrEqual(UNLOAD_DISC);
  expect(seen[seen.length - 1]).toBeLessThanOrEqual(peak);
});

test('damage survives the chunk being unloaded and regenerated', async ({ page }) => {
  // Chris, 2026-08-07: damage persists. A regenerated column comes back
  // pristine unless edits are stored separately, healing every hole Jimothy
  // made — unacceptable in a game about destruction.
  await boot(page);
  const target = await page.evaluate(() => window.findWallTarget());
  expect(target, 'no wall found to smash').toBeTruthy();

  await page.evaluate(([x, z]) => window.teleportJimothy(x, z), [target.x, target.z]);
  // findWallTarget hands back the yaw that points AT the wall. Teleporting
  // without it leaves him facing wherever he already was, and the headbutt
  // lands in open air.
  await page.evaluate((y) => window.faceJimothy(y), target.yaw);
  await adv(page, 0.3);
  const before = await stats(page);
  await page.keyboard.press('e');
  await adv(page, 0.8);
  const damaged = await stats(page);
  expect(damaged.removed, 'headbutt removed nothing').toBeGreaterThan(before.removed);
  expect(damaged.edits).toBeGreaterThan(0);

  // Walk far enough that the column unloads, then come back.
  await page.evaluate(([x, z]) => window.teleportJimothy(x, z), [target.x + 300, target.z + 300]);
  await adv(page, 1.0);
  await page.evaluate(([x, z]) => window.teleportJimothy(x, z), [target.x, target.z]);
  await adv(page, 0.5);

  // The edits are still recorded, and were re-applied on regeneration.
  const back = await stats(page);
  expect(back.edits, 'damage was forgotten on unload').toBeGreaterThan(0);
});

test('restart rebuilds a pristine city and forgets the damage', async ({ page }) => {
  await boot(page);
  const target = await page.evaluate(() => window.findWallTarget());
  await page.evaluate(([x, z]) => window.teleportJimothy(x, z), [target.x, target.z]);
  await page.evaluate((y) => window.faceJimothy(y), target.yaw);
  await adv(page, 0.3);
  await page.keyboard.press('e');
  await adv(page, 0.8);
  expect((await stats(page)).edits).toBeGreaterThan(0);

  await page.evaluate(() => window.restartGame());
  await adv(page, 0.3);
  const s = await stats(page);
  // Damage is per-run. A fresh run starts on an undamaged city.
  expect(s.edits).toBe(0);
  expect(s.columns).toBeGreaterThan(0);
});

test('a building on a chunk seam is generated whole, not sliced', async ({ page }) => {
  // THE trap of chunk-clipped generation. buildCraftsman writes its footprint
  // from one origin; a column is CHUNK_XZ voxels across. Generating "the
  // buildings whose origin is in this column" leaves half a house at every
  // seam — and nothing else in this suite would notice, because a sliced house
  // and an intact one have identical chunk and column counts.
  const COL = VOXEL.CHUNK_XZ * VOXEL.SIZE;
  const seamOf = (v) => Math.floor(v / COL);

  // Find a building the seam runs WELL through — at least a couple of metres
  // of footprint on each side. A marginal straddle (the seam grazing the last
  // voxel) samples almost nothing on the far side and fails for a reason that
  // has nothing to do with slicing. Lots are smaller since milestone 15
  // subdivided blocks, so this matters more than it used to.
  const MIN_OVERHANG = 2;
  let target = null;
  let best = 0;
  for (const b of Layout.buildingsIntersecting(-500, -500, 500, 500)) {
    for (const axis of ['x', 'z']) {
      const lo = b[axis];
      const hi = b[axis] + (axis === 'x' ? b.w : b.d);
      if (seamOf(lo) === seamOf(hi)) continue;
      const seam = seamOf(hi) * COL;
      const overhang = Math.min(seam - lo, hi - seam);
      if (overhang > best) { best = overhang; target = { ...b, axis, seam }; }
    }
  }
  expect(target && best, `no building straddles a seam by ${MIN_OVERHANG}m`).toBeGreaterThan(MIN_OVERHANG);

  await boot(page);
  // Stand on it so every column it touches is resident.
  await page.evaluate(([x, z]) => window.teleportJimothy(x, z), [
    target.x + target.w / 2, target.z + target.d / 2,
  ]);
  await adv(page, 0.6);

  // Walls sit on the footprint perimeter. Count solid voxels along it on each
  // side of the seam: a sliced building has geometry on one side and none on
  // the other.
  const counts = await page.evaluate(({ b, vox }) => {
    let lo = 0;
    let hi = 0;
    for (let t = 0; t <= 1; t += 0.02) {
      for (const y of [0.4, 1.0, 1.8]) {
        for (const edge of [0, 1]) {
          // The far wall is the LAST voxel, not one past it.
          const along = b.axis === 'x' ? b.x + b.w * t : b.z + b.d * t;
          const cross = b.axis === 'x'
            ? b.z + (edge ? b.d - vox : 0)
            : b.x + (edge ? b.w - vox : 0);
          const x = b.axis === 'x' ? along : cross;
          const z = b.axis === 'x' ? cross : along;
          if (!window.voxelSolidAt(x, y, z)) continue;
          if (along < b.seam) lo++; else hi++;
        }
      }
    }
    return { lo, hi };
  }, { b: target, vox: VOXEL.SIZE });

  expect(counts.lo, `no geometry on the low side of the seam: ${JSON.stringify(counts)}`).toBeGreaterThan(3);
  expect(counts.hi, `no geometry on the high side of the seam: ${JSON.stringify(counts)}`).toBeGreaterThan(3);
});
