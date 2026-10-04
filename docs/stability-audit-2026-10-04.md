# Jimothy variability and stability audit — 4 October 2026

## Verdict

The broad audit found gameplay regressions, stale tests and performance failures. Daylight shadows, giant attacks cancelled by contact, and a high-rate collision-proxy oscillation have been repaired. These changes await Chris's playtest. Large destruction still settles too slowly, the draw budget is exceeded, and the maximum-size underside remains visibly distorted.

## What was tested

The complete pre-repair gameplay suite ran against a frozen copy of `af7089f`, so later fixes could not change the baseline halfway through. **343 passed, 12 failed and two were skipped by their serial suite** in 42.7 minutes, with no runner-level errors. Repair checks run against the current source. The baseline unit suite passes **105/105**; the added timestep regressions bring the final unit suite to **108/108**.

Eight baseline failures now pass after repairs to giant contact or test setup. The three short destruction-queue checks (including the individually rerun size-400 case) and two draw-budget checks remain failing. The other skipped case, sustained giant destruction and restart, passes its isolated clean rerun. This is a frozen full baseline plus targeted final verification, not a claim that the entire current tree has passed a second full suite.

Baseline artifacts: `output/iterate/stability-full.log`, `stability-baseline-full.json`. Follow-ups include `stability-held-roll.log`, `giant-sustained-clean.log` and the repair logs below.

| Area | Checks exercised |
| --- | --- |
| Movement and original Jimothy rig | Keyboard/gamepad, camera-relative steering, scurrying, jumping, aim, headbutts, held rolls, growth, paw planting, slope/kerb transitions, idle gestures, skin identity, rig loading and restart |
| World and buildings | Fine voxel edits, terrain contact, raised paving, cross-district joins, streaming, damage persistence, front/interior doors, furnished routes, residents, ceiling contact, exact structural support and physical rubble |
| People and enemies | Twelve MPFB variants, obstacle avoidance, grounding, twelve civilian routines, held props/piggyback transitions, ragdolls, search/notice/occlusion, net grips/sweeps, capture and recovery |
| Cars and army | Licensed car placement/orientation, spare-wheel attachment, road traffic, signals, lane side, streaming, glazing, breakaway parts, explosions, weight/contact, tanks, jets, warnings, intercepts and launched-player recovery |
| Food and tools | Food model identity/payout, feast interruption, floor separation, persistent food ownership, all 24 tools, energy/use, target occlusion, status effects, deployed devices, towing/grappling, dropping and restart |
| Outdoors and water | Reactive foliage, wildlife, sand contact/deformation, swimming/diving, size-dependent ripples, object splashes, scattered wreck/ruin sites, creatures, bubbles/rays, underwater collisions and collection |
| Underground and destinations | Sewer chambers/escape routes, crab anatomy/animation, equipment destruction and carry/release, sixteen landmarks, caches, map controls and landmark water |
| Presentation and lifecycle | Comet arrival, clock/day/night, circular compass/wanted/score HUD, shadows, graphics presets, draw distance, repeated travel/restart, geometry/texture/body ownership and console errors |

This audits implemented systems. Tiered giant food/edible buildings (M40), destination-driven tourist visits (M41), drivers parking and entering/exiting cars (M42), the proposed downtown/keepsake expansion, and the full revised police/infantry response remain planned work. A tourist character model or a street selfie routine does not establish M41 completion. Water is the current surface/swimming/ripple system; sand is bounded deformation, not a general fluid or soft-body solver.

## Repaired findings

### JIM-56: missing daylight shadows

