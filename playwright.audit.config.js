import {defineConfig} from '@playwright/test';

// Keep resource-heavy gameplay checks serial for reproducible diagnosis.
// A separate server URL also lets an audit hold the runtime at a frozen commit.
export default defineConfig({
 testDir:'./tests',testMatch:'**/*.spec.js',timeout:120000,workers:1,fullyParallel:false,
 reporter:[['line'],['json',{outputFile:'output/iterate/stability-full.json'}]],
 outputDir:'output/iterate/stability-test-results',
 use:{baseURL:process.env.GAME_URL||'http://127.0.0.1:3000',headless:true,channel:'chrome',
  // Keep the audio graph/analyser live without a hanging OS output device.
  launchOptions:{args:['--disable-audio-output',...(process.platform==='darwin'?['--use-angle=metal']:[])]}},
});
