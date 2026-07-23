// Boot smoke test (scaffold-phase gate): page loads, canvas renders, test hooks
// respond, zero console errors. Run with the dev server up: node tests/boot-smoke.mjs
import { chromium } from '@playwright/test';

const URL = process.env.GAME_URL || 'http://localhost:3000/';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const state = await page.evaluate(() => window.render_game_to_text());
const advanced = await page.evaluate(() => { window.advanceTime(2); return window.render_game_to_text(); });

// Playwright screenshots composite WebGL canvases black under headless
// SwiftShader, so verify rendering by reading pixels back off the canvas.
const pixels = await page.evaluate(() => {
  const c = document.querySelector('#game-container canvas');
  if (!c) return null;
  window.advanceTime(0.1);
  const c2 = document.createElement('canvas');
  c2.width = c.width; c2.height = c.height;
  const ctx = c2.getContext('2d');
  ctx.drawImage(c, 0, 0);
  const sample = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
  return { sky: sample(c.width >> 1, 60), ground: sample(c.width >> 1, c.height - 60) };
});

if (process.env.SMOKE_SCREENSHOT) await page.screenshot({ path: process.env.SMOKE_SCREENSHOT });
await browser.close();

const skyRendered = pixels && pixels.sky[0] > 150 && pixels.sky[3] === 255;
console.log('pixels:', JSON.stringify(pixels));
console.log('state:', state);
console.log('after advanceTime(2):', advanced);
console.log('console errors:', errors.length ? errors : 'none');
if (!skyRendered || errors.length) process.exit(1);