- Planted grass, flowers and shrubs never cast shadows. Their depth materials now use the same wind/trampling deformation as their visible materials.
- The old fixed shadow volume clipped maximum-size Jimothy. Coverage and light distance now grow with his physical radius, retaining one active celestial caster, preset resolution and five shadow updates per second.
- Both reproductions failed before repair. All **45** combinations of five body sizes, three daytime hours and three graphics presets now contain the body.
- All six foliage families contribute rendered shadows. Comparing caster-on/off images changes **260, 1,458, 257, 580, 354 and 5,015 pixels** respectively. This final comparison exercises the custom deformed depth material.
- **12 unique focused/adjacent cases pass**, covering foliage, body coverage, bins, daylight/moonlight, a complete clock cycle, restart, presets, environment and daylight in crash channels. The ordinary daytime follow capture was inspected.

Nearby ordinary building/prop, car, food, people, tool and animal paths already opt into shadows; distant backdrop meshes intentionally remain outside the local shadow budget. Transparent effects are not ordinary solid casters. This repair does not promise shadows across the whole draw distance.

Evidence: `output/iterate/shadow-coverage-red.log`, `shadow-green.log`, `shadow-depth-final.log`, `shadow-smoke.log`, `lighting-day-shadows.png`. Commit: `bb1f0e3`.

### JIM-83: giant attacks cancelled by contact

Closed doors could cancel a giant headbutt during its wind-up, before any impact was emitted. Contact also repeatedly cancelled held rolling. The controller now keeps giant moves alive through resistance so their scheduled demolition can act; lean charges retain their stopping behaviour.

Both size-250/400 wind-up checks fail against the frozen baseline and pass after repair. Existing held-roll recovery, moving-jet interception and tank-part collection also recover. The adjacent door, lean car/person resistance and shared rubble checks pass. Build, all units and production pixel smoke pass, with no smoke console errors. The short destruction-queue deadlines still fail separately; they were retained.

Evidence: `output/iterate/giant-contact-red.log`, `giant-contact-green.log`, `giant-audit-followup.log`, `stability-smoke-final.log`. Commit: `2d88da8`.

### JIM-84: stale test setups

Four failures were corrected without changing runtime behaviour:

1. The input test left focus on a UI button, which intentionally suppresses gameplay keys. It now focuses the canvas before checking the input display.
2. The feast test waited 0.4 + 0.5 + 0.72 seconds before interrupting a 1.2-second channel. It now starts a fresh meal and explicitly checks partial progress, interruption to zero and payout only after a new full channel.
3. The restart test expected no food, although furnished homes now seed eight foods at boot. It now compares the exact fresh food population.
4. The spare-wheel test imported an unprocessed GLTFLoader URL. A small Vite-served browser fixture resolves its dependencies; unchanged assertions now measure size error below 0.00000012 m, mounting error below 0.00000008 m, zero drift and five breakaway wheels.

All four pass serially. The former JIM-03 feast failure is therefore not evidence of a scoring defect; `score and combo` passes in the broad baseline. Evidence: `output/iterate/stability-fixtures.log`, `stability-spare.log`. The first three repairs are in `499dd0f`; the loader fix is a separate JIM-84 follow-up.

Draw-budget checks also needed an explicit render with a shadow refresh. State-only advances otherwise retained old boot counters, and ordinary draws may omit the five-Hz shadow pass. Both unchanged <300 limits still fail: **339 calls at boot / 343 after twenty blasts**. Evidence: `output/iterate/stability-render-refresh.log`; no rendering threshold was raised.

### JIM-85: collision-proxy oscillation at 120 Hz

Velocity telemetry exposed a defect missed by the initial finite-value/resource checks. Some walking collision bodies oscillated roughly three metres around their visible actors, reporting speeds over 500 m/s. The 120-Hz updates alternated between zero and one 60-Hz physics steps; an initial placement offset fed back into the next velocity estimate indefinitely.

The physics system now synchronises each active proxy to its authored pose after integration, retaining its velocity for contact reporting. The new pure test fails at 120 Hz with 3.06 m drift before repair; all 30/60/120-Hz versions pass afterward. The loaded street/scurry reproduction's sampled peaks fall from approximately 565 m/s to 10 m/s, with ordinary car/actor movement retained. All 108 units and 39 adjacent contact/activity/walking/traffic/water browser cases pass, as do build and production pixel smoke without console errors.

