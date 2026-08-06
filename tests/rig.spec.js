// Milestone 06: runtime model split + procedural stretchy legs.
// Milestone 08: the body/move fix pass.
import { test, expect } from '@playwright/test';
import { state, adv, boot } from './helpers.mjs';

// Deliberately off-axis. Every one of these bugs is invisible at the spawn
// heading (facing world ±z) because that's where his local axes happen to line
// up with the world's — which is precisely how they shipped.
const OFF_AXIS_YAW = 1.0;

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
// Local +z is forward and local +x is right for a yaw-only rotation.
const heading = (yaw) => ({
  fwd: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) },
  right: { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) },
});

// Waiting on the 4.4 MB model under headless SwiftShader is slow, so only the
// material spec pays for it; the geometry specs run on the placeholder, which
// occupies the same slots.
const waitForRig = (page) => page.waitForFunction(
  () => JSON.parse(window.render_game_to_text()).rig.loaded,
  undefined,
  { timeout: 90_000 },
);

test('rig loads and splits', async ({ page }) => {
  await boot(page, { withRig: true });
  await waitForRig(page);
  const s = await state(page);
  // head + body + tail + four legs, pre-split at build time by
  // tools/prep_jimothy.py (was 3 when the split happened at runtime).
  expect(s.rig.pieces).toBe(7);
  expect(s.rig.placeholderHidden).toBe(true);
});

test('legs step while waddling', async ({ page }) => {
  await boot(page);
  const before = await state(page);
  expect(before.feet.length).toBe(4);
  await page.keyboard.down('w');
  await adv(page, 2);
  await page.keyboard.up('w');
  const after = await state(page);
  // Every foot must have stepped along with the body (planted feet would
  // lag infinitely; gliding feet would mean no gait at all)…
  for (let i = 0; i < 4; i++) {
    const moved = Math.hypot(after.feet[i].x - before.feet[i].x, after.feet[i].z - before.feet[i].z);
    expect(moved).toBeGreaterThan(3);
    // …and stay near the body like legs, not drift like props.
    const near = Math.hypot(after.feet[i].x - after.jimothy.x, after.feet[i].z - after.jimothy.z);
    expect(near).toBeLessThan(2.5);
  }
});

// --- Milestone 08 ---

test('roll tumbles forward, not sideways', async ({ page }) => {
  await boot(page);
  await page.evaluate((y) => window.faceJimothy(y), OFF_AXIS_YAW);
  await page.keyboard.press('c');
  // Quarter of the way through the tumble: well clear of upright, nowhere
  // near a full revolution, so the sign of the tilt is unambiguous.
  await adv(page, 0.19);

  const s = await state(page);
  expect(s.jimothy.move).toBe('roll');
  const { fwd, right } = heading(s.jimothy.yaw);
  const up = s.jimothy.up;
  // A forward tumble rotates about his own left-right axis, which leaves his
  // up vector in the vertical plane containing his heading. The barrel-roll
  // bug measured 0.73 on the right axis; the flop's deliberate lateral wobble
  // (MOVES.ROLL.WOBBLE) contributes under 0.1, so this cleanly separates the
  // two without forbidding the wonk.
  expect(Math.abs(dot(up, right))).toBeLessThan(0.25);
  expect(Math.abs(dot(up, fwd))).toBeGreaterThan(0.3);
});

test('headbutt leans forward at any heading', async ({ page }) => {
  await boot(page);
  await page.evaluate((y) => window.faceJimothy(y), OFF_AXIS_YAW);
  await page.keyboard.press('e');
  await adv(page, 0.1); // mid-windup: rearing back, so the lean is at its peak

  const s = await state(page);
  expect(s.jimothy.move).toBe('headbutt');
  const { right } = heading(s.jimothy.yaw);
  // Same root cause as the roll: the lean must not tip him onto his side.
  expect(Math.abs(dot(s.jimothy.up, right))).toBeLessThan(0.05);
});

test('parts stay attached as he fattens', async ({ page }) => {
  // Must load the real model: the placeholder body sits at an offset INSIDE
  // its slot, so slot-scaling moves it in step with every other anchor and the
  // defect can't reproduce. `_mount` moves each slot onto its piece, which is
  // what makes the body scale about a different centre from the anchors.
  await boot(page, { withRig: true });
  await waitForRig(page);
  await adv(page, 0.2);
  const lean = (await state(page)).jimothy.parts;
  await page.evaluate(() => window.setFatness(90));
  await adv(page, 0.5);
  const fat = (await state(page)).jimothy.parts;

  expect(fat.hips).toHaveLength(4);
  // q is each anchor's distance from the belly's centre in units of the
  // belly's own radius, so q ≤ 1 is "on or inside the body". Fattening scales
  // the belly; if the anchors scale with it, q barely moves. Drift here IS the
  // bug — pieces floating off a ballooning body.
  for (const key of ['head', 'tail']) {
    expect(fat[key]).toBeLessThan(1.25);
    expect(Math.abs(fat[key] - lean[key])).toBeLessThan(0.15);
  }
  for (let i = 0; i < 4; i++) {
    expect(fat.hips[i]).toBeLessThan(1.35);
    expect(Math.abs(fat.hips[i] - lean.hips[i])).toBeLessThan(0.15);
  }
});

