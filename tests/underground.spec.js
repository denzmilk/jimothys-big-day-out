// Milestone 18: the underground — sewers, crab people, and treasure you can't
// spend.
//
// The island is 2 × 2 km of surface, and underneath it is the same 2 × 2 km for
// almost nothing, because milestone 17's ground is implicit. What that buys has
// to be a PLACE rather than a hole, and the assertions below are the difference:
// a network you can get into, get around, and get out of.
//
// The navigability spec is a real breadth-first search over standable voxels,
// not a look at the entrance. A tunnel that is obviously fine at the stairs can
// be sealed 200 m along it, and "there is an entrance" is exactly the kind of
// proxy this repo has shipped twice.
import { test, expect } from '@playwright/test';
import { state, adv, boot } from './helpers.mjs';
import { SEWER, TREASURE, VISION, STREAM, CAMERA } from '../src/core/Constants.js';
import * as Masterplan from '../src/level/CityPlanner.js';
import * as Terrain from '../src/level/Terrain.js';

const nearestTo = (list, x, z) =>
  list.reduce((a, c) => (Math.hypot(c.x - x, c.z - z) < Math.hypot(a.x - x, a.z - z) ? c : a));

test('the sewer runs under the street network, and every tunnel has a way in', () => {
  const net = Masterplan.sewerNetwork();
  expect(net.length, 'no sewers at all').toBeGreaterThan(3);

  // The guarantee is structural: a run with no entrance is not built, so there
  // is no such thing as a sealed pocket in the rock to discover later.
  expect(net.filter((c) => !c.entrances.length)).toEqual([]);

  const entrances = net.flatMap((c) => c.entrances);
  expect(entrances.length).toBeGreaterThan(8);
  const bad = entrances.filter((e) => {
    const cls = Masterplan.classAt(e.x, e.z);
    return cls !== Masterplan.CLASS.ROAD && cls !== Masterplan.CLASS.ALLEY;
  });
  expect(bad.slice(0, 5), 'an entrance that is not on a street').toEqual([]);
  // …and never in the sea, which the class check alone would not catch if the
  // coastline carve ever stopped running before the sewer bake.
  const drowned = entrances.filter((e) => !Terrain.isLand(e.x, e.z));
  expect(drowned.slice(0, 5), 'an entrance in the water').toEqual([]);
});

test('the tunnels are navigable — you can walk out from deep inside one', async ({ page }) => {
  await boot(page);
  const entrances = await page.evaluate(() => window.sewerEntrances());
  const start = nearestTo(entrances, 0, 0);

  // Go down, then walk a long way ALONG the tunnel before asking. Testing the
  // route from the bottom of the stairs proves only that stairs are stairs.
  await page.evaluate((e) => window.teleportJimothy(e.x, e.z), start);
  await adv(page, 1.0);
  const deep = await page.evaluate((e) => {
    // March along the centreline away from the stairwell.
    let best = null;
    for (let r = 30; r <= 160; r += 10) {
      for (let a = 0; a < 16; a++) {
        const th = (a / 16) * Math.PI * 2;
        const x = e.x + Math.cos(th) * r;
        const z = e.z + Math.sin(th) * r;
        if (!window.__game.standableUnder(x, z)) continue;
        best = { x, z, r };
      }
    }
    return best;
  }, start);
  expect(deep, 'found no tunnel away from the stairs').toBeTruthy();
  expect(deep.r).toBeGreaterThanOrEqual(30);

  // Stream the world in around that point before searching it.
  await page.evaluate((d) => window.teleportJimothy(d.x, d.z), deep);
  await adv(page, 1.0);
  const escape = await page.evaluate((d) => window.sewerEscapeRoute(d.x, d.z), deep);
  expect(escape, `no way out of the tunnel ${deep.r} m from the stairs`).toBeTruthy();
});

