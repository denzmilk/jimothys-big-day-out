// Shared harness helpers for all gameplay specs. Everything drives the game
// through render_game_to_text / advanceTime — the first advanceTime call
// freezes wall-clock updates so simulated time is fully test-controlled.

export const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
export const adv = (page, s) => page.evaluate((secs) => window.advanceTime(secs), s);

export async function boot(page, { withRig = false } = {}) {
  // Manual time from frame zero: no real-time sim ever runs under test, so
  // physics settling is identical regardless of machine load. The heavy
  // Meshy rig loads only where a spec asks for it.
  await page.addInitScript((rig) => {
    window.__MANUAL_TIME__ = true;
    if (!rig) window.__SKIP_RIG__ = true;
  }, withRig);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await adv(page, 0.1);
}

export function nearestUntippedCan(s) {
  let best = null;
  let bd = Infinity;
  for (const c of s.cans) {
    if (c.tipped) continue;
    const d = Math.hypot(c.x - s.jimothy.x, c.z - s.jimothy.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// Nearest instantly-collectable snack — feasts need a stand-still channel, so
// generic "go eat something" seeks target scraps only.
export function nearestSnack(s) {
  let best = null;
  let bd = Infinity;
  for (const sn of s.snacks) {
    if (sn.type === 'feast') continue;
    const d = Math.hypot(sn.x - s.jimothy.x, sn.z - s.jimothy.z);
    if (d < bd) { bd = d; best = sn; }
  }
  return best;
}

// Controls are camera-relative, so steering toward a world target means
// decomposing the world delta into the camera frame: screen-forward is the
// camera→Jimothy bearing ψ, screen-right is ψ rotated -90°.
export function keysToward(s, target) {
  const dx = target.x - s.jimothy.x;
  const dz = target.z - s.jimothy.z;
  const psi = Math.atan2(s.jimothy.x - s.camera.x, s.jimothy.z - s.camera.z);
  const fwd = dx * Math.sin(psi) + dz * Math.cos(psi);
  const right = -dx * Math.cos(psi) + dz * Math.sin(psi);
  const keys = [];
  if (fwd > 0.15) keys.push('w'); else if (fwd < -0.15) keys.push('s');
  if (right > 0.15) keys.push('d'); else if (right < -0.15) keys.push('a');
  return keys;
}

// Crude greedy seek: hold keys toward the target, step sim, re-read. pick(s)
// returns the current target, or null once the goal condition is met.
export async function seek(page, pick, { maxIters = 80 } = {}) {
  for (let i = 0; i < maxIters; i++) {
    const s = await state(page);
    const target = pick(s);
    if (!target) return s;
    const keys = keysToward(s, target);
    if (!keys.length) return s;
    for (const k of keys) await page.keyboard.down(k);
    await adv(page, 0.25);
    for (const k of keys) await page.keyboard.up(k);
  }
  return state(page);
}

/** Warp Jimothy next to a world position, leaving the last couple of metres
 *  to be walked. The city is ~220 m across, so specs that walked from spawn
 *  spent their whole iteration budget commuting; teleporting close keeps the
 *  mechanic under test (the bonk, the pickup) without the cross-town trek. */
export async function warpNear(page, x, z, offset = 2.5) {
  await page.evaluate(([tx, tz]) => window.teleportJimothy(tx, tz), [x - offset, z - offset]);
  await adv(page, 0.3);
}

/** Tip containers until a feast has actually spilled, then park Jimothy on
 *  it. Not every container yields one — recycling tubs spill scraps only — so
 *  specs can't assume the first can tipped produces a feast. */
export async function warpToFeast(page, { maxCans = 6 } = {}) {
  for (let i = 0; i < maxCans; i++) {
    const s = await state(page);
    const feast = s.snacks.find((sn) => sn.type === 'feast');
    if (feast) {
      await page.evaluate(([x, z]) => window.teleportJimothy(x, z), [feast.x, feast.z]);
      await adv(page, 0.4); // settle: the channel needs him nearly still
      return feast;
    }
    await tipNearestCan(page);
  }
  return null;
}

export async function tipNearestCan(page) {
  const s = await state(page);
  const can = nearestUntippedCan(s);
  if (can) await warpNear(page, can.x, can.z);
  return seek(page, (st) => (st.cans.some((c) => c.tipped) ? null : nearestUntippedCan(st)));
}

// Seed persistent dev overrides before the page loads — the supported way for
// specs to reshape tuning (e.g. crank heat-per-can so one tip reaches tier 3).
export function seedTuning(page, tuning) {
  return page.addInitScript((t) => {
    const data = JSON.parse(localStorage.getItem('jimothy-dev') || '{}');
    data.tuning = { ...data.tuning, ...t };
    localStorage.setItem('jimothy-dev', JSON.stringify(data));
  }, tuning);
}