The final mixed run still samples isolated 157–159 m/s pursuer proxy velocities during tool fixtures that use debug warps. These need an ordinary-play reproduction and placement/contact review. They are separate from the repaired sustained oscillation; finite transforms alone do not establish sound contact behaviour.

Evidence: `output/iterate/actor-timestep-red.log`, `actor-timestep-units.log`, `actor-timestep-browser.log`, `body-speed-audit.log`, `body-speed-final.log`, `stability-build-verified.log`, `stability-smoke-verified.log`. Commit: `ae2ad8d`.

## Open findings

### JIM-48: destruction settles too slowly

The old zero-pending-work assertions remain failing. The visible hits now destroy structures, but follow-up connectivity scans outlast their deadlines.

| Controlled action, army updates disabled | Mesh queue empty | Support queue still active | First sampled empty support queue |
| --- | --- | --- | --- |
| Block headbutt at the wall fixture | 2 simulated seconds | 4 seconds | 6 seconds |
| 1.1-second Block roll through the street | 3 simulated seconds | 12 seconds | 20 seconds |

The headbutt removes 52,220 cells. The rolling case grows from 302,873 to 305,777 removed cells as later support work finishes. Building keys advance and the queue eventually empties; this is slow convergence in these samples. Delayed cave-ins remain a real playability concern. The failure limits have not been raised.

Evidence: `output/iterate/queue-convergence.json`, `queue-convergence.log`, `giant-400-followup.log`, `giant-audit-followup.log`.

### Previously reported visual/balance gaps remain

- JIM-69 maximum-size underside skin stretching still needs a separate visual pass. Passing rig transforms does not prove a convincing giant silhouette.
- JIM-35 slower wanted escalation and the complete staged response remain outstanding. Stability tests do not establish the requested balance.
- All appearance, movement and collision changes still require Chris's hands-on playtest.

The final inspected `output/iterate/stability-performance-verified/giant-roll.png` confirms severe stretched folds/open-looking geometry around the rolling underside. The final street and underwater captures were also inspected. No growth weights or asset morphology were changed during this audit.

## Mixed gameplay and restart audit

The final post-repair mixed pass contains **174 phases / 18,450 simulation frames / 294 simulated seconds**, using three deterministic random seeds, Low/Medium/High starting presets, 30/60/120 Hz simulation steps, varied day/night hours, five fatness levels, all 24 tools, three building families, sewer/beach/ocean travel, all sixteen landmarks, army activity, preset changes and five repeated restarts per seed. Resource/finite-state checks pass, with zero console errors, warnings or failed requests. The remaining velocity samples are recorded under JIM-85 above.

It checks finite scene/body transforms, body ownership, duplicate registrations, escaped bodies and system limits. Every tool must actually fire. Console errors and failed requests are captured. Restart comparisons include body/entity/geometry/texture counts and JavaScript heap after GC. This varies random behaviour and test locations; it does not generate three different island layouts.

Warmed restart comparisons retain exactly the same body/entity/geometry/texture counts within each seed, across **15 restarts**. Heap growth after GC is 0.27–0.45 MiB between the second and fifth restart. This short audit finds no growing resource population; it does not prove absence of every long-run leak. The largest sampled population is 751 bodies / 547 dynamic bodies / 69 actor proxies. All recorded pool limits hold: 48 sections, 150 voxel fragments, 72 glass shards, 64 carried objects, six deployed tools, 160 actor proxies and 13 fish.

Final evidence: `output/iterate/stability-soak-verified/report.json`, run against unchanged runtime source throughout. An initial 98-second probe also passes. A preliminary run was interrupted by Vite reloading during a source repair; it is excluded from the final verdict and retained in `output/iterate/stability-soak/`. The complete pre-proxy-repair run, which exposed the sustained velocity anomaly, is retained in `output/iterate/stability-soak-final/report.json`.