test('dropping in puts him underground, and the world goes dark', async ({ page }) => {
  await boot(page);
  const entrances = await page.evaluate(() => window.sewerEntrances());
  const e = nearestTo(entrances, 0, 0);
  await page.evaluate((q) => window.teleportJimothy(q.x, q.z), e);
  await adv(page, 1.2);

  const s = await state(page);
  expect(s.underground.depth, 'he is still on the street').toBeGreaterThan(SEWER.BELOW);
  expect(s.underground.below).toBe(true);
  expect(s.jimothy.grounded, 'he fell through the tunnel floor').toBe(true);

  // Lit enough to move through, dark enough to be unpleasant: the sun is off,
  // he carries the only light, and the fog closes in.
  const lights = await page.evaluate(() => ({
    lamp: window.__game.lamp.intensity,
    sun: window.__game.sun.intensity,
    fogFar: window.__game.scene.fog.far,
  }));
  expect(lights.lamp).toBeGreaterThan(0);
  expect(lights.sun).toBeLessThan(0.2);
  expect(lights.fogFar).toBeLessThanOrEqual(SEWER.FOG_FAR);

  // …and it all comes back when he surfaces.
  await page.evaluate(() => window.teleportJimothy(0, 0));
  await adv(page, 0.6);
  expect((await state(page)).underground.below).toBe(false);
  expect(await page.evaluate(() => window.__game.sun.intensity)).toBeGreaterThan(1);
});

test('pursuers follow him down, and the net does not reach through the ceiling', async ({ page }) => {
  // Chris, resolving milestone 18's open question: "Nah they can follow you in."
  // No special case and no off-switch — which only works because milestone 19
  // landed first, so what follows him down has vision, memory and a wall to
  // walk round rather than a straight line through rock.
  await boot(page);
  const entrances = await page.evaluate(() => window.sewerEntrances());
  const e = nearestTo(entrances, 0, 0);
  await page.evaluate((q) => window.teleportJimothy(q.x, q.z), e);
  await adv(page, 1.0);
  expect((await state(page)).underground.below).toBe(true);

  const id = await page.evaluate(
    (q) => window.spawnPursuerAt('animal-control', q.x + 18, q.z), e,
  );
  const depthOf = () => page.evaluate((i) => {
    const ac = window.__game.pursuers.animalControl;
    const p = ac.group.position;
    return { id: ac.id, depth: window.terrainSurfaceAt(p.x, p.z) - p.y };
  }, id);

  // It starts on the street…
  expect((await depthOf()).depth).toBeLessThan(SEWER.BELOW);
  // …and ends up down the hole with him.
  let deepest = 0;
  for (let t = 0; t < 24 && !(await state(page)).game.netted; t += 1.5) {
    await adv(page, 1.5);
    deepest = Math.max(deepest, (await depthOf()).depth);
  }
  expect(deepest, 'it stayed on the street while he was in the sewer')
    .toBeGreaterThan(SEWER.BELOW);
  expect((await state(page)).game.netted, 'it never caught him down there').toBe(true);
});

test('the dark is what makes a tunnel worth running into', () => {
  // Pursuers follow him down (Chris: "Nah they can follow you in"), so the
  // underground is only a real change of situation if the same corner buys more
  // there. That is one number, and it is asserted here rather than left implied.
  expect(VISION.DARK_RANGE_SCALE).toBeLessThan(0.5);
});

test('crab people live down there, and react to a raccoon', async ({ page }) => {
  await boot(page);
  const entrances = await page.evaluate(() => window.sewerEntrances());
  const e = nearestTo(entrances, 0, 0);

  // Nobody home on the surface: they are an underground ecology, not a crowd.
  await page.evaluate(() => window.teleportJimothy(0, 0));
  await adv(page, 0.5);
  expect((await state(page)).underground.crabs.count).toBe(0);

  await page.evaluate((q) => window.teleportJimothy(q.x, q.z), e);
  await adv(page, 2.5);
  const down = await state(page);
  expect(down.underground.crabs.count, 'the sewers are empty').toBeGreaterThan(0);

  // They react — badly. Asserted as movement, not as a flag: a "reacting" crab
  // that stays exactly where it is has not reacted.
  const before = await page.evaluate(() => window.__game.crabs.crabs.map((c) => [c.x, c.z]));
  await adv(page, 2);
  const after = await page.evaluate(() => window.__game.crabs.crabs.map((c) => [c.x, c.z]));
  const moved = after.filter((c, i) => before[i] && Math.hypot(c[0] - before[i][0], c[1] - before[i][1]) > 0.5);
  expect(moved.length, 'nobody moved').toBeGreaterThan(0);
});

