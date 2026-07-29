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

export const tipNearestCan = (page) =>
  seek(page, (s) => (s.cans.some((c) => c.tipped) ? null : nearestUntippedCan(s)));

// Seed persistent dev overrides before the page loads — the supported way for
// specs to reshape tuning (e.g. crank heat-per-can so one tip reaches tier 3).
export function seedTuning(page, tuning) {
  return page.addInitScript((t) => {
    const data = JSON.parse(localStorage.getItem('jimothy-dev') || '{}');
    data.tuning = { ...data.tuning, ...t };
    localStorage.setItem('jimothy-dev', JSON.stringify(data));
  }, tuning);
}
