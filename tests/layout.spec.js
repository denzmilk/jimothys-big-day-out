// Milestone 12: the pure layout layer.
//
// No browser, no scene, no voxels — layout is a pure function of the seed and
// a coordinate, which is the whole point of it. That makes the city testable
// as arithmetic, and it is what lets a minimap draw places that have never
// been generated.
import { test, expect } from '@playwright/test';
import * as Layout from '../src/level/Layout.js';
import { CITY, VOXEL, WORLD } from '../src/core/Constants.js';

// A spread of block indices, including negatives and the origin, since sign
// handling around 0 is where grid maths usually breaks.
const SAMPLE = [];
for (let i = -6; i <= 6; i += 2) for (let j = -6; j <= 6; j += 2) SAMPLE.push([i, j]);

test('layout is order-independent — the assertion streaming depends on', () => {
  // The old buildDistrict drew from ONE sequential PRNG in nested-loop order,
  // so a block's size and height depended on how many blocks had been built
  // before it. Under streaming, chunks generate in whatever order the player
  // happens to walk, so that city would rearrange itself as you explored.
  // Every block must be a pure function of its own coordinates.
  const forward = SAMPLE.map(([i, j]) => JSON.stringify(Layout.buildingAt(i, j)));
  const scrambled = [...SAMPLE].reverse().map(([i, j]) => JSON.stringify(Layout.buildingAt(i, j)));
  expect(scrambled).toEqual([...forward].reverse());

  // …and re-querying one block a hundred times, interleaved with its
  // neighbours, must never change the answer.
  const once = JSON.stringify(Layout.buildingAt(3, -4));
  for (const [i, j] of SAMPLE) Layout.buildingAt(i, j);
  expect(JSON.stringify(Layout.buildingAt(3, -4))).toBe(once);
});

test('the city is deterministic from the seed', () => {
  const a = SAMPLE.map(([i, j]) => JSON.stringify(Layout.buildingAt(i, j)));
  const b = SAMPLE.map(([i, j]) => JSON.stringify(Layout.buildingAt(i, j)));
  expect(a).toEqual(b);
  // Not every block is a building — spawn is cleared and some blocks are
  // empty — but the sample must not be degenerate, or the test above proves
  // nothing.
  expect(a.filter((x) => x !== 'null').length).toBeGreaterThan(4);
});

test('buildings never sit on a road', () => {
  // The old grid derived block origins from `-limit + k * BLOCK`, which is not
  // aligned to the road mask's `vx mod BLOCK_V < ROAD_V`. Buildings could
  // therefore start inside a road. Layout aligns the two grids by
  // construction, and this is what holds it there.
  for (const [i, j] of SAMPLE) {
    const b = Layout.buildingAt(i, j);
    if (!b) continue;
    for (const [wx, wz] of [
      [b.x, b.z], [b.x + b.w - VOXEL.SIZE, b.z],
      [b.x, b.z + b.d - VOXEL.SIZE], [b.x + b.w - VOXEL.SIZE, b.z + b.d - VOXEL.SIZE],
    ]) {
      const [vx, , vz] = [Math.floor(wx / VOXEL.SIZE), 0, Math.floor(wz / VOXEL.SIZE)];
      expect(Layout.roadAtVoxel(vx, vz), `building ${i},${j} corner on road`).toBe(false);
    }
  }
});

test('spawn stays clear so Jimothy never wakes up inside a wall', () => {
  for (const b of Layout.buildingsIntersecting(-CITY.BLOCK, -CITY.BLOCK, CITY.BLOCK, CITY.BLOCK)) {
    // Nothing may overlap the immediate spawn area.
    const overlapsOrigin = b.x < 2 && b.x + b.w > -2 && b.z < 2 && b.z + b.d > -2;
    expect(overlapsOrigin, `building at ${b.i},${b.j} covers spawn`).toBe(false);
  }
});

test('a window query returns buildings whose ORIGIN is outside it', () => {
  // The chunk-seam trap. buildCraftsman writes a 14x12 footprint from one
  // origin and CHUNK_XZ is 64 voxels, so a house near a seam belongs to two or
  // four chunks. Asking "which buildings start in this box" leaves sliced
  // houses at every seam; the query must be by INTERSECTION.
  const b = SAMPLE.map(([i, j]) => Layout.buildingAt(i, j)).find(Boolean);
  expect(b).toBeTruthy();

  // A window covering only the building's far corner — its origin is outside.
  const pad = 0.01;
  const win = [b.x + b.w - pad, b.z + b.d - pad, b.x + b.w + 20, b.z + b.d + 20];
  const found = Layout.buildingsIntersecting(...win);
  expect(found.some((f) => f.i === b.i && f.j === b.j)).toBe(true);
});

