// Milestone 17: the island — a coastline, hills, and ground with depth.
//
// Two method notes, both earned the hard way in this repo:
//
//  1. The shape assertions are written against the PLAN, not against the bake.
//     "The coast is where islandPlan says it is" is checkable; "the coast looks
//     nice" is a playtest, and is left to one.
//  2. The layout suite has twice shipped a spec that measured a proxy and
//     passed while the thing it guarded failed (the variety spec; the
//     props-on-roads spec). So nothing here asserts a count where it can assert
//     the property: "diggable to 20 m" digs, and then measures the hole.
import { test, expect } from '@playwright/test';
import { state, adv, boot, seedTuning } from './helpers.mjs';
import { TERRAIN, PLAYER_CONFIG, VOXEL } from '../src/core/Constants.js';
import * as Terrain from '../src/level/Terrain.js';
import * as Masterplan from '../src/level/CityPlanner.js';

const plan = Terrain.plan;
const district = (id) => plan.districts.find((d) => d.id === id);
const hill = (id) => plan.hills.find((h) => h.id === id);

/** Points on a regular grid inside a polygon. Sampling the polygon rather than
 *  its bounding box matters for districts like Mangy Point, whose box is mostly
 *  the sea it sticks out into. */
function samplesIn(polygon, step = 12) {
  const xs = polygon.map(([x]) => x);
  const zs = polygon.map(([, z]) => z);
  const out = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) {
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += step) {
      if (pointIn(x, z, polygon)) out.push([x, z]);
    }
  }
  return out;
}

function pointIn(x, z, poly) {
  let hit = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [xa, za] = poly[a];
    const [xb, zb] = poly[b];
    if ((za > z) !== (zb > z) && x < ((xb - xa) * (z - za)) / (zb - za) + xa) hit = !hit;
  }
  return hit;
}

// --- the shape ---------------------------------------------------------------

test('the island silhouette matches the plan', () => {
  // Inside the coast and outside every water body is land; outside the coast is
  // sea. Asserted against the authored polygons, so redrawing the coastline
  // moves this test with it rather than breaking it.
  const wet = [];
  for (const [x, z] of samplesIn(plan.coast, 25)) {
    const inWater = plan.water.some((w) => pointIn(x, z, w.polygon));
    if (inWater || Terrain.isDeck(x, z)) continue;
    if (!Terrain.isLand(x, z)) wet.push([x, z]);
  }
  // A band at the waterline is the beach, not a failure: the shore ramps
  // through sea level over SHORE_RUN by design. Anything further in is a hole
  // in the island.
  const inland = wet.filter(([x, z]) => Terrain.shoreDistance(x, z) > TERRAIN.SHORE_RUN);
  expect(inland.slice(0, 5), 'dry land in the plan came out as sea').toEqual([]);

  const dry = [];
  for (const w of plan.water) {
    for (const [x, z] of samplesIn(w.polygon, 25)) {
      if (Terrain.isDeck(x, z)) continue; // bridges are meant to be above water
      if (Terrain.isLand(x, z)) dry.push(`${w.id} ${Math.round(x)},${Math.round(z)}`);
    }
  }
  expect(dry.slice(0, 5), 'a lake or canal came out as land').toEqual([]);

  // …and the sea really is out there, not just an edge case at the border.
  expect(Terrain.isLand(0, -1400)).toBe(false);
  expect(Terrain.surfaceHeight(950, 0)).toBeLessThan(0);
});

