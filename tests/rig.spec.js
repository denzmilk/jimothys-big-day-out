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

test('rig loads as one skinned animal', async ({ page }) => {
  await boot(page, { withRig: true });
  await waitForRig(page);
  const s = await state(page);
  // Was seven separate solids pre-split by tools/prep_jimothy.py. ADR-0004
  // replaced them with ONE mesh on a 12-joint armature (body, neck, head,
  // tail, and a hip+shin pair per leg) — a surface that stretches across a
  // joint instead of tearing at it (JIM-21).
  expect(s.rig.skinned).toBe(true);
  expect(s.rig.pieces).toBe(1);
  expect(s.rig.bones).toBe(12);
  expect(s.rig.placeholderHidden).toBe(true);
});

test('fatness grows the belly and nothing else', async ({ page }) => {
  // Chris 2026-08-07: "we leave the leg size and the head size and tail size
  // as default, the fatness just grows". Skinning blends head vertices onto
  // the body bone, so growing the belly inflates the WHOLE animal unless each
  // direct child is counter-scaled — and that loses the tiny-head-on-an-
  // enormous-body read the character is built on.
  await boot(page, { withRig: true });
  await waitForRig(page);
  await adv(page, 0.2);
  const lean = (await state(page)).rig.boneScales;
  const leanWidth=await page.evaluate(()=>{const b=window.__game.jimothy.rig.bellyBox();return b.max.x-b.min.x;});
  await page.evaluate(() => window.setFatness(90));
  await adv(page, 0.5);
  const s = await state(page);

  const fatWidth=await page.evaluate(()=>{const b=window.__game.jimothy.rig.bellyBox();return b.max.x-b.min.x;});
  // The Blender growth shape changes geometry; bone scale now stays 1 so
  // animation joints do not shear. Assert the visible belly instead.
  expect(fatWidth).toBeGreaterThan(leanWidth*1.3);
  // Held against each bone's own lean value, not against 1 — the root carries
  // a normalization scale (RIG.TARGET_LENGTH), so 1 is not the baseline and
  // asserting it would be asserting a coincidence.
  //
  // World scale, so a child corrected TWICE fails here rather than reading a
  // healthy 1 locally while rendering half-sized. `head` and the shins are
  // grandchildren and inherit the correction through `neck` and `leg_*`;
  // that they must not be corrected again is exactly what this catches.
  for (const bone of ['neck', 'head', 'tail', 'leg_FL', 'shin_FL', 'leg_RR', 'shin_RR']) {
    expect(s.rig.boneScales[bone]).toBeCloseTo(lean[bone], 2);
  }
  // And the hitbox follows the belly: a fat Jimothy is a bigger target, which
  // is the third fat trade-off and what makes the lasso (JIM-23) land.
  expect(s.jimothy.widthScale).toBeGreaterThan(1.3);
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

test('the grown surface carries unchanged head, tail and paw geometry',async({page})=>{
 await boot(page,{withRig:true});
 const sizes=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),j=window.__game.jimothy,r=j.rig,m=r.skinned,a=m.geometry.attributes,out=[];
  for(const fat of [0,90,250]){
   setFatness(fat);teleportJimothy(60,10);j.postUpdate(0);for(const n of Object.keys(r.bones))r.pose(n);j.group.updateMatrixWorld(true);m.skeleton.update();
   const inverse=new T.Matrix4().copy(j.group.matrixWorld).invert(),center=j.group.worldToLocal(r.bellyBox().getCenter(new T.Vector3())),parts={};
   for(const name of ['head','tail','shin_FL','shin_FR','shin_RL','shin_RR']){
    const bi=m.skeleton.bones.indexOf(r.bones[name]),box=new T.Box3(),p=new T.Vector3();
    for(let i=0;i<a.position.count;i++){let w=0;for(let k=0;k<4;k++)if(a.skinIndex.getComponent(i,k)===bi)w+=a.skinWeight.getComponent(i,k);if(w<.9)continue;m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld).applyMatrix4(inverse);box.expandByPoint(p);}
    parts[name]={size:box.getSize(new T.Vector3()).toArray(),distance:box.getCenter(new T.Vector3()).distanceTo(center)};
   }out.push({fat,radius:j.radius,parts});
  }return out;
 });
 for(const grown of sizes.slice(1))for(const [name,part] of Object.entries(grown.parts)){
  for(let i=0;i<3;i++)expect(part.size[i],`${name} at ${grown.fat}`).toBeCloseTo(sizes[0].parts[name].size[i],3);
  expect(part.distance).toBeGreaterThan(sizes[0].parts[name].distance+.1);
  expect(Math.abs(part.distance-grown.radius),`${name} surface at ${grown.fat}`).toBeLessThan(1.5);
 }
});

