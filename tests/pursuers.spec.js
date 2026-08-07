// Milestone 19: pursuer AI — vision, memory and giving up.
//
// Chris, 2026-08-07: "they just make a beeline for you and never stop - no AI
// there at all." He was describing the code exactly: `_steer` took `jp` and
// walked at it through anything.
//
// The first spec below is the one that says this milestone happened at all.
// Everything else is a property of the state machine, and every one of them is
// asserted on OBSERVED BEHAVIOUR (did it move? where to?) rather than on a state
// string alone — a machine that reports "search" while walking at the player is
// exactly the proxy failure this repo keeps shipping.
//
// NOTE on placement. Every spec that needs a pursuer to SEE him has to find a
// sightline first: the city is procedural and irregular, so any fixed offset is
// behind a building somewhere. Writing "14 m to the north" and assuming open
// ground fails as a test-setup problem that looks exactly like a vision bug.
import { test, expect } from '@playwright/test';
import { state, adv, boot } from './helpers.mjs';
import { VISION, SEARCH, ANIMAL_CONTROL } from '../src/core/Constants.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** Find a pursuer by ID. Never by index: a blast raises heat, heat spawns
 *  paparazzi, and `pursuers[0]` quietly becomes somebody else mid-spec — which
 *  is how the noise spec first "failed" with a chasing photographer standing in
 *  for the animal controller it had spawned. */
const find = (s, id) => s.pursuers.find((p) => p.id === id);
const HOME = [40, 24];
const AWAY = [-300, -520]; // Bandit Bay, most of the island away

/** An offset at `d` metres from `to` with an unobstructed line of sight to it.
 *  Returns null if the spot is boxed in, which is a legitimate answer here. */
async function clearOffset(page, to, d) {
  return page.evaluate(([t, r]) => {
    for (let a = 0; a < 24; a++) {
      const th = (a / 24) * Math.PI * 2;
      const px = t.x + Math.cos(th) * r;
      const pz = t.z + Math.sin(th) * r;
      const eye = window.terrainSurfaceAt(px, pz) + 1.45;
      if (window.voxelLineOfSight(px, eye, pz, t.x, t.y + 0.5, t.z)) return { x: px, z: pz };
    }
    return null;
  }, [to, d]);
}

/** Jimothy at HOME with an animal controller `d` metres away that can see him. */
async function setupVisible(page, d = 14) {
  await boot(page);
  await page.evaluate((h) => window.teleportJimothy(h[0], h[1]), HOME);
  await adv(page, 0.3);
  const jim = (await state(page)).jimothy;
  const spot = await clearOffset(page, jim, d);
  expect(spot, `nowhere at ${d} m can see ${HOME}`).toBeTruthy();
  const i = await page.evaluate(
    (s) => window.spawnPursuerAt('animal-control', s.x, s.z),
    spot,
  );
  return { i, jim };
}

/** Step until cond holds, in slices, so a state transition isn't stepped over. */
async function advUntil(page, cond, maxSeconds = 20, slice = 0.4) {
  for (let t = 0; t < maxSeconds; t += slice) {
    const s = await state(page);
    if (cond(s)) return s;
    await adv(page, slice);
  }
  return state(page);
}

test('a pursuer that cannot see him does not walk straight at him', async ({ page }) => {
  // THE assertion that this milestone happened. Before it, a paparazzo on the
  // far side of the island knew precisely where Jimothy was at all times and
  // walked through buildings to reach him.
  await boot(page);
  await page.evaluate((h) => window.teleportJimothy(h[0], h[1]), HOME);
  await adv(page, 0.3);
  // Well beyond any sight range, so nothing it does can be an acquisition.
  const i = await page.evaluate(
    ([h, far]) => window.spawnPursuerAt('animal-control', h[0] + far, h[1]),
    [HOME, VISION.RANGE * 4],
  );

  // Gone, before it can arrive. What it has left is a stale briefing, which is
  // memory — and memory has to expire.
  await page.evaluate((a) => window.teleportJimothy(a[0], a[1]), AWAY);
  await advUntil(page, (s) => find(s, i)?.state === 'patrol', SEARCH.DURATION + 20);
  expect(find(await state(page), i).state, 'it never gave up').toBe('patrol');

  const before = await state(page);
  await adv(page, 8);
  const after = await state(page);
  const closed = dist(find(before, i), before.jimothy)
    - dist(find(after, i), after.jimothy);
  expect(find(after, i).sees, 'it can see him across the island').toBe(false);
  expect(find(after, i).state).not.toBe('chase');
  // Eight seconds of beeline at animal-control speed closes 40 m. Patrolling
  // wanders, so it may drift either way — it just cannot march.
  expect(closed, 'it beelined at a target it cannot see').toBeLessThan(12);
});