test('a window query costs the window, not the world', () => {
  // A minimap redrawn every frame cannot afford to walk the whole city, and
  // the whole point of streaming is that world size stops mattering.
  const small = Layout.buildingsIntersecting(0, 0, CITY.BLOCK * 2, CITY.BLOCK * 2);
  expect(small.length).toBeLessThan(16);

  const t0 = performance.now();
  for (let n = 0; n < 200; n++) Layout.buildingsIntersecting(0, 0, CITY.BLOCK * 4, CITY.BLOCK * 4);
  const perQuery = (performance.now() - t0) / 200;
  expect(perQuery).toBeLessThan(2); // ms — comfortably inside a frame budget
});

test('roads form a connected grid rather than isolated strips', () => {
  // Sanity on the mask itself: along any road line, road-ness must persist.
  const blockV = Math.round(CITY.BLOCK / VOXEL.SIZE);
  let roadCells = 0;
  for (let vz = 0; vz < blockV; vz++) if (Layout.roadAtVoxel(2, vz)) roadCells++;
  // vx = 2 is inside the road band, so the entire column is road.
  expect(roadCells).toBe(blockV);
});

test('bounds still bound the city', () => {
  const outside = WORLD.BOUNDS + CITY.BLOCK * 2;
  expect(Layout.buildingsIntersecting(outside, outside, outside + 200, outside + 200)).toEqual([]);
});

// --- Milestone 15: density and variety ---

// A wide window of blocks, used by several tests below.
const WINDOW = [];
for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) WINDOW.push([i, j]);
const allLots = () => WINDOW.flatMap(([i, j]) => Layout.buildingsAt(i, j));

test('a block subdivides into lots, not one centred box', () => {
  // "don't just have rows and columns of the same destructable house" — one
  // building per block cell is what makes it read as a grid.
  const counts = WINDOW.map(([i, j]) => Layout.buildingsAt(i, j).length);
  expect(Math.max(...counts), 'no block holds more than one building').toBeGreaterThan(1);
  // Some blocks are parks or roads-only; that variation is the point.
  expect(counts.filter((c) => c === 0).length).toBeGreaterThan(0);
});

test('a street passes visibly different buildings', () => {
  const kinds = new Set(allLots().map((b) => b.type));
  expect([...kinds].length, `only these archetypes exist: ${[...kinds]}`).toBeGreaterThanOrEqual(6);

  // Variety has to be LOCAL, not just present somewhere on the island — a map
  // of uniform neighbourhoods still reads as rows and columns up close.
  let worst = Infinity;
  for (let i = -10; i <= 10; i += 5) {
    for (let j = -10; j <= 10; j += 5) {
      const near = [];
      for (let di = 0; di < 4; di++) for (let dj = 0; dj < 4; dj++) near.push([i + di, j + dj]);
      const local = new Set(near.flatMap(([a, b]) => Layout.buildingsAt(a, b)).map((b) => b.type));
      if (local.size) worst = Math.min(worst, local.size);
    }
  }
  expect(worst, 'some 4x4 block neighbourhood is entirely one archetype').toBeGreaterThan(1);
});

test('districts exist and differ in what they contain', () => {
  const byDistrict = new Map();
  for (const [i, j] of WINDOW) {
    const d = Layout.districtAt(i, j);
    if (!byDistrict.has(d)) byDistrict.set(d, new Set());
    for (const b of Layout.buildingsAt(i, j)) byDistrict.get(d).add(b.type);
  }
  expect(byDistrict.size, 'the whole island is one district').toBeGreaterThan(2);
  // Two districts that contain exactly the same archetypes are not districts.
  const sigs = [...byDistrict.values()].map((s) => [...s].sort().join(','));
  expect(new Set(sigs).size).toBeGreaterThan(1);
});

test('SAFE: nothing overlaps a road, at any lot', () => {
  // The guarantee milestone 12 established by construction — the buildable
  // span starts after the road band. Lot subdivision must subdivide that
  // span, never the block, or this is silently lost.
  //
  // Collected then asserted once. Thousands of lots x an expect() each costs
  // minutes in Playwright; the check itself is arithmetic and instant.
  const onRoad = [];
  for (const b of allLots()) {
    for (const [wx, wz] of [
      [b.x, b.z], [b.x + b.w - VOXEL.SIZE, b.z],
      [b.x, b.z + b.d - VOXEL.SIZE], [b.x + b.w - VOXEL.SIZE, b.z + b.d - VOXEL.SIZE],
    ]) {
      if (Layout.roadAtVoxel(Math.floor(wx / VOXEL.SIZE), Math.floor(wz / VOXEL.SIZE))) {
        onRoad.push(`${b.type}@${b.i},${b.j}`);
      }
    }
  }
  expect(onRoad.slice(0, 5)).toEqual([]);
});