test('the coast is mostly beach, and every bluff belongs to a hill', () => {
  // The AC says walking off the edge means WATER, not an invisible wall. Two
  // separate claims, and only asserting the first is how you end up flattening
  // the island to satisfy a test:
  //
  //   - most of the coastline is a beach you can walk down and back up;
  //   - the exceptions are BLUFFS, and every one of them is a hill the plan put
  //     on the waterfront. Magnolia and Queen Anne are exactly that in real
  //     life. A bluff is not an invisible wall — the sea is still at the bottom
  //     of it — but it is not a beach either, and pretending otherwise would
  //     mean fading every coastal summit away.
  const steps = [];
  for (const [x, z] of samplesIn(plan.coast, 40)) {
    const d = Terrain.shoreDistance(x, z);
    if (Math.abs(d) > TERRAIN.SHORE_RUN) continue;
    for (const [dx, dz] of [[TERRAIN.CELL, 0], [0, TERRAIN.CELL]]) {
      // A bridge deck is deliberately 7 m above the water it crosses, so its
      // edge is a drop by design — it is a bridge, not a beach.
      if (Terrain.isDeck(x, z) || Terrain.isDeck(x + dx, z + dz)) continue;
      steps.push({
        x,
        z,
        rise: Math.abs(Terrain.surfaceHeight(x + dx, z + dz) - Terrain.surfaceHeight(x, z)),
      });
    }
  }
  expect(steps.length).toBeGreaterThan(50);

  const bluffs = steps.filter((s) => s.rise >= PLAYER_CONFIG.CLIMB_HEIGHT);
  const walkable = 1 - bluffs.length / steps.length;
  expect(walkable, `only ${(walkable * 100).toFixed(0)}% of the shore is walkable`)
    .toBeGreaterThan(0.7);

  const unexplained = bluffs.filter(
    (s) => !plan.hills.some((h) => Math.hypot(s.x - h.at[0], s.z - h.at[1]) < h.radius),
  );
  expect(
    unexplained.slice(0, 5).map((s) => `${Math.round(s.x)},${Math.round(s.z)} rises ${s.rise.toFixed(1)}`),
    'a sea cliff with no hill behind it',
  ).toEqual([]);
});

test('every hill has a walkable way up', () => {
  // Chris: "enough to be fun, if jimothy rides a shopping cart you want to be
  // able to do a jump." A hill he cannot walk up is neither.
  //
  // Radials from each summit, because that is where a hill is steepest — a grid
  // sample averages the slope away and passes on a hill with a sheer face.
  //
  // The claim is that a walkable route EXISTS, not that every approach is one.
  // Several summits sit within 40 m of the water, so their seaward face is a
  // bluff — which is what Magnolia and Queen Anne actually are, and is fine as
  // long as you can get up the other side. Asserting every radial instead
  // forced the fix that flattened the island's landmark climb to 8 m.
  const report = [];
  for (const h of plan.hills) {
    let walkable = 0;
    for (let a = 0; a < 24; a++) {
      const th = (a / 24) * Math.PI * 2;
      let ok = true;
      for (let r = 0; r < h.radius && ok; r += TERRAIN.CELL) {
        const at = (t) => [h.at[0] + Math.cos(th) * t, h.at[1] + Math.sin(th) * t];
        const p = at(r);
        const q = at(r + TERRAIN.CELL);
        // Bridge decks stand clear of what they cross on purpose, and the sea
        // is not an approach.
        if (Terrain.isDeck(...p) || Terrain.isDeck(...q)) continue;
        if (!Terrain.isLand(...p) || !Terrain.isLand(...q)) continue;
        const step = Math.abs(Terrain.surfaceHeight(...q) - Terrain.surfaceHeight(...p));
        if (step >= PLAYER_CONFIG.CLIMB_HEIGHT) ok = false;
      }
      if (ok) walkable++;
    }
    report.push({ id: h.id, walkable });
  }
  // A third of the compass. Below that a hill is a plateau you have to hunt for
  // a way onto, which is not what "walkable and readable from the ground" means.
  const fails = report.filter((r) => r.walkable < 8);
  expect(fails, `walkable approaches per hill (of 24): ${JSON.stringify(report)}`).toEqual([]);
});

