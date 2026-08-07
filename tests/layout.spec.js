// Milestone 16: the city is an authored plan, not a generated lattice.
//
// The specs this replaces asserted the lattice — "buildings never sit on a
// road" against a modulo road mask, "a block subdivides into lots" against a
// uniform grid. They all passed while the world read as a grid, because they
// measured the generator's own rules back at it.
//
// Two method failures are worth naming, since both shipped:
//   - the variety spec asserted "6 distinct type strings exist", passed, and
//     the world still looked like three buildings. It measured the proxy.
//   - the safety spec checked buildings and never props, so 586 of 586 bins
//     shipped in the middle of the road past a test called "nothing overlaps a
//     road".
// What follows asserts STRUCTURE — variance, irregularity, semantics — and
// leaves "does it read as a place" explicitly to the playtest.
import { test, expect } from '@playwright/test';
import * as Layout from '../src/level/Layout.js';
import * as Masterplan from '../src/level/CityPlanner.js';
import { STREAM, VOXEL } from '../src/core/Constants.js';

test('the road network comes from the plan, not from arithmetic', () => {
  Masterplan.bake();
  // A modulo lattice repeats exactly. Two parallel lines far apart are
  // identical under `vx mod BLOCK < ROAD`, and must not be here.
  const line = (z) => {
    let s = '';
    for (let x = -400; x < 400; x += 4) s += Masterplan.isRoad(x, z) ? '#' : '.';
    return s;
  };
  expect(line(-120)).not.toBe(line(120));
  expect(line(0)).not.toBe(line(240));
});

test('blocks vary in size — a lattice has zero variance', () => {
  const areas = Masterplan.allBlocks().map((b) => b.area).filter((a) => a > 200);
  expect(areas.length).toBeGreaterThan(100);
  const mean = areas.reduce((a, b) => a + b, 0) / areas.length;
  const sd = Math.sqrt(areas.reduce((a, b) => a + (b - mean) ** 2, 0) / areas.length);
  // Measured ~2700 on the authored plan. A uniform grid scores 0 by
  // definition, so this is the assertion that the grid collision is real.
  expect(sd).toBeGreaterThan(800);
  expect(Math.max(...areas) / Math.min(...areas)).toBeGreaterThan(8);
});

test('several grids meet at different angles', () => {
  // The mechanism behind the variance above, asserted directly so a future
  // change that flattens the plan back to one grid fails loudly.
  const angles = new Set(Masterplan.regions.map((r) => r.angle));
  expect(angles.size).toBeGreaterThanOrEqual(4);
  expect(Masterplan.regionCount()).toBeGreaterThanOrEqual(5);
});

test('alleys exist and are a small part of the network', () => {
  Masterplan.bake();
  let alley = 0;
  let road = 0;
  for (let x = -900; x < 900; x += 3) {
    for (let z = -900; z < 900; z += 3) {
      const c = Masterplan.classAt(x, z);
      if (c === Masterplan.CLASS.ALLEY) alley++;
      else if (c === Masterplan.CLASS.ROAD) road++;
    }
  }
  expect(alley, 'no alleys at all').toBeGreaterThan(200);
  expect(alley).toBeLessThan(road); // back-of-house, not the main network
});

test('SAFE: no building stands on a road, an alley or a park', () => {
  const bad = [];
  for (const b of Masterplan.allBuildings()) {
    for (const [x, z] of [[b.x, b.z], [b.x + b.w, b.z], [b.x, b.z + b.d],
      [b.x + b.w, b.z + b.d], [b.x + b.w / 2, b.z + b.d / 2]]) {
      if (Masterplan.classAt(x, z) !== Masterplan.CLASS.LAND) {
        bad.push(`${b.type} at ${Math.round(b.x)},${Math.round(b.z)}`);
        break;
      }
    }
  }
  expect(bad.slice(0, 5)).toEqual([]);
});