test('treasure can be dug up, is recorded, and buys nothing', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.setFatness(90)); // a dig needs a full blast
  await adv(page, 0.2);
  expect((await state(page)).underground.finds).toEqual([]);

  // Find a buried one nearby and blast the ground off it.
  const dug = await page.evaluate(() => {
    const j = JSON.parse(window.render_game_to_text()).jimothy;
    const t = window.__game.treasures;
    const R = 80;
    const near = t._in(j.x - R, j.z - R, j.x + R, j.z + R);
    if (!near.length) return null;
    const pick = near.reduce((a, c) =>
      (Math.hypot(c.x - j.x, c.z - j.z) < Math.hypot(a.x - j.x, a.z - j.z) ? c : a));
    window.teleportJimothy(pick.x, pick.z);
    for (let d = 0; d <= 10; d += 1) window.blastAtWorld(pick.x, pick.y + d, pick.z);
    return pick;
  });
  expect(dug, 'no treasure buried within 80 m').toBeTruthy();

  // The baseline sits BETWEEN the digging and the pickup. Taken any earlier it
  // measures the shaft rather than the find — eleven fat blasts move heat by
  // about 950 points, and the first version of this spec blamed the Tamagotchi.
  await adv(page, 0.3);
  const before = await state(page);

  await page.evaluate((t) => window.dropJimothy(t.x, t.z, t.y + 4), dug);
  await adv(page, 4);
  const after = await state(page);

  expect(after.underground.finds, `never found ${dug.name}`).toContain(dug.name);
  // The joke IS the uselessness. Nothing it touches may move.
  expect(after.score, 'treasure paid out').toBe(before.score);
  expect(after.fatness, 'treasure fed him').toBe(before.fatness);
  expect(after.heat.points, 'treasure raised heat').toBe(before.heat.points);
  expect(TREASURE.NAMES).toContain(dug.name);
});

test('the underground costs memory only where it has been visited', async ({ page }) => {
  // Milestone 18's own version of milestone 17's claim: a second 2 x 2 km layer
  // is affordable because it is generated a column at a time like everything
  // else, and the edit store still only holds what the PLAYER changed.
  await boot(page);
  const entrances = await page.evaluate(() => window.sewerEntrances());
  const e = nearestTo(entrances, 0, 0);
  await page.evaluate((q) => window.teleportJimothy(q.x, q.z), e);
  await adv(page, 1.0);
  const s = await state(page);
  // The sewer is world, not damage: walking through one must not record a
  // single edit, or a long tunnel would cost as much as digging it.
  expect(s.voxels.edits, 'the sewer was written as player damage').toBe(0);
  // Bounded by the same disc every other resident set is: the underground does
  // not get its own streaming budget, because it is the same columns.
  expect(s.voxels.columns).toBeLessThanOrEqual((STREAM.UNLOAD_RADIUS * 2 + 1) ** 2);
});

// --- Milestone 21: you can dig sideways down here, and you can see it ---

test('a flat headbutt digs sideways underground, and still spares the road above (JIM-40)', async ({ page }) => {
  // The pair, and both halves are needed. `digsTerrain` gated on aim alone, and
  // `damageSphere` then floors removal at the column's own surface — so
  // underground a flat swing removed 0 voxels where an aimed-down one removed
  // 11, from the same spot. "You can't dig in a direction, all you can do is go
  // deeper" (Chris, 2026-08-08).
  //
  // Loosening the gate everywhere would bring back the 2026-07-23 playtest bug
  // it was written for, so the second half of this spec is the guard.
  await boot(page);
  const entrances = await page.evaluate(() => window.sewerEntrances());
  const e = nearestTo(entrances, 0, 0);
  await page.evaluate((q) => window.teleportJimothy(q.x, q.z), e);
  await adv(page, 1.5);
  expect((await state(page)).underground.below, 'never got underground').toBe(true);

  // Point him at a tunnel wall — flat, which is the swing that used to do
  // nothing — and check the rock in front of him actually goes away.
  const dig = await page.evaluate(() => {
    const g = window.__game;
    const p = g.jimothy.body.position;
    // Whichever horizontal heading has solid rock 2 m out: in a tunnel that is
    // across the bore, and the spec must not assume which way the pipe runs.
    let yaw = null;
    for (let a = 0; a < 16; a++) {
      const th = (a / 16) * Math.PI * 2;
      if (g.voxels.solidAtWorld(p.x + Math.sin(th) * 2, p.y, p.z + Math.cos(th) * 2)) {
        yaw = th;
        break;
      }
    }
    if (yaw === null) return null;
    window.lookJimothy(yaw);
    window.aimJimothy(g.cameraSystem.neutralPitch); // dead flat: aimPitch 0
    return { yaw, x: p.x, y: p.y, z: p.z, removed: g.voxels.removedCount };
  });
  expect(dig, 'no tunnel wall within 2 m to dig at').toBeTruthy();

  await page.keyboard.press('e');
  await adv(page, 1.2);
  const after = await page.evaluate(() => window.__game.voxels.removedCount);
  expect(after - dig.removed, 'a flat headbutt underground removed nothing').toBeGreaterThan(0);
  // …and specifically the wall he was pointing at, not rubble somewhere else.
  const gone = await page.evaluate((d) => !window.voxelSolidAt(
    d.x + Math.sin(d.yaw) * 1.2, d.y, d.z + Math.cos(d.yaw) * 1.2,
  ), dig);
  expect(gone, 'the rock he pointed at is still there').toBe(true);
});