test('Trash Panda Heights is a genuine climb and downtown is flat', () => {
  // The two halves of the same decision: hills carry the drama, and the
  // districts built on fill stay calm underfoot (Trashattan and SoTrash are
  // flat exactly as the real downtown and port are).
  const tph = hill('trash-panda-heights');
  const summit = Terrain.surfaceHeight(tph.at[0], tph.at[1]);
  const foot = Terrain.surfaceHeight(tph.at[0] + tph.radius * 0.95, tph.at[1]);
  expect(summit - foot, 'Trash Panda Heights is not a climb').toBeGreaterThan(25);

  for (const id of TERRAIN.FLAT_DISTRICTS) {
    const hs = samplesIn(district(id).polygon, 10)
      .map(([x, z]) => Terrain.surfaceHeight(x, z))
      .filter((h) => h > 0); // the waterfront edge is sea, not the district
    expect(hs.length, `no dry samples in ${id}`).toBeGreaterThan(20);
    const range = Math.max(...hs) - Math.min(...hs);
    expect(range, `${id} is not flat: ${range.toFixed(1)} m of relief`).toBeLessThan(4);
  }
});

test('districts are placed per the plan, and the city stays off the water', () => {
  // Every named district exists on the ground, under its own name.
  const missing = [];
  for (const d of plan.districts) {
    const hits = samplesIn(d.polygon, 20)
      .filter(([x, z]) => Masterplan.districtNameAtWorld(x, z) === d.id);
    if (hits.length < 5) missing.push(`${d.id}: ${hits.length}`);
  }
  expect(missing, 'districts that barely exist on the ground').toEqual([]);

  // …and nothing the city planted ended up in the sea. This is the assertion
  // the coastline carve exists for.
  const drowned = Masterplan.allBuildings().filter((b) => {
    const x = b.x + b.w / 2;
    const z = b.z + b.d / 2;
    return Masterplan.classAt(x, z) === Masterplan.CLASS.WATER
      || Terrain.surfaceHeight(x, z) < TERRAIN.SEA_LEVEL;
  });
  expect(drowned.length, `${drowned.length} buildings in the water`).toBe(0);
});

test('the terrain is deterministic and order-independent', () => {
  // Streaming generates columns in whatever order the player walks, so a height
  // field that depended on visit order would rearrange the island underfoot.
  const sample = () => {
    let s = '';
    for (let n = 0; n < 500; n++) {
      s += Terrain.surfaceHeight((n * 37) % 900 - 450, (n * 61) % 900 - 450).toFixed(3);
    }
    return s;
  };
  const a = sample();
  Terrain.bake(); // idempotent
  expect(sample()).toBe(a);
});

// --- the depth ---------------------------------------------------------------

test('strata change on the way down', () => {
  // "Different dig resistance and colour per layer, so a tunnel reads as going
  // SOMEWHERE." A single material all the way down is a hole, not a journey.
  const [x, z] = [0, 0];
  const top = Terrain.topSolidVoxelY(x, z);
  const seen = [];
  for (let d = 0; d < TERRAIN.DEPTH; d += 0.5) {
    const m = Terrain.materialAtVoxel(
      Math.floor(x / VOXEL.SIZE), top - Math.round(d / VOXEL.SIZE), Math.floor(z / VOXEL.SIZE),
    );
    if (m !== seen[seen.length - 1]) seen.push(m);
  }
  expect(new Set(seen).size, `materials down the column: ${seen}`).toBeGreaterThanOrEqual(4);
  expect(seen[0], 'the surface is not topsoil').not.toBe(VOXEL.BEDROCK);
  // …and the floor really is a floor.
  const belowFloor = Terrain.materialAtVoxel(
    0, top - Math.ceil((TERRAIN.DEPTH + 2) / VOXEL.SIZE), 0,
  );
  expect(belowFloor).toBe(VOXEL.BEDROCK);
});