test('SAFE: no two buildings overlap', () => {
  const bucket = new Map();
  for (const b of Masterplan.allBuildings()) {
    const k = `${Math.floor(b.x / 64)},${Math.floor(b.z / 64)}`;
    if (!bucket.has(k)) bucket.set(k, []);
    bucket.get(k).push(b);
  }
  const hits = [];
  for (const [k, list] of bucket) {
    const [i, j] = k.split(',').map(Number);
    const near = [];
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) near.push(...(bucket.get(`${i + di},${j + dj}`) || []));
    }
    for (const A of list) {
      for (const B of near) {
        if (A === B) continue;
        if (A.x < B.x + B.w && B.x < A.x + A.w && A.z < B.z + B.d && B.z < A.z + A.d) {
          hits.push(`${A.type}@${Math.round(A.x)},${Math.round(A.z)} overlaps ${B.type}`);
        }
      }
    }
  }
  expect(hits.slice(0, 5)).toEqual([]);
});

test('SAFE: bins are never in the carriageway', () => {
  // The assertion whose absence let 586 of 586 bins ship in the road.
  const props = Layout.propsIn(-500, -500, 500, 500);
  expect(props.length, 'no containers at all').toBeGreaterThan(100);
  const inRoad = props
    .filter((p) => Masterplan.classAt(p.x, p.z) === Masterplan.CLASS.ROAD)
    .map((p) => p.id);
  expect(inRoad.slice(0, 5)).toEqual([]);
});

test('bins are placed for a reason — many of them are in alleys', () => {
  // Placement is semantic now: a bin is behind a shop, not at a hash-chosen
  // point on a lattice. Alleys are ~1% of the world, so a large share landing
  // in them is only possible if placement actually follows the plan.
  const props = Layout.propsIn(-400, -400, 400, 400);
  const inAlley = props.filter((p) => Masterplan.isAlley(p.x, p.z)).length;
  expect(inAlley / props.length).toBeGreaterThan(0.25);
});

test('EVERY district is furnished, not just the ones with alleys', () => {
  // The regression this guards: moving bins into alleys emptied every street of
  // every district that has none, and only downtown and industry have them.
  //
  // Measured as DENSITY IN A STREAMING DISC at each district's own centre —
  // what a player standing there actually sees — for every district, not the
  // best one. Both weakenings shipped at some point and both hid this:
  //   - a hardcoded window, which after milestone 17 pointed at open sea;
  //   - `Math.max` over districts, which passes on one good district while
  //     eleven others are bare. Measured that way it read 20+; the emptiest
  //     district had five bins in a 105 m disc.
  const R = STREAM.LOAD_RADIUS * VOXEL.CHUNK_XZ * VOXEL.SIZE;
  const counts = Masterplan.regions.map((r) => {
    const xs = r.polygon.map(([x]) => x);
    const zs = r.polygon.map(([, z]) => z);
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const cz = zs.reduce((a, b) => a + b, 0) / zs.length;
    return { id: r.id, n: Layout.propsIn(cx - R, cz - R, cx + R, cz + R).length };
  });
  const bare = counts.filter((c) => c.n < 20);
  expect(bare, `containers per streaming disc: ${JSON.stringify(counts)}`).toEqual([]);
});

test('every query is O(1) against the bake', () => {
  Masterplan.bake();
  const t0 = performance.now();
  for (let n = 0; n < 200000; n++) Masterplan.classAt((n % 1800) - 900, ((n * 7) % 1800) - 900);
  const perQuery = (performance.now() - t0) / 200000;
  expect(perQuery).toBeLessThan(0.002); // the minimap calls this per pixel
});

test('the plan is deterministic and order-independent', () => {
  // Streaming generates columns in whatever order the player walks. A baked
  // array gives this by construction rather than by discipline.
  const sample = () => {
    let s = '';
    for (let n = 0; n < 400; n++) s += Masterplan.classAt((n * 37) % 900, (n * 61) % 900);
    return s;
  };
  const a = sample();
  Masterplan.bake(); // idempotent
  expect(sample()).toBe(a);
});