test('vision respects geometry, and blasting the wall open restores the sightline', async ({ page }) => {
  // Line of sight is a DDA march through the same voxel grid the world is made
  // of, so it respects buildings, rubble he just made, and tunnel walls for
  // free. Asserted through the wall and then through the hole in it — one
  // without the other proves nothing, because "always false" passes the first.
  await boot(page);
  const wall = await page.evaluate(() => window.findWallTarget(1.0, 3.0));
  expect(wall, 'no wall found').toBeTruthy();

  const probe = await page.evaluate((w) => {
    const ahead = 7;
    const ax = w.x;
    const az = w.z;
    const bx = w.x + Math.sin(w.yaw) * ahead;
    const bz = w.z + Math.cos(w.yaw) * ahead;
    const eye = (x, z) => window.terrainSurfaceAt(x, z) + 1.2;
    const before = window.voxelLineOfSight(ax, eye(ax, az), az, bx, eye(bx, bz), bz);
    // Blow the wall open, halfway between them.
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    window.setFatness(90);
    for (const dy of [0.6, 1.2, 1.8]) {
      window.blastAtWorld(mx, window.terrainSurfaceAt(mx, mz) + dy, mz);
    }
    const after = window.voxelLineOfSight(ax, eye(ax, az), az, bx, eye(bx, bz), bz);
    return { before, after };
  }, wall);

  expect(probe.before, 'saw straight through a building').toBe(false);
  expect(probe.after, 'blasting it open did not restore the sightline').toBe(true);
});

test('breaking line of sight starts a search at the LAST KNOWN position', async ({ page }) => {
  const { i } = await setupVisible(page);
  const seen = await advUntil(page, (s) => find(s, i)?.sees, 12);
  expect(find(seen, i).sees, 'never acquired him on a clear sightline').toBe(true);
  const seenAt = { x: seen.jimothy.x, z: seen.jimothy.z };

  // Gone. Not hidden — somewhere else entirely.
  await page.evaluate((a) => window.teleportJimothy(a[0], a[1]), AWAY);
  await adv(page, 1.2);
  const s = await state(page);

  expect(find(s, i).sees).toBe(false);
  expect(find(s, i).state).toBe('search');
  // It remembers where he WAS, and that is what it is casting around. Instant
  // re-acquisition would show up as a lastKnown that had followed him.
  expect(dist(find(s, i).lastKnown, seenAt), 'it tracked him through the city')
    .toBeLessThan(SEARCH.WANDER_RADIUS + 2);
  expect(dist(find(s, i).lastKnown, s.jimothy)).toBeGreaterThan(100);
});

test('a search gives up, and the pursuer goes back to patrolling', async ({ page }) => {
  const { i } = await setupVisible(page);
  await advUntil(page, (s) => find(s, i)?.sees, 12);
  await page.evaluate((a) => window.teleportJimothy(a[0], a[1]), AWAY);
  await adv(page, 1.0);
  expect(find(await state(page), i).state).toBe('search');

  await adv(page, SEARCH.DURATION * ANIMAL_CONTROL.SEARCH_SCALE + 2);
  expect(find(await state(page), i).state, 'it searched forever').toBe('patrol');
});

