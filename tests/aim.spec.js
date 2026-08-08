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

test('the aim is reported, and looking down turns the swing into a dig', async ({ page }) => {
  // `digs` used to be a threshold on this number and is now a question about
  // the world (playtest 2026-08-08), so the assertion moved with it: the aim is
  // still reported, but what matters is that the resting view does not dig and
  // a downward one does. Asserting `aim < DIG_ANGLE` only ever tested a
  // comparison against a constant that no longer exists.
  await standing(page);
  await page.evaluate(() => window.lookJimothy(0.7));
  await adv(page, 0.1);
  const rest = await state(page);
  expect(rest.jimothy.aim, 'no aim in the snapshot').toBeDefined();
  expect(rest.jimothy.aim).toBeCloseTo(0, 1); // neutral is exactly zero
  expect(rest.jimothy.digs, 'the resting view digs — every swing is a hole').toBe(false);

  await page.evaluate((d) => window.aimJimothy(d), CAMERA.PITCH_MAX);
  await adv(page, 0.1);
  const down = await state(page);
  expect(down.jimothy.aim).toBeGreaterThan(rest.jimothy.aim);
  expect(down.jimothy.digs, 'looking at the ground does not dig').toBe(true);
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

test('the reticle is aimed along the same ray the blast uses', async ({ page }) => {
  // A reticle that lies is worse than none, and the way it comes to lie is two
  // copies of the same arithmetic. Milestone 21 moved the marker onto the
  // SURFACE, so the two positions no longer coincide — what must still hold is
  // that they are the same ray at the same range, i.e. the reticle can never
  // point somewhere the blast does not go. Asserted as a bearing, not a point.
  // A digging aim on purpose: that branch uses a different standoff from a flat
  // swing, so it is the one where two copies of the arithmetic would diverge.
  await standing(page);
  await page.evaluate((d) => window.aimJimothy(d), CAMERA.PITCH_MAX);
  await adv(page, 0.2);

  const predicted = await page.evaluate(() => {
    const g = window.__game;
    const r = g.reticle;
    const p = g.jimothy.body.position;
    return {
      x: r.position.x, y: r.position.y, z: r.position.z, visible: r.visible,
      from: { x: p.x, y: p.y, z: p.z },
    };
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

  // Same bearing from him, within a couple of degrees.
  const bearing = (p) => Math.atan2(p.x - predicted.from.x, p.z - predicted.from.z);
  const dTheta = Math.abs(
    Math.atan2(Math.sin(bearing(hit) - bearing(predicted)), Math.cos(bearing(hit) - bearing(predicted))),
  );
  expect(dTheta, 'the reticle and the blast are on different rays').toBeLessThan(0.05);

  // …and the blast actually REACHES the surface the marker was sitting on.
  // That is the promise, and it is not "the two points coincide": the marker is
  // the contact point, while the sphere deliberately carries on past it so a
  // digging swing takes a bite rather than grazing. Containment is the check
  // that survives both branches.
  const radius = await page.evaluate(() => window.__game.blastRadius(1));
  const gap = Math.hypot(hit.x - predicted.x, hit.y - predicted.y, hit.z - predicted.z);
  expect(gap, `the blast landed ${gap.toFixed(2)} m from a marker it can only reach ${radius.toFixed(2)} m`)
    .toBeLessThan(radius);
});

test('looking left and right moves the aim — not just up and down (JIM-38)', async ({ page }) => {
  // Milestone 20 wired the pitch and never wired the yaw, so the reticle
  // followed his FACING, which only updates while he walks. Standing still and
  // looking around did nothing at all.
  await standing(page);
  const facing = 0.7; // what `standing` faced him at

  const bearings = [];
  for (const yaw of [facing, facing + Math.PI / 2, facing - Math.PI / 2]) {
    const b = await page.evaluate((y) => {
      window.lookJimothy(y);
      const g = window.__game;
      g.updateReticle();
      const r = g.reticle.position;
      const p = g.jimothy.body.position;
      return {
        visible: g.reticle.visible,
        bearing: Math.atan2(r.x - p.x, r.z - p.z),
        jimothyYaw: g.jimothy.yaw,
      };
    }, yaw);
    expect(b.visible, 'no reticle while the pointer is locked').toBe(true);
    bearings.push(b);
  }

  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  for (const [i, want] of [facing, facing + Math.PI / 2, facing - Math.PI / 2].entries()) {
    expect(
      Math.abs(wrap(bearings[i].bearing - want)),
      `looked at ${want.toFixed(2)}, reticle went to ${bearings[i].bearing.toFixed(2)}`,
    ).toBeLessThan(0.06);
  }
  // The body has NOT turned yet — that is the "snap on the swing" decision.
  expect(Math.abs(wrap(bearings[2].jimothyYaw - facing)), 'he turned while merely looking')
    .toBeLessThan(0.06);
});

test('the headbutt lands where you looked, and he turns to face it (JIM-38)', async ({ page }) => {
  await standing(page);
  const want = 0.7 - Math.PI / 2;
  await page.evaluate((y) => window.lookJimothy(y), want);
  await page.evaluate(() => {
    window.__lastBlast = null;
    window.__game.onBlast = (p) => { window.__lastBlast = { x: p.x, y: p.y, z: p.z }; };
  });
  const from = (await state(page)).jimothy;
  await page.keyboard.press('e');
  await adv(page, 1.0);

  const hit = await page.evaluate(() => window.__lastBlast);
  expect(hit, 'the headbutt never fired').toBeTruthy();
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const bearing = Math.atan2(hit.x - from.x, hit.z - from.z);
  expect(Math.abs(wrap(bearing - want)), 'the swing went where he was facing, not where you looked')
    .toBeLessThan(0.15);
  // …and he committed his body to it rather than headbutting sideways.
  expect(Math.abs(wrap((await state(page)).jimothy.yaw - want))).toBeLessThan(0.15);
});

test('the reticle lands ON the wall you point at, oriented to it (JIM-39)', async ({ page }) => {
  // The case the old fixed-range projection never touched: it hung in mid-air
  // at the blast standoff whatever was in front of you, and only looked right
  // pointing down because the ground happens to be about that far away.
  await boot(page);
  const wall = await page.evaluate(() => window.findWallTarget());
  expect(wall, 'no wall to stand at').toBeTruthy();
  await page.evaluate((w) => window.teleportJimothy(w.x, w.z), wall);
  await page.evaluate((w) => window.lookJimothy(w.yaw), wall);
  await adv(page, 0.2);

  const s = await state(page);
  expect(s.reticle.visible, 'no reticle while the pointer is locked').toBe(true);
  expect(s.reticle.onSurface, 'the reticle reported no surface while facing a wall').toBe(true);
  // findWallTarget stands him 2.6 m off, which is inside a headbutt's reach.
  expect(s.reticle.inReach, 'a wall 2.6 m away read as out of reach').toBe(true);

  const probe = await page.evaluate(() => {
    const g = window.__game;
    const p = g.reticle.position;
    // The torus's hole axis is its local +Z, so world-direction IS the surface
    // normal it was laid onto. Behind the marker along that axis must be solid
    // and in front of it must be air — a marker floating in the air fails both.
    const n = g.reticle.getWorldDirection(g.reticle.position.clone());
    return {
      behind: g.voxels.solidAtWorld(p.x - n.x * 0.3, p.y - n.y * 0.3, p.z - n.z * 0.3),
      infront: g.voxels.solidAtWorld(p.x + n.x * 0.3, p.y + n.y * 0.3, p.z + n.z * 0.3),
      normalY: +n.y.toFixed(2),
    };
  });
  expect(probe.behind, 'nothing solid behind the marker — it is floating').toBe(true);
  expect(probe.infront, 'the marker is buried inside the wall').toBe(false);
  // A wall's normal is horizontal. The old torus was pinned flat (normal +Y),
  // which is the whole reason it read as a floating ring rather than a decal.
  expect(Math.abs(probe.normalY), 'the reticle is still lying flat on a vertical wall')
    .toBeLessThan(0.35);
});

test('the reticle marks a miss when there is nothing in range (JIM-39)', async ({ page }) => {
  // The other half, and it is needed: "always on a surface" and "always a miss"
  // each pass one of these alone. What the marker promises is that IN REACH
  // means this swing connects — so a miss must remove nothing.
  await standing(page, { fat: 0 });
  await page.evaluate(() => window.lookJimothy(0.7));
  await page.evaluate(() => window.aimJimothy(0.05)); // up at the sky
  await adv(page, 0.2);

  const s = await state(page);
  expect(s.reticle.visible).toBe(true);
  expect(s.reticle.inReach, 'the reticle promised a hit while pointed at the sky').toBe(false);

  const before = await page.evaluate(() => window.__game.voxels.removedCount);
  await page.keyboard.press('e');
  await adv(page, 1.0);
  const after = await page.evaluate(() => window.__game.voxels.removedCount);
  expect(after - before, 'a swing the reticle called a miss still destroyed something').toBe(0);
});

test('the crater lands where the marker is, not at a fixed distance ahead', async ({ page }) => {
  // Chris, playtest 2026-08-08: *"it only works direct in front of you."* The
  // blast used to sit at a fixed standoff and never ask what was there, so
  // measured across a pitch sweep the marker moved between 0.49 m and 1.07 m
  // ahead while the crater stayed pinned at 1.87 m every single time.
  await standing(page, { fat: 60 });
  await page.evaluate(() => window.lookJimothy(0.7));

  const seen = [];
  for (const pitch of [CAMERA.PITCH_MAX, CAMERA.PITCH_MAX - 0.25, CAMERA.PITCH_MAX - 0.5]) {
    await page.evaluate((p) => window.teleportJimothy(p.x, p.z), SPOT);
    await page.evaluate(() => window.lookJimothy(0.7));
    await page.evaluate((d) => window.aimJimothy(d), pitch);
    await adv(page, 0.3);
    const marker = await page.evaluate(() => {
      const g = window.__game;
      const p = g.jimothy.body.position;
      return {
        d: Math.hypot(g.reticle.position.x - p.x, g.reticle.position.z - p.z),
        inReach: g.reticleHit.inReach,
      };
    });
    expect(marker.inReach, `nothing in reach at pitch ${pitch}`).toBe(true);

    await page.evaluate(() => {
      window.__b = null;
      window.__game.onBlast = (q) => { window.__b = { x: q.x, y: q.y, z: q.z }; };
    });
    const from = (await state(page)).jimothy;
    await page.keyboard.press('e');
    await adv(page, 1.0);
    const b = await page.evaluate(() => window.__b);
    expect(b, 'the headbutt never fired').toBeTruthy();
    seen.push({ marker: marker.d, blast: Math.hypot(b.x - from.x, b.z - from.z) });
  }

  // The crater tracks the marker instead of standing still. Asserted as a
  // RELATIONSHIP across three aims, because any single one can agree by
  // coincidence — the old fixed 1.87 m happened to be about right at one pitch.
  const markerSpread = Math.max(...seen.map((s) => s.marker)) - Math.min(...seen.map((s) => s.marker));
  const blastSpread = Math.max(...seen.map((s) => s.blast)) - Math.min(...seen.map((s) => s.blast));
  expect(markerSpread, 'the test never moved the marker, so it proves nothing')
    .toBeGreaterThan(0.3);
  expect(blastSpread, `marker moved ${markerSpread.toFixed(2)} m and the crater moved ${blastSpread.toFixed(2)} m`)
    .toBeGreaterThan(markerSpread * 0.5);
});

test('no hard lock: the marker and the swing never disagree about digging', async ({ page }) => {
  // The other half of the same playtest — *"it only works if you hard lock into
  // the ground."* The old gate needed 0.5 rad of an available 1.04 before
  // terrain became a target, while the marker was already reporting reachable
  // ground from 0.04. That gap IS the complaint, so the assertion is the gap
  // rather than a magic angle: **there must be no aim at which the reticle says
  // you can reach ground and the swing refuses to dig it.**
  //
  // Stated as a property because the honest answer is geometry, not a number.
  // Measured at this spot the ground slopes away, so a gentle tilt genuinely
  // does not reach it for 12 m — correctly no dig, and a spec asserting "0.25
  // rad must dig" would be asserting something the game should not promise.
  await standing(page, { fat: 60 });

  const samples = [];
  for (let pitch = CAMERA.PITCH_MIN; pitch <= CAMERA.PITCH_MAX + 1e-6; pitch += 0.08) {
    await page.evaluate(() => window.lookJimothy(0.7));
    await page.evaluate((d) => window.aimJimothy(d), pitch);
    await adv(page, 0.1);
    const s = await state(page);
    const onGround = await page.evaluate(() => {
      const g = window.__game;
      if (!g.reticleHit.onSurface) return false;
      const r = g.reticle.position;
      return r.y <= g.voxels.terrainHeightAt(r.x, r.z) + 0.6;
    });
    samples.push({ aim: s.jimothy.aim, inReach: s.reticle.inReach, onGround, digs: s.jimothy.digs });
  }

  const refused = samples.filter((s) => s.inReach && s.onGround && !s.digs);
  expect(refused.map((s) => s.aim), 'reachable ground the swing refuses to dig').toEqual([]);
  // Non-vacuous in both directions, or "never disagrees" passes on a game where
  // nothing ever digs and on one where everything always does.
  expect(samples.some((s) => s.digs), 'nothing dug anywhere in the sweep').toBe(true);
  expect(samples.some((s) => !s.digs), 'every aim digs — the road is not safe').toBe(true);

  // …and the shallowest digging aim is set by where the ground is, not by a
  // threshold: it must be the first aim that can reach ground at all.
  const firstReachable = samples.findIndex((s) => s.inReach && s.onGround);
  const firstDig = samples.findIndex((s) => s.digs);
  expect(firstReachable, 'the sweep never found reachable ground').toBeGreaterThanOrEqual(0);
  expect(firstDig, `ground reachable at aim ${samples[firstReachable]?.aim}, `
    + `first dig at ${samples[firstDig]?.aim}`).toBe(firstReachable);
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