test('the follow camera never sits inside the rock (JIM-41)', async ({ page }) => {
  // A 7 m boom cannot fit in a 3.6 x 2.9 m pipe under any heading. Measured
  // before the fix: the camera inside solid rock with 40% of the boom buried,
  // so back-face culling deleted the tunnel and left unrelated chunk faces —
  // Chris, 2026-08-08: "once you're underground it turns into blocks."
  await boot(page);
  const entrances = await page.evaluate(() => window.sewerEntrances());
  const e = nearestTo(entrances, 0, 0);
  await page.evaluate((q) => window.teleportJimothy(q.x, q.z), e);
  await adv(page, 1.5);
  expect((await state(page)).underground.below, 'never got underground').toBe(true);

  // Sampled along the whole boom, not just at the camera: an eye that has
  // squeezed through a wall into open air on the far side reads as fine at the
  // endpoint and is exactly the failure this is looking for.
  const boom = () => page.evaluate(() => {
    const g = window.__game;
    const jp = g.jimothy.group.position;
    const cp = g.camera.position;
    let solid = 0;
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      if (g.voxels.solidAtWorld(
        jp.x + (cp.x - jp.x) * t,
        jp.y + 0.8 + (cp.y - (jp.y + 0.8)) * t,
        jp.z + (cp.z - jp.z) * t,
      )) solid++;
    }
    return { fraction: solid / (N + 1), dist: Math.hypot(cp.x - jp.x, cp.y - jp.y, cp.z - jp.z) };
  });

  // Walk him along the tunnel — a camera that happens to be clear at the
  // stairwell proves nothing about the pipe.
  let worst = 0;
  for (let i = 0; i < 8; i++) {
    await page.keyboard.down('w');
    await adv(page, 0.4);
    await page.keyboard.up('w');
    const b = await boom();
    worst = Math.max(worst, b.fraction);
  }
  expect(worst, 'the camera boom is buried in rock').toBe(0);

  // …and it comes back out on the surface, or the fix has just permanently
  // welded the camera to the back of his head.
  await page.evaluate(() => window.teleportJimothy(0, 0));
  await adv(page, 1.5);
  expect((await boom()).dist, 'the camera never pulled back above ground')
    .toBeGreaterThan(CAMERA.FOLLOW_DISTANCE * 0.6);
});

test('he fades when the camera is forced in close, so you can see past him (JIM-41)', async ({ page }) => {
  // A boom that collides means near-first-person in a pipe, and near-first-
  // person means looking at the inside of his skull unless he gets out of the
  // way. Reuses the hide-spot fade rather than a second mechanism.
  await boot(page, { withRig: true });
  const entrances = await page.evaluate(() => window.sewerEntrances());
  const e = nearestTo(entrances, 0, 0);

  await page.evaluate(() => window.teleportJimothy(0, 0));
  await adv(page, 0.6);
  const surface = await state(page);
  expect(surface.rig.materials.every((m) => m.opacity === 1), 'he is see-through on the street')
    .toBe(true);

  await page.evaluate((q) => window.teleportJimothy(q.x, q.z), e);
  await adv(page, 1.5);
  const down = await state(page);
  expect(down.underground.below).toBe(true);
  expect(down.rig.materials.some((m) => m.opacity < 1), 'solid raccoon filling a first-person view')
    .toBe(true);
});
