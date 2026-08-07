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