## Performance method and results

Functional-suite timings overlap other workers and are not used as performance evidence. The dedicated runner uses headless Chrome 154 / Metal on Apple M5 Pro, a 960×600 viewport, Medium quality, the original rig, 60 Hz simulation and production time budgets for voxel work. It records first-render startup separately, warms the scene, then samples update CPU time and render submission. These are not presented FPS or a locked-frame-rate claim. Background applications on the shared workstation are not controlled.

The final serial sample, after the proxy-alignment repair, records:

| Scenario | Frames | Median / p95 / worst update + submission | Draw calls median / max | Bodies max |
| --- | ---: | ---: | ---: | ---: |
| Ordinary street | 180 | 13.0 / 14.4 / 26.1 ms | 200 / 331 | 283 |
| Underwater | 180 | 6.2 / 14.7 / 20.3 ms | 24 / 34 | 56 |
| Maximum-size roll, 111.4 m | 150 | 36.9 / 50.4 / 65.3 ms | 618 / 1,229 | 675 |

The giant carries 64 objects and reaches the 48-section pool limit. Its final live queue contains 69 meshes and 17 pending support entries. Component medians are 6.9 ms physics, 5.0 ms street traffic, 2.6 ms pedestrians, 2.0 ms damage, 2.1 ms generation and 2.5 ms remeshing. These identify substantial simulation and voxel work alongside rendering. First render is 405–802 ms and is excluded from the warmed rows. The underwater sample still has 13 meshes pending at its end, so it includes streaming work. Different viewport/methods prevent treating these as an improvement over prior native samples.

The foliage cost check toggles only the repaired casters in one warmed scene, forces each shadow refresh and waits for GPU completion. It adds nine calls (320 → 329). Repeated enabled samples vary from 4.4 to 12.1 ms against a 4.0 ms disabled sample; that variation prevents a reliable incremental GPU-time claim. Its forced-refresh cost is distinct from ordinary five-Hz shadow scheduling.

Final evidence: `output/iterate/stability-performance-verified/report.json` and its three inspected PNG captures; zero console errors. The earlier pre-proxy-repair sample remains in `output/iterate/stability-performance/report.json`. The short samples do not establish a before/after performance improvement.

## Test-runner limitation

One concurrent single-case invocation passed its gameplay assertions but failed to shut down its Playwright worker within 300 seconds. The isolated repeat passes cleanly in 45.5 seconds, and the full baseline has no runner errors. This was a runner teardown anomaly, not evidence of an in-game crash; its cause is unconfirmed. Both logs are retained: `giant-sustained-followup.log`, `giant-sustained-clean.log`.

## Reproduce

Run the dev server first (`npm run dev -- --open false`), then:

```sh
node --test tests/*.test.mjs
STATE_ONLY_TEST=1 npx playwright test --config playwright.audit.config.js
node tools/stability-audit.mjs
node tools/stability-performance.mjs
npm run build
GAME_URL=http://127.0.0.1:4174 npm run test:smoke
```

The production smoke command assumes a preview is already serving the built files on port 4174. The browser runners require installed Google Chrome. `GAME_URL` changes the suite URL; both standalone audit tools accept `--url=` and `--output=`, and the mixed runner accepts `--seeds=`. Run performance after other automated gameplay workloads finish.

`STATE_ONLY_TEST=1` omits redundant render calls during deterministic simulation advances. Rendered checks explicitly render and inspect canvas pixels; they do not trust black headless screenshot composites. The mixed runner also renders between simulation segments. These controlled tests use teleport/debug fixtures to reach scenarios quickly; they supplement ordinary keyboard gameplay checks and do not replace a full human run.

Local artifacts live under `output/iterate/` and are ignored by Git. The test scripts, regressions and this report are versioned.