test('every animated bone actually moves', async ({ page }) => {
  // The port from slots to bones is the whole milestone, and its silent
  // failure mode is a bone that never budges — writing bone.rotation directly
  // destroys the bind pose and collapses the skeleton into a T-pose, which
  // reads as a broken export rather than as broken code. Nothing else here
  // would catch a limb that quietly stopped animating.
  await boot(page, { withRig: true });
  await waitForRig(page);

  const span = {};
  const sample = async () => {
    const p = (await state(page)).rig.parts;
    for (const [name, v] of Object.entries(p)) {
      const s = span[name] || (span[name] = { min: { ...v }, max: { ...v } });
      for (const ax of ['x', 'y', 'z']) {
        s.min[ax] = Math.min(s.min[ax], v[ax]);
        s.max[ax] = Math.max(s.max[ax], v[ax]);
      }
    }
  };

  await page.keyboard.down('w');
  for (let i = 0; i < 10; i++) { await adv(page, 0.06); await sample(); }
  await page.keyboard.up('w');
  await page.keyboard.press('e'); // headbutt: the only thing that pitches the head hard
  for (let i = 0; i < 10; i++) { await adv(page, 0.05); await sample(); }

  const travel = (n) => Math.max(...['x', 'y', 'z'].map((ax) => span[n].max[ax] - span[n].min[ax]));
  // Head bob and headbutt pitch, tail wiggle, and a swing on every leg — the
  // four animations AC "still animate" names. Thresholds are deliberately
  // loose: this asks "did it move at all", not "did it move nicely", which is
  // a playtest question.
  for (const part of ['head', 'tail', 'shin_FL', 'shin_FR', 'shin_RL', 'shin_RR']) {
    expect(travel(part), `${part} never moved`).toBeGreaterThan(0.01);
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

test('the headbutt drives the head from the neck, and returns it', async ({ page }) => {
  await boot(page, { withRig: true });
  await waitForRig(page);
  await adv(page, 0.2);
  const rest = (await state(page)).rig.parts.head;

  // Sample across windup, lunge AND recover. On the split path the head was a
  // separate solid translated 0.47 units forward on a 1.7-unit raccoon, which
  // dragged the open neck seam into view; JIM-18 capped the thrust to hide it.
  // Here the head is carried by a bone rotation and the neck skin stretches to
  // follow, so the check is no longer "the head barely moved" — it is that the
  // move happens and fully unwinds, leaving no drift behind.
  await page.keyboard.press('e');
  let worst = 0;
  for (let i = 0; i < 12; i++) {
    await adv(page, 0.05);
    const p = (await state(page)).rig.parts.head;
    worst = Math.max(worst, Math.hypot(p.x - rest.x, p.y - rest.y, p.z - rest.z));
  }
  expect(worst).toBeGreaterThan(0.05);

  await adv(page, 1.5); // well past RECOVER
  const after = (await state(page)).rig.parts.head;
  // A pose composed onto a stale quaternion instead of the captured bind one
  // drifts a little further every headbutt; this is what catches that.
  expect(Math.hypot(after.x - rest.x, after.y - rest.y, after.z - rest.z)).toBeLessThan(0.05);
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