test('the ground digs to 20 m and the hole is still there afterwards', async ({ page }) => {
  await boot(page);
  const spot = { x: 40, z: 24 };
  await page.evaluate((s) => window.teleportJimothy(s.x, s.z), spot);
  await page.evaluate(() => window.setFatness(90)); // full blast radius
  await adv(page, 0.3);

  const dug = await page.evaluate((s) => {
    const surface = window.terrainSurfaceAt(s.x, s.z);
    // Read the WHOLE column before touching any of it. Sampling inside the dig
    // loop reads the previous blast's crater — a fat blast is ~5 m across, so
    // every sample after the first came back as air and "the strata change"
    // failed for a reason that had nothing to do with strata.
    const mats = [];
    for (let d = 0.4; d <= 22; d += 1.2) mats.push(window.materialAtWorld(s.x, surface - d, s.z));
    for (let d = 0; d <= 22; d += 1.2) window.blastAtWorld(s.x, surface - d, s.z);
    return { surface, mats, floor: window.groundHeightAtWorld(s.x, s.z) };
  }, spot);

  expect(dug.surface - dug.floor, 'the shaft is not 20 m deep').toBeGreaterThanOrEqual(20);
  // Not one substance all the way down — the AC's "visible strata changes",
  // asserted on what the dig actually passed through.
  expect(new Set(dug.mats.filter(Boolean)).size).toBeGreaterThanOrEqual(3);

  // …and it survives the column being unloaded and regenerated. Milestone 12's
  // guarantee, now over a height field and 20 m below the stored skin — where
  // the walls of the hole are implicit and have to be re-exposed on replay.
  await page.evaluate((s) => window.teleportJimothy(s.x + 400, s.z + 400), spot);
  await adv(page, 1.2);
  await page.evaluate((s) => window.teleportJimothy(s.x, s.z), spot);
  await adv(page, 0.6);
  const after = await page.evaluate(
    (s) => ({ floor: window.groundHeightAtWorld(s.x, s.z), solid: window.voxelSolidAt(s.x, s.z, s.z) }),
    spot,
  );
  expect(after.floor, 'the hole healed itself').toBeLessThanOrEqual(dug.floor + VOXEL.SIZE);
  expect((await state(page)).voxels.edits).toBeGreaterThan(0);
});

test('boot cost and memory do not move with terrain depth', async ({ page, browser }) => {
  // THE assertion the implicit-ground design exists for. Built eagerly, 20 m at
  // VOXEL.SIZE 0.55 is ~36 layers of ground voxels against the old 2 — an 18x
  // rise that would undo milestone 12's boot-flat result. Built implicitly,
  // 20 m and 200 m are the same world with a deeper number in it.
  const measure = async (depth) => {
    const p = await browser.newPage();
    await seedTuning(p, { TERRAIN: { DEPTH: depth } });
    await p.addInitScript(() => {
      window.__MANUAL_TIME__ = true;
      window.__SKIP_RIG__ = true;
      window.__T0__ = performance.now();
    });
    await p.goto('/');
    await p.waitForFunction(() => typeof window.render_game_to_text === 'function');
    const out = await p.evaluate(() => ({
      ms: performance.now() - window.__T0__,
      stored: window.storedVoxelCount(),
      chunks: JSON.parse(window.render_game_to_text()).voxels.chunks,
      depth: window.__game.voxels.terrain ? null : null,
    }));
    await p.close();
    return out;
  };

  const shallow = await measure(20);
  const deep = await measure(200);
  const detail = `20 m: ${JSON.stringify(shallow)}  200 m: ${JSON.stringify(deep)}`;

  // Exact, not approximate: the stored world is the SAME world. A single voxel
  // of difference would mean depth had leaked into what gets materialised.
  expect(deep.stored, detail).toBe(shallow.stored);
  expect(deep.chunks, detail).toBe(shallow.chunks);
  // Boot is wall-clock and therefore noisy; a 10x depth showing up as anything
  // under a 40% swing is comfortably "flat", against the 18x it would cost if
  // the depth were built.
  expect(deep.ms, detail).toBeLessThan(shallow.ms * 1.4);
});