test('a bush works by not being seen, not by a flag', async ({ page }) => {
  // Hiding used to drain heat while the pursuer went on knowing exactly where
  // he was — the bush worked on the heat number, not on the pursuer. It is now
  // a vision modifier: it cuts sight range hard, so it works because they
  // cannot see you.
  await boot(page);
  const spot = await page.evaluate(() => JSON.parse(window.render_game_to_text()).hideSpots[0]);
  await page.evaluate((h) => window.teleportJimothy(h.x, h.z), spot);
  await adv(page, 0.4);
  const inBush = await state(page);
  expect(inBush.hidden, 'not actually in the bush').toBe(true);

  // A spot that can see the bush AND can see him three metres out of it, so the
  // only thing that changes between the two readings is the bush.
  const watcher = await clearOffset(page, inBush.jimothy, 14);
  expect(watcher, 'nowhere can see this bush').toBeTruthy();
  const i = await page.evaluate((w) => window.spawnPursuerAt('animal-control', w.x, w.z), watcher);
  await adv(page, 0.8);
  expect(find(await state(page), i).sees, 'the bush did not hide him').toBe(false);

  // Step out toward the watcher, same rough distance, plainly visible.
  const out = await page.evaluate(([j, w]) => {
    const k = 4 / Math.hypot(w.x - j.x, w.z - j.z);
    window.teleportJimothy(j.x + (w.x - j.x) * k, j.z + (w.z - j.z) * k);
  }, [inBush.jimothy, watcher]);
  await adv(page, 0.8);
  const s = await state(page);
  expect(s.hidden, 'still in the bush after stepping out').toBe(false);
  expect(find(s, i).sees, 'he is invisible even out of the bush').toBe(true);
  expect(out).toBeUndefined();
});

test('destruction pulls them toward the NOISE, not toward Jimothy', async ({ page }) => {
  // Demolition is loud, and that is what makes it a decision rather than free
  // chaos. Gives Events.WORLD_DEMOLISHED a second job.
  const { i } = await setupVisible(page, 24);
  // Out of the picture entirely, so nothing that follows can be sight.
  await page.evaluate((a) => window.teleportJimothy(a[0], a[1]), AWAY);
  await advUntil(page, (s) => find(s, i)?.state === 'patrol', SEARCH.DURATION + 20);

  const before = await state(page);
  const p0 = find(before, i);
  // Loud, 70 m from the pursuer and half the island from the raccoon.
  const noise = { x: p0.x + 50, z: p0.z + 50 };
  const removed = await page.evaluate((n) => {
    window.setFatness(90);
    return window.blastAtWorld(n.x, window.terrainSurfaceAt(n.x, n.z) + 1.2, n.z);
  }, noise);
  expect(removed, 'the blast destroyed nothing, so it made no noise').toBeGreaterThan(0);

  await adv(page, 3);
  const after = await state(page);
  expect(find(after, i).state).toBe('suspicious');
  // It went to the NOISE. He is 900 m away, so this cannot be him.
  expect(dist(find(after, i).lastKnown, noise), 'it investigated something else')
    .toBeLessThan(2);
  expect(dist(find(after, i), noise), 'it heard the noise and stayed put')
    .toBeLessThan(dist(p0, noise) - 4);
});

test('heat tier changes behaviour, not just head-count', async ({ page }) => {
  // Escalation should mean better eyes, not more of the same eyes.
  await boot(page);
  const ranges = await page.evaluate(
    (tiers) => tiers.map((t) => window.pursuerSightRange('animal-control', t)),
    [1, 3, 5],
  );
  expect(ranges[1]).toBeGreaterThan(ranges[0]);
  expect(ranges[2]).toBeGreaterThan(ranges[1]);
  // …and animal control commits harder than a photographer at the same tier.
  const [pap, ac] = await page.evaluate(
    () => [window.pursuerSightRange('paparazzo', 3), window.pursuerSightRange('animal-control', 3)],
  );
  expect(ac).toBeGreaterThan(pap);
  expect(ANIMAL_CONTROL.VISION_SCALE).toBeGreaterThan(1);
  expect(ANIMAL_CONTROL.SEARCH_SCALE).toBeGreaterThan(1);
});

test('pursuer state, sight and last-known-position are in the snapshot', async ({ page }) => {
  // Without this none of the above is assertable and the specs stay eyeball-only.
  const { i } = await setupVisible(page);
  await adv(page, 1);
  const p = find(await state(page), i);
  expect(p).toHaveProperty('state');
  expect(p).toHaveProperty('sees');
  expect(p).toHaveProperty('lastKnown');
  expect(['patrol', 'suspicious', 'chase', 'search']).toContain(p.state);
});