test('SAFE: no two buildings overlap', () => {
  // Bucketed by block and compared only against the 3x3 neighbourhood: two
  // lots further apart than a block cannot overlap, and the naive all-pairs
  // sweep is millions of comparisons.
  const byBlock = new Map();
  for (const b of allLots()) {
    const k = `${b.i},${b.j}`;
    if (!byBlock.has(k)) byBlock.set(k, []);
    byBlock.get(k).push(b);
  }
  const hits = [];
  for (const [k, lots] of byBlock) {
    const [i, j] = k.split(',').map(Number);
    const near = [];
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) near.push(...(byBlock.get(`${i + di},${j + dj}`) || []));
    }
    for (const A of lots) {
      for (const B of near) {
        if (A === B) continue;
        if (A.x < B.x + B.w && B.x < A.x + A.w && A.z < B.z + B.d && B.z < A.z + A.d) {
          hits.push(`${A.type}@${A.i},${A.j}+${A.vx},${A.vz} overlaps ${B.type}@${B.i},${B.j}`);
        }
      }
    }
  }
  expect(hits.slice(0, 5)).toEqual([]);
});

test('SAFE: every building has a positive footprint and sits on the ground', () => {
  const bad = allLots()
    .filter((b) => b.vw <= 2 || b.vd <= 2 || b.vh <= 1)
    .map((b) => `${b.type} ${b.vw}x${b.vd}x${b.vh}`);
  expect(bad.slice(0, 5)).toEqual([]);
});

test('lots stay order-independent', () => {
  const fwd = WINDOW.map(([i, j]) => JSON.stringify(Layout.buildingsAt(i, j)));
  const rev = [...WINDOW].reverse().map(([i, j]) => JSON.stringify(Layout.buildingsAt(i, j)));
  expect(rev).toEqual([...fwd].reverse());
});

test('SAFE: containers are never placed close enough to topple each other', () => {
  // cannon-es resolves an overlap by flinging both bodies apart, so two bins
  // spawned on top of each other tip themselves — free food and free heat with
  // no player input, continuously, as the world streams in. The old eager
  // layout bought this with rejection sampling and a 3.5 m gap; the streamed
  // one has to get it by construction.
  const MIN_GAP = 2.5;
  const props = WINDOW.flatMap(([i, j]) => Layout.propsAt(i, j));
  expect(props.length, 'no containers at all').toBeGreaterThan(100);

  const cell = new Map();
  const key = (x, z) => `${Math.floor(x / 8)},${Math.floor(z / 8)}`;
  for (const p of props) {
    const k = key(p.x, p.z);
    if (!cell.has(k)) cell.set(k, []);
    cell.get(k).push(p);
  }
  const tooClose = [];
  for (const p of props) {
    const [cx, cz] = key(p.x, p.z).split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (const q of cell.get(`${cx + dx},${cz + dz}`) || []) {
          if (q === p) continue;
          const d = Math.hypot(p.x - q.x, p.z - q.z);
          if (d < MIN_GAP) tooClose.push(`${p.id} and ${q.id} are ${d.toFixed(2)}m apart`);
        }
      }
    }
  }
  expect(tooClose.slice(0, 5)).toEqual([]);
});

test('container density is a property of a block, not of the map', () => {
  // The bug this whole milestone exists for: TRASH_CAN.COUNT (70) spread over
  // WORLD.BOUNDS meant raising bounds 250 -> 1000 divided density by 16.
  const per = WINDOW.map(([i, j]) => Layout.propsAt(i, j).length);
  const avg = per.reduce((a, b) => a + b, 0) / per.length;
  expect(avg).toBeGreaterThan(0.8);
  // …and it holds just as well far from the origin as near it.
  const far = [];
  for (let i = 20; i < 26; i++) for (let j = 20; j < 26; j++) far.push(Layout.propsAt(i, j).length);
  const farAvg = far.reduce((a, b) => a + b, 0) / far.length;
  expect(Math.abs(farAvg - avg)).toBeLessThan(1);
});