test('roll plays a tuck-and-sprawl, not a rigid spin', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('c');

  const track = [];
  for (let i = 0; i < 18; i++) {
    await adv(page, 0.05);
    const s = await state(page);
    track.push({ t: +(i * 0.05).toFixed(2), tuck: s.jimothy.tuck, move: s.jimothy.move });
  }
  const during = track.filter((k) => k.move === 'roll');
  expect(during.length).toBeGreaterThan(4);
  // He gathers up: the tuck must actually reach the balled-up pose…
  expect(Math.max(...during.map((k) => k.tuck))).toBeGreaterThan(0.95);
  // …start from open…
  expect(during[0].tuck).toBeLessThan(0.7);
  // …and sprawl back out, rather than leaving him stuck in a ball.
  const after = track.filter((k) => k.move === null).pop();
  expect(after.tuck).toBe(0);
});

test('roll tumbles about his middle, not his toes', async ({ page }) => {
  // Needs the real model: the pivot is derived from whichever mesh is
  // currently the belly, and the placeholder sits at a different offset.
  await boot(page, { withRig: true });
  await waitForRig(page);
  await adv(page, 0.3);
  const rest = (await state(page)).jimothy;

  await page.keyboard.press('c');
  let lowestCentre = Infinity;
  let lowestBottom = Infinity;
  for (let i = 0; i < 18; i++) {
    await adv(page, 0.05);
    const s = await state(page);
    if (s.jimothy.move !== 'roll') break;
    lowestCentre = Math.min(lowestCentre, s.jimothy.bodyY);
    lowestBottom = Math.min(lowestBottom, s.jimothy.bodyBottom);
  }

  // Pivoting at the feet swings the belly down through grade — a quarter turn
  // puts its centre at ground level. Pivoting at his middle holds it.
  expect(lowestCentre).toBeGreaterThan(rest.bodyY * 0.6);
  // And no part of the belly should end up buried under the road.
  expect(lowestBottom).toBeGreaterThan(-0.35);
});

test('head stays attached through a headbutt', async ({ page }) => {
  await boot(page, { withRig: true });
  await waitForRig(page);
  await adv(page, 0.2);
  const rest = (await state(page)).jimothy.parts.head;

  await page.keyboard.press('e');
  // Sample across windup, lunge AND recover: the old animation yanked the head
  // 0.47 units forward on a 1.7-unit raccoon — a quarter of his body length —
  // which dragged the open neck seam into view (JIM-10).
  let worst = rest;
  for (let i = 0; i < 12; i++) {
    await adv(page, 0.05);
    worst = Math.max(worst, (await state(page)).jimothy.parts.head);
  }
  // The head must still visibly move, or this test would pass on a headbutt
  // that does nothing at all.
  expect(worst).toBeGreaterThan(rest);
  // Measured in body-radii, so this is "the head never leaves the neck by more
  // than a third of the belly's own half-depth". The old thrust scored ~0.9.
  expect(worst - rest).toBeLessThan(0.3);
});

test('jimothy is opaque unless hidden', async ({ page }) => {
  await boot(page, { withRig: true });
  await waitForRig(page);
  await adv(page, 0.2);

  let s = await state(page);
  expect(s.hidden).toBe(false);
  expect(s.rig.materials.length).toBeGreaterThan(0);
  for (const m of s.rig.materials) {
    expect(m.opacity).toBe(1);
    // Both matter. A GLB exported with alphaMode BLEND arrives with
    // depthWrite off, which renders him see-through at full opacity; and a
    // permanently-transparent material also mis-sorts his own pieces.
    expect(m.depthWrite).toBe(true);
    expect(m.transparent).toBe(false);
  }

  // The hide fade must still work — this is a state, not a removal.
  const spot = s.hideSpots[0];
  await page.evaluate(([x, z]) => window.teleportJimothy(x, z), [spot.x, spot.z]);
  await adv(page, 0.2);
  s = await state(page);
  expect(s.hidden).toBe(true);
  for (const m of s.rig.materials) expect(m.opacity).toBeLessThan(1);
});
