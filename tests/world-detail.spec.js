import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { VOXEL } from '../src/core/Constants.js';
import * as Layout from '../src/level/Layout.js';
import { buildTrashCanDen } from '../src/level/VoxelCity.js';
import { VoxelWorld } from '../src/level/VoxelWorld.js';
import { boot, adv, state } from './helpers.mjs';

test('fine cells preserve usable house scale and varied residential styles', () => {
  expect(VOXEL.SIZE).toBeLessThanOrEqual(0.22);
  const houses = Layout.buildingsIntersecting(-300, -300, 300, 300).filter(b => b.type === 'craftsman');
  expect(houses.length).toBeGreaterThan(10);
  expect(new Set(houses.map(b => b.style)).size).toBeGreaterThanOrEqual(3);
  for (const b of houses) {
    expect(b.w).toBeLessThanOrEqual(15);
    expect(b.vh * VOXEL.SIZE).toBeGreaterThanOrEqual(2.6);
  }
});

test('coplanar voxel surfaces merge while damage remains precise', () => {
  const world = new VoxelWorld(new THREE.Scene());
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.set(x, 0, z, 1);
  world.remeshDirty();
  const vertices = [...world.chunks.values()].reduce((n, c) => n + (c.mesh?.geometry.attributes.position.count || 0), 0);
  expect(vertices).toBe(36);
  const removed = world.damageSphere(1.5 * VOXEL.SIZE, VOXEL.SIZE / 2, 1.5 * VOXEL.SIZE, VOXEL.SIZE * 0.6);
  expect(removed).toHaveLength(1);
  world.remeshDirty();
  expect(world.get(1, 0, 1)).toBe(0);
});

test('atmosphere advances and world still resets', async ({ page }) => {
  await boot(page);
  const a = await state(page);
  expect(a.world?.voxelSize).toBeLessThanOrEqual(0.22);
  await adv(page, 1);
  const b = await state(page);
  expect(b.world.atmosphereTime).toBeGreaterThan(a.world.atmosphereTime);
  await page.evaluate(() => window.restartGame());
  const c = await state(page);
  expect(c.voxels.removed).toBe(0);
  expect(c.cans.length).toBeGreaterThan(0);
});

test('the barrel den rests on the slope along its length', () => {
  const cells=[];
  const terrain={topSolidVoxelY:(x)=>Math.floor(x/VOXEL.SIZE)};
  buildTrashCanDen({terrain,set:(x,y,z)=>cells.push({x,y,z})},0,100,0,20,10);
  // The torn-open mouth has no lower wall; check the supported tube behind it.
  for(let x=1;x<20;x++){
    const bottom=Math.min(...cells.filter(c=>c.x===x).map(c=>c.y));
    expect(bottom-x).toBeGreaterThanOrEqual(0);
    expect(bottom-x).toBeLessThanOrEqual(1);
  }
});
