import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  // Physics-sim tests are CPU-heavy: parallel workers on a loaded machine hit
  // wall-clock timeouts long before any assertion fails (the sim itself is
  // deterministic under advanceTime). Generous timeout + capped workers.
  timeout: 120_000,
  workers: 4,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev -- --no-open --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
